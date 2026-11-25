import type { RawScrapedJob } from './jobMatcher';

const INDEED_GRAPHQL_URL = 'https://apis.indeed.com/graphql';
const INDEED_API_KEY =
  '161092c2017b5bbab13edb12461a62d5a833871e7cad6d9d475304573de67ac8';

interface IndeedGraphQLJob {
  key: string;
  title: string;
  datePublished?: number;
  description?: { text?: string };
  location?: {
    formatted?: { short?: string; long?: string };
    countryCode?: string;
  };
  employer?: { name?: string };
  compensation?: {
    estimated?: {
      baseSalary?: {
        range?: { min?: number; max?: number };
        unitOfWork?: string;
      };
      currencyCode?: string;
    } | null;
    baseSalary?: {
      range?: { min?: number; max?: number };
      unitOfWork?: string;
    } | null;
    currencyCode?: string;
  } | null;
  attributes?: Array<{ label?: string }>;
}

interface IndeedGraphQLResponse {
  data?: {
    jobSearch?: {
      results?: Array<{ job?: IndeedGraphQLJob }>;
    };
  };
}

function escapeGraphQLString(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function queryIndeedGraphQL(params: {
  what: string;
  where: string;
  countryCode: 'IN' | 'US';
  locale: string;
  limit?: number;
}): Promise<RawScrapedJob[]> {
  const whatEsc = escapeGraphQLString(params.what);
  const whereClause = params.where.trim()
    ? `, location: { where: "${escapeGraphQLString(params.where.trim())}", radius: 50, radiusUnit: MILES }`
    : '';

  const query = `query GetJobData {
    jobSearch(what: "${whatEsc}"${whereClause}, limit: ${params.limit ?? 15}, sort: DATE) {
      results {
        job {
          key
          title
          datePublished
          description { text }
          location { formatted { short long } countryCode }
          employer { name }
          compensation {
            estimated { baseSalary { range { ... on Range { min max } } unitOfWork } currencyCode }
            baseSalary { range { ... on Range { min max } } unitOfWork }
            currencyCode
          }
          attributes { label }
        }
      }
    }
  }`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7500);
  try {
    const res = await fetch(INDEED_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'indeed-api-key': INDEED_API_KEY,
        accept: 'application/json',
        'indeed-locale': params.locale,
        'indeed-co': params.countryCode,
        'user-agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Indeed App 193.1',
        'indeed-app-info':
          'appv=193.1; appid=com.indeed.jobsearch; osv=16.6.1; os=ios; dtype=phone',
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Indeed GraphQL API responded ${res.status}`);
    }

    const json = (await res.json()) as IndeedGraphQLResponse;
    const rows = json.data?.jobSearch?.results || [];
    const domain =
      params.countryCode === 'IN' ? 'in.indeed.com' : 'www.indeed.com';

    const jobs: RawScrapedJob[] = [];
    for (const row of rows) {
      const job = row.job;
      if (!job || !job.key || !job.title) continue;

      const locText =
        job.location?.formatted?.short ||
        job.location?.formatted?.long ||
        params.where ||
        (params.countryCode === 'IN' ? 'India' : 'Remote');

      const country = job.location?.countryCode || params.countryCode;
      const attrs = (job.attributes || [])
        .map((a) => a.label || '')
        .filter(Boolean);

      const isRemote =
        /\bremote\b/i.test(`${locText} ${job.title} ${attrs.join(' ')}`);

      const comp = job.compensation;
      const baseRange =
        comp?.baseSalary?.range || comp?.estimated?.baseSalary?.range;
      const unit =
        comp?.baseSalary?.unitOfWork ||
        comp?.estimated?.baseSalary?.unitOfWork ||
        'YEAR';
      const currency =
        comp?.currencyCode ||
        comp?.estimated?.currencyCode ||
        (country === 'IN' ? 'INR' : 'USD');

      // Normalize monthly salaries to annual when clearly monthly
      let salaryMin = baseRange?.min ?? null;
      let salaryMax = baseRange?.max ?? null;
      if (unit === 'MONTH') {
        if (salaryMin) salaryMin *= 12;
        if (salaryMax) salaryMax *= 12;
      }

      const jobType =
        attrs.find((a) =>
          /\b(full-time|part-time|internship|contract|fresher)\b/i.test(a)
        ) || null;

      jobs.push({
        externalId: job.key,
        title: job.title,
        company: job.employer?.name || 'Confidential',
        location: locText,
        countryCode: country,
        isRemote,
        url: `https://${domain}/viewjob?jk=${encodeURIComponent(job.key)}`,
        postedAt: job.datePublished
          ? new Date(job.datePublished).toISOString()
          : new Date().toISOString(),
        salaryMin,
        salaryMax,
        salaryCurrency: currency,
        jobType,
        tags: attrs.slice(0, 6),
        description: job.description?.text || '',
        portalId: 'indeed',
        portalName: 'Indeed',
        portalEngine: 'JobSpy',
        portalAttributionUrl: `https://${domain}`,
      });
    }

    return jobs;
  } finally {
    clearTimeout(timeout);
  }
}

export async function scrapeIndeedJobSpy(params: {
  location: string;
  remoteOnly: boolean;
}): Promise<RawScrapedJob[]> {
  const loc = params.location.trim();
  const requests: Array<{
    what: string;
    where: string;
    countryCode: 'IN' | 'US';
    locale: string;
    limit: number;
  }> = [];

  if (loc) {
    const isIndiaLoc =
      /\b(india|bengaluru|bangalore|hyderabad|pune|mumbai|delhi|noida|gurgaon|gurugram|chennai|kolkata|ahmedabad|jaipur|kochi|chandigarh|indore)\b/i.test(
        loc
      );
    const countryCode: 'IN' | 'US' = isIndiaLoc ? 'IN' : 'US';
    const locale = isIndiaLoc ? 'en-IN' : 'en-US';
    requests.push(
      { what: 'Software Developer Junior Fresher', where: loc, countryCode, locale, limit: 15 },
      { what: 'Salesforce Developer', where: loc, countryCode, locale, limit: 15 }
    );
  } else {
    // Default: India + Global Remote coverage
    requests.push(
      {
        what: params.remoteOnly ? 'Junior Software Developer Remote' : 'Junior Software Developer Fresher',
        where: 'India',
        countryCode: 'IN',
        locale: 'en-IN',
        limit: 18,
      },
      {
        what: params.remoteOnly ? 'Salesforce Developer Remote' : 'Salesforce Developer',
        where: 'India',
        countryCode: 'IN',
        locale: 'en-IN',
        limit: 18,
      },
      {
        what: 'Junior Software Developer Remote',
        where: 'Remote',
        countryCode: 'US',
        locale: 'en-US',
        limit: 12,
      },
      {
        what: 'Junior Salesforce Developer Remote',
        where: 'Remote',
        countryCode: 'US',
        locale: 'en-US',
        limit: 12,
      }
    );
  }

  const settled = await Promise.allSettled(
    requests.map((req) => queryIndeedGraphQL(req))
  );

  const seen = new Set<string>();
  const combined: RawScrapedJob[] = [];
  let okCount = 0;

  for (const res of settled) {
    if (res.status === 'fulfilled') {
      okCount += 1;
      for (const item of res.value) {
        if (!seen.has(item.externalId)) {
          seen.add(item.externalId);
          combined.push(item);
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
        : 'Indeed JobSpy GraphQL API unreachable'
    );
  }

  return combined;
}
