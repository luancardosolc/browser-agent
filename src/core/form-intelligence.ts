import type { FieldType, DetectedField } from '@/types';
import { fillField } from '@/actions/executor';

const ERROR_SELECTORS = [
  '[aria-live="assertive"]',
  '[aria-live="polite"]',
  '[role="alert"]',
  '[id$="-error"]',
  '[id*="-error-"]',
  '.error-message',
  '.invalid-feedback',
];

// ─── Field Detection ──────────────────────────────────────────────────────────

function mapElementType(el: HTMLElement): FieldType {
  if (el instanceof HTMLSelectElement) return 'select';
  if (el instanceof HTMLTextAreaElement) return 'textarea';
  if (el instanceof HTMLInputElement) {
    switch (el.type) {
      case 'number': return 'number';
      case 'checkbox': return 'checkbox';
      case 'radio': return 'radio';
      case 'file': return 'file';
      default: return 'text';
    }
  }
  return 'text';
}

function getLabel(el: HTMLElement): string {
  // 1. aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  // 2. associated <label>
  const id = el.id;
  if (id) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${id}"]`);
    if (label) {
      // Use aria-hidden span if available (avoids duplicate visually-hidden text)
      const ariaHidden = label.querySelector('[aria-hidden="true"]');
      return (ariaHidden ?? label).textContent?.trim() ?? '';
    }
  }

  // 3. parent label
  const parentLabel = el.closest('label');
  if (parentLabel) return parentLabel.textContent?.trim() ?? '';

  // 4. legend (radio/checkbox group)
  const fieldset = el.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend) {
      const ariaHidden = legend.querySelector('[aria-hidden="true"]');
      return (ariaHidden ?? legend).textContent?.trim() ?? '';
    }
  }

  // 5. placeholder fallback
  return (el as HTMLInputElement).placeholder ?? el.getAttribute('name') ?? '';
}

function getOptions(el: HTMLElement): string[] | undefined {
  if (el instanceof HTMLSelectElement) {
    return Array.from(el.options).map(o => o.text.trim()).filter(Boolean);
  }
  if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
    const name = el.name;
    if (!name) return undefined;
    const group = Array.from(
      document.querySelectorAll<HTMLInputElement>(`input[name="${CSS.escape(name)}"]`),
    );
    return group.map(r => {
      const lbl = getLabel(r);
      return lbl || r.value;
    });
  }
  return undefined;
}

export function detectFields(container: Element | Document = document): DetectedField[] {
  const inputs = Array.from(
    container.querySelectorAll<HTMLElement>('input:not([type=hidden]), select, textarea'),
  );

  const seen = new Set<string>();
  const fields: DetectedField[] = [];

  for (const el of inputs) {
    const fieldType = mapElementType(el);
    // For radio groups, only emit once per group
    if (fieldType === 'radio') {
      const name = (el as HTMLInputElement).name;
      if (seen.has(name)) continue;
      seen.add(name);
    }

    fields.push({
      element: el,
      label: getLabel(el),
      fieldType,
      required: (el as HTMLInputElement).required ?? el.getAttribute('aria-required') === 'true',
      options: getOptions(el),
      currentValue: (el as HTMLInputElement).value,
    });
  }

  return fields;
}

// ─── Validation Error Reading ─────────────────────────────────────────────────

export function readFieldErrors(el: HTMLElement): string[] {
  const messages: string[] = [];

  // 1. aria-describedby
  const describedBy = el.getAttribute('aria-describedby');
  if (describedBy) {
    for (const id of describedBy.split(/\s+/)) {
      const errEl = document.getElementById(id);
      if (errEl?.textContent?.trim()) messages.push(errEl.textContent.trim());
    }
  }

  // 2. nearby error elements in parent
  for (const selector of ERROR_SELECTORS) {
    const errEl = el.parentElement?.querySelector(selector);
    if (errEl?.textContent?.trim()) messages.push(errEl.textContent.trim());
  }

  // 3. native validation message
  const native = (el as HTMLInputElement).validationMessage;
  if (native) messages.push(native);

  return [...new Set(messages)];
}

export function readFormErrors(container: Element = document.body): string[] {
  const all: string[] = [];
  for (const selector of ERROR_SELECTORS) {
    container.querySelectorAll(selector).forEach(el => {
      const msg = el.textContent?.trim();
      if (msg) all.push(msg);
    });
  }
  return [...new Set(all)];
}

// ─── Auto-correct ─────────────────────────────────────────────────────────────

export function autoCorrectAnswer(
  fieldType: FieldType,
  currentValue: string,
  errorMsg: string,
  options?: string[],
): string {
  const lowerError = errorMsg.toLowerCase();

  if (fieldType === 'number') {
    // Extract first number from value (e.g. "Mais de 10 anos" → "10")
    const nums = currentValue.match(/\d+/g);
    if (nums) return nums[0];

    // If error says "maximum X", return X
    const maxMatch = lowerError.match(/maximum\s+(\d+)|máximo\s+(\d+)/);
    if (maxMatch) return maxMatch[1] ?? maxMatch[2] ?? currentValue;
  }

  if ((fieldType === 'select' || fieldType === 'radio') && options?.length) {
    // Word-score matching: pick the option whose words overlap most with the current value
    const valueLower = currentValue.toLowerCase();
    let best = options[0];
    let bestScore = -1;
    for (const opt of options) {
      const optLower = opt.toLowerCase();
      const overlap = optLower.split(/\s+/).filter(w => valueLower.includes(w)).length;
      if (overlap > bestScore) {
        bestScore = overlap;
        best = opt;
      }
    }
    return best;
  }

  return currentValue;
}

// ─── Fill with retry ──────────────────────────────────────────────────────────

export async function fillWithRetry(
  field: DetectedField,
  value: string,
  maxRetries = 2,
): Promise<{ success: boolean; finalValue: string; error?: string }> {
  let attempt = 0;
  let current = value;

  while (attempt <= maxRetries) {
    await fillField(field.element, current);

    // Brief wait for React to process
    await new Promise(r => setTimeout(r, 200));

    const errors = readFieldErrors(field.element);
    if (errors.length === 0) return { success: true, finalValue: current };

    if (attempt < maxRetries) {
      current = autoCorrectAnswer(field.fieldType, current, errors[0], field.options);
    } else {
      return { success: false, finalValue: current, error: errors[0] };
    }

    attempt++;
  }

  return { success: false, finalValue: current };
}
