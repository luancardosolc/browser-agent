import { detectFields, readFormErrors } from '@/core/form-intelligence';
import { detectContext } from '@/context/detector';
import type { DomSnapshot, SnapshotField } from '@/types';

type QueryRoot = Document | Element | ShadowRoot;

const ACTION_BUTTON_TEXTS = [
  'next',
  'proximo',
  'continue',
  'continuar',
  'submit',
  'enviar',
  'review',
  'revisar',
  'upload resume',
  'attach resume',
  'easy apply',
  'apply',
];

export function buildSnapshot(jobId: string, sessionToken: string): DomSnapshot {
  const ctx = detectContext();
  const fieldContainer = resolveFieldContainer(ctx.pageType);
  const detected = fieldContainer ? detectFields(fieldContainer) : [];
  const fields: SnapshotField[] = detected.map((field) => ({
    label: field.label,
    fieldType: field.fieldType,
    required: field.required,
    ...(field.options && { options: field.options }),
    ...(field.currentValue !== undefined && { currentValue: field.currentValue }),
    ...(field.validationError && { validationError: field.validationError }),
  }));

  const buttons: DomSnapshot['buttons'] = [];
  const seen = new Set<string>();

  const buttonRoots = collectButtonRoots(ctx.pageType, fieldContainer);
  for (const root of buttonRoots) {
    root
      .querySelectorAll<HTMLElement>('button, a[role="button"], input[type="submit"], input[type="button"]')
      .forEach((button) => {
        if (!isVisible(button)) return;

        const text = getButtonText(button);
        const ariaLabel = button.getAttribute('aria-label') ?? '';
        const combined = normalizeText(`${text} ${ariaLabel}`);
        if (!ACTION_BUTTON_TEXTS.some((value) => combined.includes(value))) return;

        const selector = buildButtonSelector(button, text, ariaLabel);
        if (!selector || seen.has(selector)) return;

        seen.add(selector);
        buttons.push({
          label: text || ariaLabel,
          selector,
          role: classifyButton(combined),
        });
      });
  }

  return {
    jobId,
    sessionToken,
    url: window.location.href,
    pageType: ctx.pageType,
    title: document.title,
    fields,
    buttons,
    errors: readFormErrors(fieldContainer ?? document.body),
    metadata: ctx.metadata,
    timestamp: Date.now(),
  };
}

function resolveFieldContainer(pageType: string): QueryRoot | null {
  const interopRoot = getInteropShadowRoot();

  if (pageType === 'linkedin_easy_apply') {
    return (
      interopRoot?.querySelector('[data-test-modal-id="easy-apply-modal"] form') ??
      interopRoot?.querySelector('.jobs-easy-apply-modal form') ??
      interopRoot?.querySelector('.jobs-easy-apply-content form') ??
      interopRoot?.querySelector('.jobs-apply-modal form') ??
      interopRoot?.querySelector('[role="dialog"][aria-modal="true"] form') ??
      interopRoot?.querySelector('.artdeco-modal[role="dialog"] form') ??
      interopRoot?.querySelector('[data-test-modal-id="easy-apply-modal"]') ??
      interopRoot?.querySelector('.jobs-easy-apply-modal') ??
      interopRoot?.querySelector('.jobs-easy-apply-content') ??
      interopRoot?.querySelector('.jobs-apply-modal') ??
      interopRoot?.querySelector('[role="dialog"][aria-modal="true"]') ??
      interopRoot?.querySelector('.artdeco-modal[role="dialog"]') ??
      document.querySelector('[data-test-modal-id="easy-apply-modal"] form') ??
      document.querySelector('.jobs-easy-apply-modal form') ??
      document.querySelector('.jobs-easy-apply-content form') ??
      document.querySelector('.jobs-apply-modal form') ??
      document.querySelector('[role="dialog"][aria-modal="true"] form') ??
      document.querySelector('.artdeco-modal[role="dialog"] form') ??
      document.querySelector('[data-test-modal-id="easy-apply-modal"]') ??
      document.querySelector('.jobs-easy-apply-modal') ??
      document.querySelector('.jobs-easy-apply-content') ??
      document.querySelector('.jobs-apply-modal') ??
      document.querySelector('[role="dialog"][aria-modal="true"]') ??
      document.querySelector('.artdeco-modal[role="dialog"]') ??
      document
    );
  }

  if (pageType === 'linkedin') {
    return null;
  }

  // External form pages: scope to the main application form to avoid header/footer noise
  if (['greenhouse', 'workday', 'lever', 'indeed', 'glassdoor', 'form', 'generic'].includes(pageType)) {
    return (
      document.querySelector<HTMLElement>('form[id*="application"], form[class*="application"]') ??
      document.querySelector<HTMLElement>('main form') ??
      document.querySelector<HTMLElement>('[role="main"] form') ??
      document.querySelector<HTMLElement>('form') ??
      document
    );
  }

  return document;
}

function collectButtonRoots(pageType: string, fieldContainer: QueryRoot | null): QueryRoot[] {
  const roots: QueryRoot[] = [];
  if (fieldContainer) roots.push(fieldContainer);

  const interopRoot = getInteropShadowRoot();
  if (pageType === 'linkedin_easy_apply') {
    if (fieldContainer instanceof Element) {
      const modalRoot =
        fieldContainer.closest('[data-test-modal-id="easy-apply-modal"]') ??
        fieldContainer.closest('.jobs-easy-apply-modal') ??
        fieldContainer.closest('.jobs-easy-apply-content') ??
        fieldContainer.closest('.jobs-apply-modal') ??
        fieldContainer.closest('[role="dialog"][aria-modal="true"]') ??
        fieldContainer.closest('.artdeco-modal[role="dialog"]');
      if (modalRoot && !roots.includes(modalRoot)) roots.push(modalRoot);
    }

    if (interopRoot && !roots.includes(interopRoot)) roots.push(interopRoot);
    return roots;
  }

  if (interopRoot && !roots.includes(interopRoot)) roots.push(interopRoot);

  if (!roots.includes(document)) roots.push(document);
  return roots;
}

function getButtonText(button: HTMLElement): string {
  if (button instanceof HTMLInputElement) {
    return button.value?.trim() ?? '';
  }
  return button.textContent?.trim() ?? '';
}

function buildButtonSelector(button: HTMLElement, text: string, ariaLabel: string): string | null {
  const dataControlName = button.getAttribute('data-control-name');
  if (dataControlName) return `[data-control-name="${dataControlName}"]`;

  if (button.getAttribute('data-easy-apply-next-button') !== null) return '[data-easy-apply-next-button]';
  if (button.getAttribute('data-easy-apply-submit-button') !== null) return '[data-easy-apply-submit-button]';

  if (ariaLabel) return `${button.tagName.toLowerCase()}[aria-label="${ariaLabel}"]`;

  const normalizedText = text.trim();
  if (normalizedText) {
    return `${button.tagName.toLowerCase()}:text("${normalizedText.replace(/"/g, '\\"')}")`;
  }

  if (button.id) return `#${button.id}`;

  const label = text.slice(0, 40).replace(/"/g, '\\"');
  if (!label) return null;
  return `${button.tagName.toLowerCase()}[aria-label*="${label}" i]`;
}

function classifyButton(label: string): 'start' | 'next' | 'review' | 'submit' | 'upload' | 'other' {
  if (label.includes('easy apply')) return 'start';
  if (label.includes('review') || label.includes('revisar')) return 'review';
  if (label.includes('submit') || label.includes('enviar')) return 'submit';
  if (
    label.includes('continue') ||
    label.includes('continuar') ||
    label.includes('next') ||
    label.includes('proximo')
  ) {
    return 'next';
  }
  if (label.includes('upload') || label.includes('attach')) return 'upload';
  return 'other';
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    el.offsetWidth > 0 &&
    el.offsetHeight > 0
  );
}

function getInteropShadowRoot(): ShadowRoot | null {
  const interop = document.querySelector<HTMLElement>('#interop-outlet');
  return interop?.shadowRoot ?? null;
}
