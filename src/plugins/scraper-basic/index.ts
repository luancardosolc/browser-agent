import type { Plugin, PageContext, PluginResult } from '@/types';
import { extractPage, extractLinkedInJob } from '@/extractors/dom-extractor';

/**
 * scraper_basic — extracts structured data from any supported page.
 */
export const scraperBasicPlugin: Plugin = {
  name: 'scraper_basic',

  canHandle(_ctx: PageContext): boolean {
    return true; // Handles all page types
  },

  async execute(ctx: PageContext, _data: Record<string, unknown>): Promise<PluginResult> {
    if (ctx.pageType === 'linkedin' || ctx.pageType === 'linkedin_easy_apply') {
      return {
        status: 'success',
        data: { extracted: extractLinkedInJob(), pageType: ctx.pageType },
      };
    }

    return {
      status: 'success',
      data: { extracted: extractPage(), pageType: ctx.pageType },
    };
  },
};
