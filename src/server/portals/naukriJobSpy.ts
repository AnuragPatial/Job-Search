import crypto from 'node:crypto';
import type { RawScrapedJob } from './jobMatcher';

// Public RSA key & request token algorithm ported from speedyapply/JobSpy (jobspy/naukri/util.py)
const NAUKRI_PUBLIC_KEY_PEM = [
  '-----BEGIN PUBLIC KEY-----',
  'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALrlQ+djR0RjJwBF1xuisHmdFv334MIm',
  'K6LgzJhmLhN7B5yuEyaKoasgXQk3+OQglsOaBxEJ0j5PcTL3nbOvt80CAwEAAQ==',
  '-----END PUBLIC KEY-----',
].join('\n');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export function generateNaukriNkparam(page = 'srp'): string {
  const payload = Buffer.from(`v0|${Date.now()}|121_${page}`);
  return crypto
    .publicEncrypt(
      {
        key: NAUKRI_PUBLIC_KEY_PEM,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      payload
    )
    .toString('base64');
}

interface NaukriPlaceholder {
  type?: string;
  label?: string;
}

interface NaukriJobDetail {
  jobId?: string;
  title?: string;
  companyName?: string;
  jdURL?: string;
  tagsAndSkills?: string;
  placeholders?: NaukriPlaceholder[];
  jobDescription?: string;
  createdDate?: number;
  experienceText?: string;
  minimumExperience?: string | number;
  maximumExperience?: string | number;
  currency?: string;
  salaryDetail?: {
    minimumSalary?: number;
    maximumSalary?: number;
    currency?: string;
    hideSalary?: boolean;
  };
}

interface NaukriSearchResponse {
  jobDetails?: NaukriJobDetail[];
}

async function queryNaukriSearch(params: {
  keyword: string;
  experience: number;
  location?: string;
  remoteOnly?: boolean;
  noOfResults?: number;
}): Promise<RawScrapedJob[]> {
  const url = new URL('https://www.naukri.com/jobapi/v3/search');
  url.searchParams.set('noOfResults', String(params.noOfResults ?? 20));
  url.searchParams.set('urlType', 'search_by_keyword');
  url.searchParams.set('searchType', 'adv');
  url.searchParams.set('keyword', params.keyword);
  url.searchParams.set('experience', String(params.experience));
  url.searchParams.set('pageNo', '1');
  if (params.location && params.location.trim()) {
    url.searchParams.set('location', params.location.trim());
  }
  if (params.remoteOnly) {
    url.searchParams.set('wfhType', '2');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7500);
  try {
    const res = await fetch(url.toString(), {
      headers: {
        appid: '109',
        systemid: 'Naukri',
        nkparam: generateNaukriNkparam('srp'),
        accept: 'application/json',
        'user-agent': USER_AGENT,
        referer: 'https://www.naukri.com/',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Naukri JobSpy API responded ${res.status}`);
    }

    const json = (await res.json()) as NaukriSearchResponse;
    const rows = json.jobDetails || [];
    const results: RawScrapedJob[] = [];

    for (const item of rows) {
      if (!item.jobId || !item.title) continue;

      const locPlaceholder = item.placeholders?.find(
        (p) => p.type === 'location'
      )?.label;
      const salPlaceholder = item.placeholders?.find(
        (p) => p.type === 'salary'
      )?.label;

      const rawLocation = locPlaceholder?.trim() || 'India';
      const location = /\bindia\b/i.test(rawLocation)
        ? rawLocation
        : `${rawLocation}, India`;

      const isRemote =
        Boolean(params.remoteOnly) ||
        /\b(remote|work from home|wfh)\b/i.test(`${rawLocation} ${item.title}`);

      const minExp =
        item.minimumExperience !== undefined && item.minimumExperience !== ''
          ? Number(item.minimumExperience)
          : null;
      const maxExp =
        item.maximumExperience !== undefined && item.maximumExperience !== ''
          ? Number(item.maximumExperience)
          : null;

      const salaryDetail = item.salaryDetail;
      const hasNumericSalary =
        salaryDetail &&
        !salaryDetail.hideSalary &&
        ((salaryDetail.minimumSalary ?? 0) > 0 ||
          (salaryDetail.maximumSalary ?? 0) > 0);

      const salaryText =
        salPlaceholder && !/not disclosed/i.test(salPlaceholder)
          ? salPlaceholder
          : null;

      const tags = (item.tagsAndSkills || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 6);

      const jobUrl = item.jdURL
        ? item.jdURL.startsWith('http')
          ? item.jdURL
          : `https://www.naukri.com${item.jdURL}`
        : `https://www.naukri.com/job-listings-${item.jobId}`;

      const expPrefix = item.experienceText
        ? `Experience required: ${item.experienceText}. `
        : '';

      results.push({
        externalId: String(item.jobId),
        title: item.title.trim(),
        company: item.companyName?.trim() || 'Confidential',
        location,
        countryCode: 'IN',
        isRemote,
        url: jobUrl,
        postedAt: item.createdDate
          ? new Date(item.createdDate).toISOString()
          : new Date().toISOString(),
        salaryMin: hasNumericSalary ? (salaryDetail?.minimumSalary ?? null) : null,
        salaryMax: hasNumericSalary ? (salaryDetail?.maximumSalary ?? null) : null,
        salaryCurrency: salaryDetail?.currency || item.currency || 'INR',
        salaryText,
        jobType: 'Full-time',
        tags,
        description: `${expPrefix}${item.jobDescription || ''}`.trim(),
        structuredMinExp: Number.isFinite(minExp) ? minExp : null,
        structuredMaxExp: Number.isFinite(maxExp) ? maxExp : null,
        portalId: 'naukri',
        portalName: 'Naukri',
        portalEngine: 'JobSpy',
        portalAttributionUrl: 'https://www.naukri.com',
      });
    }

    return results;
  } finally {
    clearTimeout(timeout);
  }
}

export async function scrapeNaukriJobSpy(params: {
  location: string;
  remoteOnly: boolean;
}): Promise<RawScrapedJob[]> {
  const loc = params.location.trim();
  // Avoid filtering Naukri by non-Indian locations like "USA" or "Europe"
  const isNonIndiaLocation =
    loc.length > 0 &&
    /\b(usa|united states|uk|london|europe|germany|canada|australia|berlin|new york|san francisco)\b/i.test(
      loc
    );
  const effectiveLoc = isNonIndiaLocation ? '' : loc;

  const queries = [
    { keyword: 'Software Developer', experience: 1 },
    { keyword: 'Junior Software Engineer', experience: 0 },
    { keyword: 'Salesforce Developer', experience: 1 },
    { keyword: 'Salesforce Apex LWC Developer', experience: 0 },
  ];

  const settled = await Promise.allSettled(
    queries.map((q) =>
      queryNaukriSearch({
        keyword: q.keyword,
        experience: q.experience,
        location: effectiveLoc,
        remoteOnly: params.remoteOnly,
        noOfResults: 20,
      })
    )
  );

  const seen = new Set<string>();
  const combined: RawScrapedJob[] = [];
  let okCount = 0;

  for (const res of settled) {
    if (res.status === 'fulfilled') {
      okCount += 1;
      for (const job of res.value) {
        if (!seen.has(job.externalId)) {
          seen.add(job.externalId);
          combined.push(job);
        }
      }
    }
  }

  if (okCount === 0) {
    const firstErr = settled.find((s) => s.status === 'rejected') as
      | PromiseRejectedResult
      | undefined;
    throw new Error(
      firstErr?.reason instanceof Error
        ? firstErr.reason.message
        : 'Naukri JobSpy API unreachable'
    );
  }

  return combined;
}
