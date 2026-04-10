/** Extracts structured data from the current DOM. */

export interface ExtractedData {
  url: string;
  title: string;
  headings: string[];
  paragraphs: string[];
  links: Array<{ text: string; href: string }>;
  metadata: Record<string, string>;
  custom?: Record<string, unknown>;
}

export function extractPage(): ExtractedData {
  const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
    .map(h => h.textContent?.trim() ?? '')
    .filter(Boolean);

  const paragraphs = Array.from(document.querySelectorAll('p'))
    .map(p => p.textContent?.trim() ?? '')
    .filter(t => t.length > 20);

  const links = Array.from(document.querySelectorAll('a[href]'))
    .map(a => ({
      text: (a as HTMLAnchorElement).textContent?.trim() ?? '',
      href: (a as HTMLAnchorElement).href,
    }))
    .filter(l => l.text);

  const metadata: Record<string, string> = {};
  document.querySelectorAll('meta[name],meta[property]').forEach(m => {
    const key = m.getAttribute('name') ?? m.getAttribute('property') ?? '';
    const val = m.getAttribute('content') ?? '';
    if (key && val) metadata[key] = val;
  });

  return {
    url: window.location.href,
    title: document.title,
    headings,
    paragraphs,
    links,
    metadata,
  };
}

export function extractLinkedInJob(): Record<string, unknown> {
  return {
    jobId: window.location.pathname.match(/\/jobs\/view\/(\d+)/)?.[1],
    title: document.querySelector('.job-details-jobs-unified-top-card__job-title')?.textContent?.trim(),
    company: document.querySelector('.job-details-jobs-unified-top-card__company-name')?.textContent?.trim(),
    location: document.querySelector('.job-details-jobs-unified-top-card__bullet')?.textContent?.trim(),
    description: document.querySelector('#job-details')?.textContent?.trim(),
    easyApply: !!document.querySelector('.jobs-apply-button--top-card'),
  };
}
