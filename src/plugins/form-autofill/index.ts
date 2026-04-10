import type { Plugin, PageContext, PluginResult, KnowledgeEntry } from '@/types';
import { detectFields, fillWithRetry } from '@/core/form-intelligence';
import { backendClient } from '@/communication/client';

/**
 * form_autofill — generic form filling plugin.
 * Uses backend knowledge base + provided answers to fill visible form fields.
 */
export const formAutofillPlugin: Plugin = {
  name: 'form_autofill',

  canHandle(ctx: PageContext): boolean {
    return ['form', 'greenhouse', 'lever', 'workday', 'generic'].includes(ctx.pageType);
  },

  async execute(ctx: PageContext, data: Record<string, unknown>): Promise<PluginResult> {
    const answers = (data.answers ?? {}) as Record<string, string>;
    const form = document.querySelector('form') ?? document.body;
    const fields = detectFields(form);

    // Pull knowledge from backend
    let knowledge: KnowledgeEntry[] = [];
    try {
      knowledge = await backendClient.getKnowledge();
    } catch {
      // Offline — continue with provided answers only
    }

    const pendingQuestions: PluginResult['pendingQuestions'] = [];
    let filledCount = 0;

    for (const field of fields) {
      if (!field.label) continue;

      const labelLower = field.label.toLowerCase();

      // 1. Use provided answers first
      let value = answers[field.label] ?? answers[labelLower];

      // 2. Fall back to knowledge base
      if (!value) {
        const match = knowledge.find(k => labelLower.includes(k.pattern.toLowerCase()));
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
        data: { filledCount },
        pendingQuestions,
      };
    }

    return { status: 'success', data: { filledCount } };
  },
};
