/** Resilient DOM action executor — handles React/Vue controlled components. */

function nativeSet(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype,
    'value',
  )?.set;
  nativeSetter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export async function fillField(el: HTMLElement, value: string): Promise<void> {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox') {
      const checked = value === 'true' || value === '1';
      if (el.checked !== checked) el.click();
      return;
    }
    if (el.type === 'radio') {
      if (!el.checked) {
        el.focus();
        nativeSet(el, el.value);
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.click();
      }
      return;
    }
    el.focus();
    nativeSet(el, value);
    return;
  }

  if (el instanceof HTMLTextAreaElement) {
    el.focus();
    nativeSet(el, value);
    return;
  }

  if (el instanceof HTMLSelectElement) {
    const option = Array.from(el.options).find(
      o => o.text.toLowerCase().includes(value.toLowerCase()) ||
           o.value.toLowerCase() === value.toLowerCase(),
    );
    if (option) {
      el.value = option.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return;
  }
}

export async function clickElement(selector: string): Promise<boolean> {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return false;
  el.focus();
  el.click();
  return true;
}

export async function waitForElement(
  selector: string,
  timeoutMs = 5000,
): Promise<HTMLElement | null> {
  const existing = document.querySelector<HTMLElement>(selector);
  if (existing) return existing;

  return new Promise(resolve => {
    const observer = new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}

export async function navigate(url: string): Promise<void> {
  window.location.href = url;
}
