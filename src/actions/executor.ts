/** Resilient DOM action executor that handles React/Vue controlled components. */

type QueryRoot = Document | ShadowRoot | Element;

function getLinkedInInteropRoot(): ShadowRoot | null {
  return document.querySelector<HTMLElement>('#interop-outlet')?.shadowRoot ?? null;
}

function getQueryRoots(): QueryRoot[] {
  const interopRoot = getLinkedInInteropRoot();
  return interopRoot ? [interopRoot, document] : [document];
}

function getEasyApplyModalRoots(): QueryRoot[] {
  const roots: QueryRoot[] = [];
  const selectors = [
    '[data-test-modal-id="easy-apply-modal"]',
    '.jobs-easy-apply-modal',
    '.jobs-easy-apply-content',
    '.jobs-apply-modal',
    '[role="dialog"][aria-modal="true"]',
    '.artdeco-modal[role="dialog"]',
  ];

  for (const root of getQueryRoots()) {
    for (const selector of selectors) {
      const match = root.querySelector<HTMLElement>(selector);
      if (match && !roots.includes(match)) roots.push(match);
    }
  }

  return roots.length > 0 ? roots : getQueryRoots();
}

function querySelectorAcrossRoots<T extends Element>(selector: string): T | null {
  for (const root of getQueryRoots()) {
    const match = root.querySelector<T>(selector);
    if (match) return match;
  }
  return null;
}

function isVisibleElement(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    el.offsetWidth > 0 &&
    el.offsetHeight > 0
  );
}

function collectVisibleButtonsDebug(): string[] {
  const details: string[] = [];
  for (const root of getEasyApplyModalRoots()) {
    const candidates = Array.from(
      root.querySelectorAll<HTMLElement>('button, a[role="button"], input[type="submit"], input[type="button"]'),
    ).filter(isVisibleElement);

    for (const button of candidates) {
      const text =
        button instanceof HTMLInputElement
          ? button.value?.trim() ?? ''
          : button.textContent?.trim() ?? '';
      details.push(
        JSON.stringify({
          tag: button.tagName.toLowerCase(),
          text,
          ariaLabel: button.getAttribute('aria-label'),
          dataControlName: button.getAttribute('data-control-name'),
          disabled:
            button instanceof HTMLButtonElement || button instanceof HTMLInputElement
              ? button.disabled
              : button.getAttribute('aria-disabled') === 'true',
          id: button.id || undefined,
        }),
      );
    }
  }

  return details;
}

function findScrollableAncestor(el: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = el.parentElement;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    const isScrollable =
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      current.scrollHeight > current.clientHeight;
    if (isScrollable) return current;
    current = current.parentElement;
  }
  return null;
}

function ensureElementVisibleInContainer(el: HTMLElement): void {
  const scroller = findScrollableAncestor(el);
  if (scroller) {
    const containerRect = scroller.getBoundingClientRect();
    const elementRect = el.getBoundingClientRect();
    const deltaTop = elementRect.top - containerRect.top;
    const deltaBottom = elementRect.bottom - containerRect.bottom;

    if (deltaTop < 0) {
      scroller.scrollTop += deltaTop - 24;
    } else if (deltaBottom > 0) {
      scroller.scrollTop += deltaBottom + 24;
    }
  }
}

function findPrimaryButtonByText(buttonText?: string): HTMLElement | null {
  const normalizedTarget = buttonText?.trim().toLowerCase() ?? '';

  for (const root of getEasyApplyModalRoots()) {
    const candidates = Array.from(
      root.querySelectorAll<HTMLElement>('button.artdeco-button--primary, button, a[role="button"], input[type="submit"], input[type="button"]'),
    ).filter(isVisibleElement);

    const enabled = candidates.filter((candidate) => {
      const disabled =
        (candidate instanceof HTMLButtonElement || candidate instanceof HTMLInputElement ? candidate.disabled : false) ||
        candidate.getAttribute('aria-disabled') === 'true';
      return !disabled;
    });

    if (normalizedTarget) {
      const exact = enabled.find((candidate) => {
        const text =
          candidate instanceof HTMLInputElement
            ? candidate.value?.trim().toLowerCase() ?? ''
            : candidate.textContent?.trim().toLowerCase() ?? '';
        return text === normalizedTarget;
      });
      if (exact) return exact;

      const partial = enabled.find((candidate) => {
        const text =
          candidate instanceof HTMLInputElement
            ? candidate.value?.trim().toLowerCase() ?? ''
            : candidate.textContent?.trim().toLowerCase() ?? '';
        return text.includes(normalizedTarget);
      });
      if (partial) return partial;
    }

    const primary = enabled.find((candidate) => candidate.matches('button.artdeco-button--primary'));
    if (primary) return primary;
  }

  return null;
}

function getLabelTextForInput(input: HTMLInputElement): string {
  const root = input.getRootNode();
  const queryRoot = root instanceof Document || root instanceof ShadowRoot ? root : document;

  if (input.id) {
    const linked = queryRoot.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`);
    if (linked?.textContent?.trim()) return linked.textContent.trim();
  }

  const parentLabel = input.closest('label');
  if (parentLabel?.textContent?.trim()) return parentLabel.textContent.trim();

  return input.value?.trim() ?? '';
}

function nativeSet(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype,
    'value',
  )?.set;
  nativeSetter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

export async function fillField(el: HTMLElement, value: string): Promise<void> {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox') {
      const checked = value === 'true' || value === '1';
      if (el.checked !== checked) el.click();
      return;
    }

    if (el.type === 'radio') {
      const targetValue = value.toLowerCase().trim();
      const root = el.getRootNode();
      const queryRoot = root instanceof Document || root instanceof ShadowRoot ? root : document;
      const group = el.name
        ? Array.from(queryRoot.querySelectorAll<HTMLInputElement>(`input[name="${CSS.escape(el.name)}"]`))
        : [el];

      const target =
        group.find((candidate) => {
          const optionText = getLabelTextForInput(candidate).toLowerCase().trim();
          return optionText === targetValue || candidate.value.toLowerCase().trim() === targetValue;
        }) ??
        group.find((candidate) => {
          const optionText = getLabelTextForInput(candidate).toLowerCase().trim();
          return optionText.includes(targetValue) || candidate.value.toLowerCase().trim().includes(targetValue);
        }) ??
        el;

      if (!target.checked) {
        target.focus();
        target.click();
        target.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        target.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        target.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
      }
      return;
    }

    el.focus();
    nativeSet(el, value);
    el.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
    return;
  }

  if (el instanceof HTMLTextAreaElement) {
    el.focus();
    nativeSet(el, value);
    el.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
    return;
  }

  if (el instanceof HTMLSelectElement) {
    const option = Array.from(el.options).find(
      (o) =>
        o.text.toLowerCase().includes(value.toLowerCase())
        || o.value.toLowerCase() === value.toLowerCase(),
    );

    if (option) {
      el.focus();
      el.value = option.value;
      el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
    }
  }
}

export async function clickElement(
  selectorOrOptions:
    | string
    | {
        selector?: string;
        fallbackSelectors?: string[];
        buttonText?: string;
        timeoutMs?: number;
      },
): Promise<{ ok: boolean; reason?: string; debug: string[] }> {
  const options =
    typeof selectorOrOptions === 'string'
      ? { selector: selectorOrOptions, fallbackSelectors: [], timeoutMs: 2500 }
      : { timeoutMs: 2500, fallbackSelectors: [], ...selectorOrOptions };

  const tried: string[] = [];
  const buttonInventory = collectVisibleButtonsDebug();
  console.log(`[executor] Found ${buttonInventory.length} visible button(s) on screen.`);
  for (const detail of buttonInventory) {
    console.log(`[executor] Button: ${detail}`);
  }

  const candidates = [
    ...(options.selector ? [options.selector] : []),
    ...(options.fallbackSelectors ?? []),
  ];

  for (const selector of candidates) {
    tried.push(selector);
    console.log(`[executor] Trying selector: ${selector}`);

    const el = selector.includes(':text(')
      ? findElementByTextSelector(selector)
      : await waitForElement(selector, options.timeoutMs);

    if (!el) {
      console.log(`[executor] Selector not found: ${selector}`);
      continue;
    }

    if (!isVisibleElement(el)) {
      console.log(`[executor] Selector found but element is not visible: ${selector}`);
      continue;
    }

    const disabled =
      (el instanceof HTMLButtonElement || el instanceof HTMLInputElement ? el.disabled : false) ||
      el.getAttribute('aria-disabled') === 'true';
    console.log(`[executor] Click candidate text="${el.textContent?.trim() ?? ''}" disabled=${disabled}`);
    if (disabled) {
      continue;
    }

    ensureElementVisibleInContainer(el);
    el.focus();
    el.click();
    console.log(`[executor] Click attempt result: success via selector ${selector}`);
    return { ok: true, debug: tried };
  }

  if (options.buttonText?.trim()) {
    const textSelector = `button:text("${options.buttonText.trim().replace(/"/g, '\\"')}")`;
    tried.push(textSelector);
    console.log(`[executor] Trying text fallback: ${textSelector}`);
    const el = findElementByTextSelector(textSelector);
    if (el && isVisibleElement(el)) {
      const disabled =
        (el instanceof HTMLButtonElement || el instanceof HTMLInputElement ? el.disabled : false) ||
        el.getAttribute('aria-disabled') === 'true';
      console.log(`[executor] Text fallback candidate text="${el.textContent?.trim() ?? ''}" disabled=${disabled}`);
      if (!disabled) {
        ensureElementVisibleInContainer(el);
        el.focus();
        el.click();
        console.log(`[executor] Click attempt result: success via text fallback ${options.buttonText}`);
        return { ok: true, debug: tried };
      }
    }
  }

  const primary = findPrimaryButtonByText(options.buttonText);
  if (primary) {
    tried.push(`primary:${options.buttonText ?? '(any)'}`);
    console.log(
      `[executor] Trying primary button fallback: text="${primary.textContent?.trim() ?? ''}" aria-label="${primary.getAttribute('aria-label') ?? ''}"`,
    );
    ensureElementVisibleInContainer(primary);
    primary.focus();
    primary.click();
    console.log('[executor] Click attempt result: success via primary modal button fallback');
    return { ok: true, debug: tried };
  }

  console.log(`[executor] Click attempt result: failed. Tried ${tried.length} candidate(s).`);
  return { ok: false, reason: `Element not found or not clickable: ${tried.join(' | ')}`, debug: tried };
}

export async function waitForElement(
  selector: string,
  timeoutMs = 5000,
): Promise<HTMLElement | null> {
  const existing = querySelectorAcrossRoots<HTMLElement>(selector);
  if (existing) return existing;

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const el = querySelectorAcrossRoots<HTMLElement>(selector);
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

function findElementByTextSelector(selector: string): HTMLElement | null {
  const match = selector.match(/^([a-z0-9_-]+):text\("(.+)"\)$/i);
  if (!match) return null;

  const [, tagName, text] = match;
  const normalizedTarget = text.toLowerCase();

  for (const root of getEasyApplyModalRoots()) {
    const candidates = Array.from(root.querySelectorAll<HTMLElement>(tagName));
    const visibleCandidates = candidates.filter(isVisibleElement);

    const exactMatch = visibleCandidates.find((candidate) =>
      candidate.textContent?.trim().toLowerCase() === normalizedTarget,
    );
    if (exactMatch) return exactMatch;

    const matchByText = visibleCandidates.find((candidate) =>
      candidate.textContent?.trim().toLowerCase().includes(normalizedTarget),
    );
    if (matchByText) return matchByText;
  }

  return null;
}
