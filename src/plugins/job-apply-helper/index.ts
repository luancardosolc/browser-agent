import type { Plugin, PageContext, PluginResult } from '@/types';
import { extractLinkedInJob } from '@/extractors/dom-extractor';
import { clickElement, waitForElement } from '@/actions/executor';

/**
 * job_apply_helper — LinkedIn Easy Apply helper plugin.
 * Detects the Easy Apply button and triggers the apply flow.
 */
export const jobApplyHelperPlugin: Plugin = {
  name: 'job_apply_helper',

  canHandle(ctx: PageContext): boolean {
    return ctx.pageType === 'linkedin' || ctx.pageType === 'linkedin_easy_apply';
  },

  async execute(ctx: PageContext, data: Record<string, unknown>): Promise<PluginResult> {
    const action = (data.action as string) ?? 'extract';

    if (action === 'extract') {
      return {
        status: 'success',
        data: { job: extractLinkedInJob() },
      };
    }

    if (action === 'open_easy_apply') {
      // Click the Easy Apply button
      const selectors = [
        '.jobs-apply-button--top-card',
        '[data-control-name="jobdetails_topcard_inapply"]',
        'button.jobs-apply-button',
      ];

      for (const sel of selectors) {
        const clicked = await clickElement(sel);
        if (clicked) {
          // Wait for modal to appear
          const modal = await waitForElement(
            '[data-test-modal-id="easy-apply-modal"], .jobs-easy-apply-modal',
            5000,
          );
          if (modal) {
            return {
              status: 'success',
              data: { modalOpen: true, job: extractLinkedInJob() },
            };
          }
        }
      }

      return { status: 'error', error: 'Could not open Easy Apply modal' };
    }

    if (action === 'next_step') {
      const nextBtn = await waitForElement(
        '[data-easy-apply-next-button], [aria-label="Continue to next step"]',
        3000,
      );
      if (nextBtn) {
        (nextBtn as HTMLElement).click();
        return { status: 'success', data: { stepped: true } };
      }
      return { status: 'error', error: 'Next button not found' };
    }

    return { status: 'error', error: `Unknown action: ${action}` };
  },
};
