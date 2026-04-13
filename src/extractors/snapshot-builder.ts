import { detectFields, readFormErrors } from '@/core/form-intelligence';
import { detectContext } from '@/context/detector';
import type { DomSnapshot, SnapshotField } from '@/types';

// Textos de botões de ação relevantes para o fluxo de candidatura
const ACTION_BUTTON_TEXTS = [
  'next', 'próximo', 'continue', 'continuar',
  'submit', 'enviar', 'review', 'revisar',
  'upload resume', 'attach resume',
];

/**
 * Constrói um DomSnapshot serializable do estado atual do formulário.
 * Usa detectFields() e readFormErrors() existentes, sem referências ao DOM.
 */
export function buildSnapshot(jobId: string, sessionToken: string): DomSnapshot {
  const ctx = detectContext();

  // Serializa DetectedField[] → SnapshotField[] (remove .element não-serializável)
  const detected = detectFields(document);
  const fields: SnapshotField[] = detected.map(f => ({
    label: f.label,
    fieldType: f.fieldType,
    required: f.required,
    ...(f.options && { options: f.options }),
    ...(f.currentValue !== undefined && { currentValue: f.currentValue }),
    ...(f.validationError && { validationError: f.validationError }),
  }));

  // Detecta botões de ação visíveis
  const buttons: { label: string; selector: string }[] = [];
  const seen = new Set<string>();

  document.querySelectorAll<HTMLButtonElement>('button').forEach(btn => {
    if (!isVisible(btn)) return;

    const text = btn.textContent?.trim() ?? '';
    const ariaLabel = btn.getAttribute('aria-label') ?? '';
    const combined = (text + ' ' + ariaLabel).toLowerCase();

    if (!ACTION_BUTTON_TEXTS.some(t => combined.includes(t))) return;

    // Gera o seletor mais estável possível
    const selector =
      btn.id ? `#${btn.id}` :
      ariaLabel ? `button[aria-label="${ariaLabel}"]` :
      btn.getAttribute('data-control-name') ? `[data-control-name="${btn.getAttribute('data-control-name')}"]` :
      btn.getAttribute('data-easy-apply-next-button') !== null ? '[data-easy-apply-next-button]' :
      `button:contains("${text.slice(0, 30)}")`;

    const label = text || ariaLabel;
    if (label && !seen.has(selector)) {
      seen.add(selector);
      buttons.push({ label, selector });
    }
  });

  const errors = readFormErrors(document.body);

  return {
    jobId,
    sessionToken,
    url: window.location.href,
    pageType: ctx.pageType,
    title: document.title,
    fields,
    buttons,
    errors,
    timestamp: Date.now(),
  };
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
