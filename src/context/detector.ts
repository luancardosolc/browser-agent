import type { PageContext, PageType } from '@/types';

function detectPageType(url: string): PageType {
  if (url.includes('linkedin.com')) {
    if (document.querySelector('[data-test-modal-id="easy-apply-modal"]') ||
        document.querySelector('.jobs-easy-apply-modal')) {
      return 'linkedin_easy_apply';
    }
    return 'linkedin';
  }
  if (url.includes('greenhouse.io') || url.includes('boards.greenhouse.io')) return 'greenhouse';
  if (url.includes('myworkdayjobs.com') || url.includes('workday.com')) return 'workday';
  if (url.includes('jobs.lever.co')) return 'lever';

  // Generic form detection
  const forms = document.querySelectorAll('form');
  if (forms.length > 0) return 'form';

  return 'generic';
}

function extractMetadata(pageType: PageType): Record<string, unknown> {
  const meta: Record<string, unknown> = {};

  if (pageType === 'linkedin' || pageType === 'linkedin_easy_apply') {
    meta.jobId = window.location.pathname.match(/\/jobs\/view\/(\d+)/)?.[1];
    meta.jobTitle = document.querySelector('.job-details-jobs-unified-top-card__job-title')?.textContent?.trim()
      ?? document.querySelector('h1')?.textContent?.trim();
    meta.company = document.querySelector('.job-details-jobs-unified-top-card__company-name')?.textContent?.trim();
    meta.easyApplyOpen = !!document.querySelector('[data-test-modal-id="easy-apply-modal"]');
  }

  if (pageType === 'form' || pageType === 'greenhouse' || pageType === 'lever') {
    const fieldCount = document.querySelectorAll('input, select, textarea').length;
    meta.fieldCount = fieldCount;
  }

  return meta;
}

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
