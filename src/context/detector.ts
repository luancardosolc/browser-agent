import type { PageContext, PageType } from '@/types';

function detectPageType(url: string): PageType {
  if (url.includes('linkedin.com')) {
    if (findLinkedInEasyApplyRoot()) {
      return 'linkedin_easy_apply';
    }
    return 'linkedin';
  }
  if (url.includes('greenhouse.io') || url.includes('boards.greenhouse.io')) return 'greenhouse';
  if (url.includes('myworkdayjobs.com') || url.includes('workday.com')) return 'workday';
  if (url.includes('jobs.lever.co')) return 'lever';
  if (url.includes('indeed.com')) return 'indeed';
  if (url.includes('glassdoor.com')) return 'glassdoor';

  const forms = document.querySelectorAll('form');
  if (forms.length > 0) return 'form';

  return 'generic';
}

function extractMetadata(pageType: PageType): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  const interopRoot = getInteropShadowRoot();

  if (pageType === 'linkedin' || pageType === 'linkedin_easy_apply') {
    const bodyText = normalizeText(document.body.innerText);
    const easyApplyRoot = findLinkedInEasyApplyRoot();
    const easyApplyButton =
      findVisibleButton([
        'button.jobs-apply-button',
        '.jobs-apply-button',
        'button[aria-label*="Easy Apply" i]',
        'button[aria-label*="Apply" i]',
        'a[href*="/jobs/apply/"]',
        'a[aria-label*="Easy Apply" i]',
      ]) ?? findVisibleActionByText(['easy apply']);
    const primaryModalButton = findPrimaryModalButton(easyApplyRoot);
    const closedText = findClosedJobText(bodyText);
    const appliedText = findAppliedSuccessText(bodyText);
    const alreadyAppliedText = findAlreadyAppliedText(bodyText);
    const easyApplyOpen = !!easyApplyRoot;
    const primaryActionKind = classifyButton(primaryModalButton);

    const externalApply = detectExternalApplyButton();

    meta.jobId = window.location.pathname.match(/\/jobs\/view\/(\d+)/)?.[1];
    meta.jobTitle =
      document.querySelector('.job-details-jobs-unified-top-card__job-title')?.textContent?.trim() ??
      document.querySelector('h1')?.textContent?.trim();
    meta.company = document.querySelector('.job-details-jobs-unified-top-card__company-name')?.textContent?.trim();
    meta.easyApplyOpen = easyApplyOpen;
    meta.easyApplyRootSelector = describeElement(easyApplyRoot);
    meta.easyApplyInShadowRoot = !!interopRoot;
    meta.easyApplyVisible = isEasyApplyButton(easyApplyButton);
    meta.applyButtonLabel = getButtonLabel(easyApplyButton);
    meta.easyApplySelector = buildElementSelector(easyApplyButton);
    meta.externalApplyVisible = externalApply.visible;
    meta.externalApplySelector = externalApply.selector;
    meta.primaryActionLabel = getButtonLabel(primaryModalButton);
    meta.primaryActionKind = primaryActionKind;
    meta.jobClosed = !!closedText;
    meta.closedReason = closedText;
    meta.applicationSubmitted = !!appliedText;
    meta.applicationSubmittedReason = appliedText;
    meta.alreadyApplied = !!alreadyAppliedText;
    meta.alreadyAppliedReason = alreadyAppliedText;
    meta.loading = !!document.querySelector('.artdeco-loader, .jobs-easy-apply-content__loading, [aria-busy="true"]');
    meta.pageState = inferLinkedInPageState({
      jobClosed: !!closedText,
      applicationSubmitted: !!appliedText,
      alreadyApplied: !!alreadyAppliedText,
      easyApplyOpen,
      easyApplyVisible: isEasyApplyButton(easyApplyButton),
      externalApplyVisible: externalApply.visible,
      primaryActionKind,
      hasErrors: document.querySelectorAll('.artdeco-inline-feedback--error, [aria-invalid="true"]').length > 0,
    });
  }

  if (
    pageType === 'form' ||
    pageType === 'greenhouse' ||
    pageType === 'lever' ||
    pageType === 'workday' ||
    pageType === 'indeed' ||
    pageType === 'glassdoor' ||
    pageType === 'generic'
  ) {
    const successText = detectExternalFormSuccess();
    const loginRequired = detectLoginWall();
    const captcha = detectCaptcha();
    const hasFields = document.querySelectorAll('input:not([type=hidden]), select, textarea').length > 0;
    const hasErrors = document.querySelectorAll(
      '[aria-invalid="true"], [aria-live="assertive"], .error-message, .invalid-feedback',
    ).length > 0;

    meta.applicationSubmitted = !!successText;
    meta.applicationSubmittedReason = successText;
    meta.loginRequired = loginRequired;
    meta.captchaPresent = captcha;
    meta.hasErrors = hasErrors;
    meta.stepIndicator = detectStepIndicator();
    meta.pageState = inferExternalPageState({ loginRequired, captcha, submitted: !!successText, hasErrors, hasFields });
  }

  return meta;
}

function findLinkedInEasyApplyRoot(): HTMLElement | null {
  const interopRoot = getInteropShadowRoot();
  const allRoots: Array<Document | ShadowRoot> = [document];
  if (interopRoot) allRoots.unshift(interopRoot);

  const directSelectors = [
    '[data-test-modal-id="easy-apply-modal"]',
    '.jobs-easy-apply-modal',
    '.jobs-easy-apply-content',
    '.jobs-apply-modal',
    '.artdeco-modal[role="dialog"]',
    '[role="dialog"][aria-modal="true"]',
  ];

  for (const root of allRoots) {
    for (const selector of directSelectors) {
      const elements = Array.from(root.querySelectorAll<HTMLElement>(selector));
      const match = elements.find((element) => isVisible(element) && looksLikeEasyApplyRoot(element));
      if (match) return match;
    }
  }

  for (const root of allRoots) {
    const dialogs = Array.from(root.querySelectorAll<HTMLElement>('[role="dialog"], .artdeco-modal'));
    const match = dialogs.find((dialog) => isVisible(dialog) && looksLikeEasyApplyRoot(dialog));
    if (match) return match;
  }

  if (interopRoot) {
    const applyElement = interopRoot.querySelector<HTMLElement>(
      [
        '[id*="easyApplyFormElement"]',
        '[id*="jobs-applyformcommon"]',
        '[id^="radio-button-form-component-formElement-urn-li-jobs-applyformcommon"]',
        '[id^="text-entity-list-form-component-formElement-urn-li-jobs-applyformcommon"]',
        'form',
      ].join(', '),
    );

    if (applyElement && isVisible(applyElement)) {
      return (
        applyElement.closest<HTMLElement>('[role="dialog"], .artdeco-modal, form')
        ?? interopRoot.host
      );
    }
  }

  return null;
}

function findPrimaryModalButton(easyApplyRoot: HTMLElement | null): HTMLElement | null {
  const selectors = [
    '[data-easy-apply-next-button]',
    '[data-easy-apply-submit-button]',
    'button[aria-label*="Continue" i]',
    'button[aria-label*="Next" i]',
    'button[aria-label*="Review" i]',
    'button[aria-label*="Submit" i]',
    '.artdeco-button--primary',
  ];

  if (easyApplyRoot) {
    for (const selector of selectors) {
      const elements = Array.from(easyApplyRoot.querySelectorAll<HTMLElement>(selector));
      const match = elements.find(isVisible);
      if (match) return match;
    }
  }

  return null;
}

function looksLikeEasyApplyRoot(element: HTMLElement): boolean {
  const text = normalizeText(element.innerText || element.textContent || '');
  if (!text) return false;

  return (
    text.includes('easy apply') ||
    text.includes('resume') ||
    text.includes('upload resume') ||
    text.includes('submit application') ||
    text.includes('review your application') ||
    text.includes('contact info') ||
    !!element.querySelector('input[type="file"], [data-easy-apply-next-button], [data-easy-apply-submit-button]')
  );
}

function inferLinkedInPageState(input: {
  jobClosed: boolean;
  applicationSubmitted: boolean;
  alreadyApplied: boolean;
  easyApplyOpen: boolean;
  easyApplyVisible: boolean;
  externalApplyVisible: boolean;
  primaryActionKind: string;
  hasErrors: boolean;
}): string {
  if (input.jobClosed) return 'closed_job';
  if (input.applicationSubmitted) return 'applied_success';
  if (input.alreadyApplied) return 'already_applied';
  if (input.easyApplyOpen && input.primaryActionKind !== 'other') return 'modal_step';
  if (input.easyApplyOpen && input.hasErrors) return 'modal_error';
  if (input.easyApplyVisible) return 'ready_to_start';
  if (input.externalApplyVisible) return 'ready_to_apply_external';
  return 'viewing_job';
}

function findClosedJobText(bodyText: string): string | null {
  const phrases = [
    'no longer accepting applications',
    'applications are no longer being accepted',
    'vaga encerrada',
    'nao aceita mais candidaturas',
    'nao aceita mais inscricoes',
  ];

  for (const phrase of phrases) {
    if (bodyText.includes(phrase)) return phrase;
  }

  const banner = document.querySelector(
    '.jobs-details-top-card__apply-error, .jobs-details-closed-banner, .artdeco-inline-feedback--error',
  );
  const text = banner?.textContent?.trim();
  return text ? normalizeText(text) : null;
}

function findAppliedSuccessText(bodyText: string): string | null {
  const phrases = [
    'application submitted',
    'your application was sent',
    'application sent',
    'candidatura enviada',
    'sua candidatura foi enviada',
    'you successfully applied',
  ];

  for (const phrase of phrases) {
    if (bodyText.includes(phrase)) return phrase;
  }

  const successBanner = document.querySelector(
    '.artdeco-inline-feedback--success, .jobs-easy-apply-content__success, [data-test-modal-id="easy-apply-success"]',
  );
  const text = successBanner?.textContent?.trim();
  return text ? normalizeText(text) : null;
}

function findAlreadyAppliedText(bodyText: string): string | null {
  const phrases = [
    'already applied',
    'you applied',
    'candidate-se',
    'ja se candidatou',
    'voce ja se candidatou',
  ];

  for (const phrase of phrases) {
    if (bodyText.includes(phrase)) return phrase;
  }

  const banner = document.querySelector(
    '.jobs-s-apply__applied-state, .jobs-apply-button--top-card [aria-label*="Applied" i], .jobs-details-top-card__job-state',
  );
  const text = banner?.textContent?.trim() ?? (banner as HTMLElement | null)?.getAttribute?.('aria-label') ?? '';
  return text ? normalizeText(text) : null;
}

function findVisibleButton(selectors: string[]): HTMLElement | null {
  const roots: Array<Document | ShadowRoot> = [document];
  const interopRoot = getInteropShadowRoot();
  if (interopRoot) roots.unshift(interopRoot);

  for (const root of roots) {
    for (const selector of selectors) {
      const elements = Array.from(root.querySelectorAll<HTMLElement>(selector));
      const match = elements.find(isVisible);
      if (match) return match;
    }
  }
  return null;
}

function findVisibleActionByText(labels: string[]): HTMLElement | null {
  const roots: Array<Document | ShadowRoot> = [document];
  const interopRoot = getInteropShadowRoot();
  if (interopRoot) roots.unshift(interopRoot);

  for (const root of roots) {
    const candidates = Array.from(
      root.querySelectorAll<HTMLElement>('button, a, div[role="button"], span[role="button"]'),
    );

    const match = candidates.find((candidate) => {
      if (!isVisible(candidate)) return false;
      const text = normalizeText(candidate.textContent ?? candidate.getAttribute('aria-label') ?? '');
      return labels.some((label) => text.includes(label));
    });

    if (match) return match;
  }

  return null;
}

function getInteropShadowRoot(): ShadowRoot | null {
  const interop = document.querySelector<HTMLElement>('#interop-outlet');
  return interop?.shadowRoot ?? null;
}

function getButtonLabel(button: HTMLElement | null): string | null {
  if (!button) return null;
  return button.textContent?.trim() || button.getAttribute('aria-label');
}

function isEasyApplyButton(button: HTMLElement | null): boolean {
  const label = normalizeText(getButtonLabel(button) ?? '');
  return label.includes('easy apply');
}

function classifyButton(button: HTMLElement | null): string {
  const label = normalizeText(getButtonLabel(button) ?? '');
  if (!label) return 'other';
  if (label.includes('easy apply')) return 'start';
  if (label.includes('review')) return 'review';
  if (label.includes('submit') || label.includes('enviar')) return 'submit';
  if (
    label.includes('continue') ||
    label.includes('next') ||
    label.includes('continuar') ||
    label.includes('proximo')
  ) {
    return 'next';
  }
  if (label.includes('upload') || label.includes('attach')) return 'upload';
  return 'other';
}

function buildElementSelector(element: HTMLElement | null): string | null {
  if (!element) return null;
  if (element.id) return `#${element.id}`;

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return `${element.tagName.toLowerCase()}[aria-label="${ariaLabel}"]`;
  }

  const dataControlName = element.getAttribute('data-control-name');
  if (dataControlName) {
    return `[data-control-name="${dataControlName}"]`;
  }

  if (element.classList.contains('jobs-apply-button')) {
    return '.jobs-apply-button';
  }

  const text = normalizeText(element.textContent ?? '').slice(0, 40);
  if (!text) return null;
  return `${element.tagName.toLowerCase()}:text("${text}")`;
}

function describeElement(element: HTMLElement | null): string | null {
  if (!element) return null;
  const classes = Array.from(element.classList).slice(0, 3).join('.');
  if (classes) return `${element.tagName.toLowerCase()}.${classes}`;
  return element.tagName.toLowerCase();
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

// ─── External Site Helpers ────────────────────────────────────────────────────

function detectExternalApplyButton(): { visible: boolean; selector: string | null } {
  const roots: Array<Element | ShadowRoot> = [document.body];
  const interopRoot = getInteropShadowRoot();
  if (interopRoot) roots.unshift(interopRoot);

  for (const root of roots) {
    const elements = Array.from(
      root.querySelectorAll<HTMLElement>('button, a[href], [role="button"]'),
    );
    for (const el of elements) {
      if (!isVisible(el)) continue;
      const aria = normalizeText(el.getAttribute('aria-label') ?? '');
      const text = normalizeText(el.textContent ?? '');
      const combined = `${aria} ${text}`;
      const isApply = combined.includes('apply') || combined.includes('candidatar');
      const isEasy = combined.includes('easy apply') || combined.includes('candidatura simplificada');
      if (isApply && !isEasy) {
        const selector = buildElementSelector(el);
        return { visible: true, selector };
      }
    }
  }
  return { visible: false, selector: null };
}

function detectLoginWall(): boolean {
  const hasPassword = Array.from(
    document.querySelectorAll<HTMLElement>('input[type="password"]'),
  ).some(isVisible);
  if (!hasPassword) return false;
  const terms = ['sign in', 'log in', 'create account', 'entrar', 'fazer login', 'registrar'];
  const bodyText = normalizeText(document.body.innerText);
  return terms.some((t) => bodyText.includes(t));
}

function detectCaptcha(): boolean {
  const selectors = [
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    'iframe[src*="challenges.cloudflare"]',
    '.g-recaptcha',
    '.h-captcha',
    '[data-sitekey]',
  ];
  return selectors.some((s) => {
    const el = document.querySelector<HTMLElement>(s);
    return el && isVisible(el);
  });
}

function detectExternalFormSuccess(): string | null {
  const phrases = [
    'application submitted',
    'application received',
    'thank you for applying',
    'successfully applied',
    'your application has been',
    'we received your application',
    'application complete',
    'candidatura enviada',
    'recebemos sua candidatura',
    'obrigado por se candidatar',
    'candidatura concluida',
  ];
  const bodyText = normalizeText(document.body.innerText);
  return phrases.find((p) => bodyText.includes(p)) ?? null;
}

function detectStepIndicator(): string | null {
  const re = /\b(?:step|page|pagina|passo)\s*\d+\s*(?:of|de|\/)\s*\d+\b|\b\d+\s*\/\s*\d+\b/i;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('span, p, div, li, [role="progressbar"]'))) {
    if (!isVisible(el)) continue;
    const text = el.textContent?.trim() ?? '';
    if (text.length <= 20 && re.test(text)) return text;
  }
  return null;
}

function inferExternalPageState(meta: {
  loginRequired: boolean;
  captcha: boolean;
  submitted: boolean;
  hasErrors: boolean;
  hasFields: boolean;
}): string {
  if (meta.submitted) return 'submitted';
  if (meta.loginRequired) return 'login_required';
  if (meta.captcha) return 'captcha';
  if (meta.hasErrors) return 'form_error';
  if (meta.hasFields) return 'form_step';
  return 'unknown';
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function detectContext(): PageContext {
  const url = window.location.href;
  const pageType = detectPageType(url);

  return {
    url,
    pageType,
    title: document.title,
    metadata: extractMetadata(pageType),
  };
}
