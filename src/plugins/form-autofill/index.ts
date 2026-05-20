import type { Plugin, PageContext, PluginResult, KnowledgeEntry } from '@/types';
import { detectFields, fillWithRetry } from '@/core/form-intelligence';
import { backendClient } from '@/communication/client';

function resolveLinkedInEasyApplyForm(): ParentNode {
  const interopRoot = document.querySelector<HTMLElement>('#interop-outlet')?.shadowRoot;
  const selector = [
    '[data-test-modal-id="easy-apply-modal"] form',
    '.jobs-easy-apply-modal form',
    '.jobs-easy-apply-content form',
    '.jobs-apply-modal form',
    '[role="dialog"][aria-modal="true"] form',
    '.artdeco-modal[role="dialog"] form',
  ].join(', ');

  return interopRoot?.querySelector(selector)
    ?? document.querySelector(selector)
    ?? interopRoot
    ?? document.body;
}

function resolveExternalForm(): ParentNode {
  return (
    document.querySelector<HTMLElement>('form[id*="application"], form[class*="application"]') ??
    document.querySelector<HTMLElement>('main form') ??
    document.querySelector<HTMLElement>('[role="main"] form') ??
    document.querySelector<HTMLElement>('form') ??
    document.body
  );
}

/**
 * form_autofill - generic form filling plugin.
 * Uses backend knowledge base + provided answers to fill visible form fields.
 */
export const formAutofillPlugin: Plugin = {
  name: 'form_autofill',

  canHandle(ctx: PageContext): boolean {
    return [
      'linkedin_easy_apply', 'form', 'greenhouse', 'lever',
      'workday', 'indeed', 'glassdoor', 'generic',
    ].includes(ctx.pageType);
  },

  async execute(ctx: PageContext, data: Record<string, unknown>): Promise<PluginResult> {
    const answers = (data.answers ?? {}) as Record<string, string>;
    const form = (
      ctx.pageType === 'linkedin_easy_apply'
        ? resolveLinkedInEasyApplyForm()
        : resolveExternalForm()
    ) ?? document.body;
    const fields = detectFields(form);

    let knowledge: KnowledgeEntry[] = [];
    try {
      knowledge = await backendClient.getKnowledge();
    } catch {
      // Offline - continue with provided answers only.
    }

    const pendingQuestions: PluginResult['pendingQuestions'] = [];
    let filledCount = 0;

    for (const field of fields) {
      if (!field.label) continue;
      if (field.fieldType === 'file') continue;

      const labelLower = field.label.toLowerCase();
      let value = answers[field.label] ?? answers[labelLower];

      if (!value) {
        const match = knowledge.find((entry) => labelLower.includes(entry.pattern.toLowerCase()));
        if (match) value = match.answer;
      }

      if (value) {
        const result = await fillWithRetry(field, value);
        if (result.success) filledCount++;
      } else if (field.required) {
        pendingQuestions.push({
          label: field.label,
          fieldType: field.fieldType,
          options: field.options,
          required: true,
        });
      }
    }

    if (pendingQuestions.length > 0) {
      return {
        status: 'pending',
        data: { filledCount, detectedFields: fields.length },
        pendingQuestions,
      };
    }

    return { status: 'success', data: { filledCount, detectedFields: fields.length } };
  },
};
