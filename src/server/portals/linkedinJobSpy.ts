import * as cheerio from 'cheerio';
import type { LinkedInJobDetailResponse } from '../../types/jobs';
import { analyzeExperience, stripHtmlToText, type RawScrapedJob } from './jobMatcher';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const LINKEDIN_QUERIES = [
  'Software Developer',
  'Junior Software Engineer',
  'Salesforce Developer',
  'Junior Salesforce Developer',
  'Salesforce Apex LWC Developer',
];

function extractLinkedInJobId(href: string, urn: string): string {
  const urnMatch = urn.match(/jobPosting:(\d+)/);
  if (urnMatch) return urnMatch[1];
  const hrefMatch = href.match(/-(\d+)(?:\?|$)/) || href.match(/\/view\/(\d+)/);
  if (hrefMatch) return hrefMatch[1];
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function fetchLinkedInSearchPage(params: {
  keywords: string;
  location: string;
  remoteOnly: boolean;
  start?: number;
}): Promise<RawScrapedJob[]> {
  const url = new URL(
    'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
  );
  url.searchParams.set('keywords', params.keywords);
  // f_E=1,2 targets Internship (1) and Entry Level (2) — JobSpy LinkedIn experience filter
  url.searchParams.set('f_E', '1,2');
  url.searchParams.set('start', String(params.start ?? 0));
  if (params.location.trim()) {
    url.searchParams.set('location', params.location.trim());
  }
  if (params.remoteOnly) {
    // f_WT=2 targets Remote on LinkedIn
    url.searchParams.set('f_WT', '2');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`LinkedIn guest API responded ${res.status}`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const results: RawScrapedJob[] = [];

    $('li').each((_, el) => {
      const card = $(el).find('.base-card, .job-search-card').first();
      if (!card.length) return;

      const title = card.find('.base-search-card__title').text().trim();
      const company = card.find('.base-search-card__subtitle').text().trim();
      const loc = card.find('.job-search-card__location').text().trim();
      const rawHref = card.find('a.base-card__full-link').attr('href') || '';
      const cleanHref = rawHref.split('?')[0];
      const urn = card.attr('data-entity-urn') || '';
      const timeEl = card.find('time').first();
      const datetime = timeEl.attr('datetime') || new Date().toISOString();
      const salaryText =
        card.find('.job-search-card__salary-info').text().trim() || null;

      if (!title || !cleanHref) return;
      const jobId = extractLinkedInJobId(cleanHref, urn);

      results.push({
        externalId: jobId,
        linkedinJobId: jobId,
        title,
        company: company || 'Confidential',
        location: loc || (params.remoteOnly ? 'Remote' : params.location || 'Unspecified'),
        countryCode: /\bindia\b/i.test(`${loc} ${params.location}`) ? 'IN' : undefined,
        isRemote:
          params.remoteOnly || /\bremote\b/i.test(`${loc} ${title}`),
        url: cleanHref,
        postedAt: datetime,
        salaryText,
        tags: [params.keywords.includes('Salesforce') ? 'Salesforce' : 'Software'],
        seniorityTags: ['Entry level'],
        description: '',
        excerpt: `Entry-level listing indexed from LinkedIn (${loc || 'Location listed on portal'}). Select to load full role description.`,
        portalId: 'linkedin',
        portalName: 'LinkedIn',
        portalEngine: 'JobSpy',
        portalAttributionUrl: 'https://www.linkedin.com/jobs',
        portalEntryLevelHint: true,
      });
    });

    return results;
  } finally {
    clearTimeout(timeout);
  }
}

export async function scrapeLinkedInJobSpy(params: {
  location: string;
  remoteOnly: boolean;
}): Promise<RawScrapedJob[]> {
  const customLocation = params.location.trim();
  const requests: Array<{ keywords: string; location: string; remoteOnly: boolean }> =
    customLocation
      ? LINKEDIN_QUERIES.map((keywords) => ({
          keywords,
          location: customLocation,
          remoteOnly: params.remoteOnly,
        }))
      : [
          // India Entry-Level Software & Salesforce
          { keywords: 'Software Developer', location: 'India', remoteOnly: params.remoteOnly },
          { keywords: 'Junior Software Engineer', location: 'India', remoteOnly: params.remoteOnly },
          { keywords: 'Salesforce Developer', location: 'India', remoteOnly: params.remoteOnly },
          { keywords: 'Junior Salesforce Developer', location: 'India', remoteOnly: params.remoteOnly },
          // Global Remote Entry-Level Software & Salesforce
          { keywords: 'Software Developer', location: 'Worldwide', remoteOnly: true },
          { keywords: 'Salesforce Developer', location: 'Worldwide', remoteOnly: true },
        ];

  const settled = await Promise.allSettled(
    requests.map((req) =>
      fetchLinkedInSearchPage({
        keywords: req.keywords,
        location: req.location,
        remoteOnly: req.remoteOnly,
        start: 0,
      })
    )
  );

  const seenIds = new Set<string>();
  const combined: RawScrapedJob[] = [];
  let successCount = 0;

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      successCount += 1;
      for (const job of result.value) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          combined.push(job);
        }
      }
    }
  }

  if (successCount === 0) {
    const firstErr = settled.find((s) => s.status === 'rejected') as
      | PromiseRejectedResult
      | undefined;
    throw new Error(
      firstErr?.reason instanceof Error
        ? firstErr.reason.message
        : 'LinkedIn guest search rate-limited or unreachable'
    );
  }

  return combined;
}

const detailCache = new Map<string, LinkedInJobDetailResponse>();

async function fetchLinkedInDetailHtml(linkedinJobId: string): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const res = await fetch(
        `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${linkedinJobId}`,
        {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: controller.signal,
        }
      );
      if (res.ok) {
        return await res.text();
      }
      if (res.status === 429 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 450));
        continue;
      }
      return null;
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

export async function fetchLinkedInJobDetail(
  linkedinJobId: string,
  titleHint = ''
): Promise<LinkedInJobDetailResponse> {
  if (!/^\d+$/.test(linkedinJobId)) {
    throw new Error('Invalid LinkedIn job ID');
  }

  const cached = detailCache.get(linkedinJobId);
  if (cached) return cached;

  const html = await fetchLinkedInDetailHtml(linkedinJobId);
  if (!html) {
    const fallbackAnalysis = analyzeExperience({
      title: titleHint,
      description: '',
      portalEntryLevelHint: true,
    });
    return {
      linkedinJobId,
      description: '',
      seniorityLevel: 'Entry level',
      employmentType: null,
      jobFunction: null,
      industries: null,
      descriptionUnavailable: true,
      fallbackNotice:
        'LinkedIn temporarily rate-limited full description preview for this role. Use the Apply on LinkedIn link above to read the complete job posting.',
      experienceAnalysis: {
        tier: fallbackAnalysis.tier,
        label: fallbackAnalysis.label,
        reason: fallbackAnalysis.reason,
      },
    };
  }

  const $ = cheerio.load(html);

  const rawDescHtml =
    $('.show-more-less-html__markup').html() ||
    $('.description__text').html() ||
    '';
  const description = stripHtmlToText(rawDescHtml);
  const title = $('.top-card-layout__title').text().trim() || titleHint;

  const criteria: Record<string, string> = {};
  $('.description__job-criteria-item').each((_, el) => {
    const label = $(el)
      .find('.description__job-criteria-subheader')
      .text()
      .trim()
      .toLowerCase();
    const val = $(el)
      .find('.description__job-criteria-text')
      .text()
      .trim();
    if (label && val) criteria[label] = val;
  });

  const seniorityLevel = criteria['seniority level'] || null;
  const employmentType = criteria['employment type'] || null;
  const jobFunction = criteria['job function'] || null;
  const industries = criteria['industries'] || null;

  const analysis = analyzeExperience({
    title,
    description,
    seniorityTags: seniorityLevel ? [seniorityLevel] : [],
    portalEntryLevelHint: true,
  });

  const payload: LinkedInJobDetailResponse = {
    linkedinJobId,
    description:
      description ||
      'Full description is hosted directly on LinkedIn. Open the external posting to review requirements.',
    seniorityLevel,
    employmentType,
    jobFunction,
    industries,
    experienceAnalysis: {
      tier: analysis.tier,
      label: analysis.label,
      reason: analysis.reason,
    },
  };

  detailCache.set(linkedinJobId, payload);
  return payload;
}
