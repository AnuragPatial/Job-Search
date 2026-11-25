import * as cheerio from 'cheerio';
import type { RawScrapedJob } from './jobMatcher';

const USER_AGENT = 'EntryStackJobAggregator/1.0 (+https://github.com/ai-job-search-dev/community-portals)';

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 7000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextWithTimeout(url: string, timeoutMs = 7000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

interface RemotiveResponse {
  jobs?: Array<{
    id: number;
    url: string;
    title: string;
    company_name: string;
    category?: string;
    tags?: string[];
    job_type?: string;
    publication_date: string;
    candidate_required_location?: string;
    salary?: string;
    description?: string;
  }>;
}

export async function scrapeRemotive(): Promise<RawScrapedJob[]> {
  const [devRes, sfRes] = await Promise.allSettled([
    fetchJsonWithTimeout<RemotiveResponse>(
      'https://remotive.com/api/remote-jobs?category=software-dev&limit=80'
    ),
    fetchJsonWithTimeout<RemotiveResponse>(
      'https://remotive.com/api/remote-jobs?search=salesforce&limit=40'
    ),
  ]);

  const map = new Map<number, RawScrapedJob>();
  for (const settled of [devRes, sfRes]) {
    if (settled.status !== 'fulfilled') continue;
    for (const item of settled.value.jobs || []) {
      if (map.has(item.id)) continue;
      map.set(item.id, {
        externalId: String(item.id),
        title: item.title || '',
        company: item.company_name || 'Confidential',
        location: item.candidate_required_location || 'Remote',
        isRemote: true,
        url: item.url,
        postedAt: item.publication_date || new Date().toISOString(),
        salaryText: item.salary || null,
        jobType: item.job_type || null,
        tags: item.tags || [],
        description: item.description || '',
        portalId: 'remotive',
        portalName: 'Remotive',
        portalEngine: 'Community Portals',
        portalAttributionUrl: 'https://remotive.com',
      });
    }
  }

  if (map.size === 0 && devRes.status === 'rejected') {
    throw devRes.reason;
  }
  return Array.from(map.values());
}

interface ArbeitnowResponse {
  data?: Array<{
    slug: string;
    company_name: string;
    title: string;
    description: string;
    remote: boolean;
    url: string;
    tags: string[];
    job_types: string[];
    location: string;
    created_at: number;
  }>;
}

export async function scrapeArbeitnow(): Promise<RawScrapedJob[]> {
  const [p1, p2] = await Promise.allSettled([
    fetchJsonWithTimeout<ArbeitnowResponse>(
      'https://www.arbeitnow.com/api/job-board-api?page=1'
    ),
    fetchJsonWithTimeout<ArbeitnowResponse>(
      'https://www.arbeitnow.com/api/job-board-api?page=2'
    ),
  ]);

  const items: RawScrapedJob[] = [];
  const seen = new Set<string>();

  for (const res of [p1, p2]) {
    if (res.status !== 'fulfilled') continue;
    for (const item of res.value.data || []) {
      if (seen.has(item.slug)) continue;
      seen.add(item.slug);
      items.push({
        externalId: item.slug,
        title: item.title || '',
        company: item.company_name || 'Confidential',
        location: item.location || (item.remote ? 'Remote' : 'Europe'),
        isRemote: Boolean(item.remote),
        url: item.url,
        postedAt: item.created_at
          ? new Date(item.created_at * 1000).toISOString()
          : new Date().toISOString(),
        jobType: item.job_types?.[0] || null,
        tags: item.tags || [],
        description: item.description || '',
        portalId: 'arbeitnow',
        portalName: 'Arbeitnow',
        portalEngine: 'Community Portals',
        portalAttributionUrl: 'https://www.arbeitnow.com',
      });
    }
  }

  if (items.length === 0 && p1.status === 'rejected') {
    throw p1.reason;
  }
  return items;
}

interface RemoteOkItem {
  id?: string | number;
  slug?: string;
  epoch?: number;
  date?: string;
  company?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  apply_url?: string;
  url?: string;
  salary_min?: number;
  salary_max?: number;
}

export async function scrapeRemoteOK(): Promise<RawScrapedJob[]> {
  const data = await fetchJsonWithTimeout<RemoteOkItem[]>(
    'https://remoteok.com/api'
  );
  if (!Array.isArray(data)) return [];

  return data
    .filter((item) => item && item.position && (item.url || item.apply_url))
    .slice(0, 120)
    .map((item) => ({
      externalId: String(item.id || item.slug || Math.random()),
      title: item.position || '',
      company: item.company || 'Confidential',
      location: item.location || 'Remote',
      isRemote: true,
      url: item.url || item.apply_url || 'https://remoteok.com',
      postedAt:
        item.date ||
        (item.epoch ? new Date(item.epoch * 1000).toISOString() : new Date().toISOString()),
      salaryMin: item.salary_min && item.salary_min > 0 ? item.salary_min : null,
      salaryMax: item.salary_max && item.salary_max > 0 ? item.salary_max : null,
      salaryCurrency: 'USD',
      tags: item.tags || [],
      description: item.description || '',
      portalId: 'remoteok',
      portalName: 'RemoteOK',
      portalEngine: 'Community Portals',
      portalAttributionUrl: 'https://remoteok.com',
    }));
}

interface JobicyResponse {
  jobs?: Array<{
    id: number;
    url: string;
    jobTitle: string;
    companyName: string;
    jobIndustry?: string[];
    jobType?: string[];
    jobGeo?: string;
    jobLevel?: string;
    jobExcerpt?: string;
    jobDescription?: string;
    pubDate?: string;
  }>;
}

export async function scrapeJobicy(): Promise<RawScrapedJob[]> {
  const [devRes, sfRes] = await Promise.allSettled([
    fetchJsonWithTimeout<JobicyResponse>(
      'https://jobicy.com/api/v2/remote-jobs?count=50&industry=dev'
    ),
    fetchJsonWithTimeout<JobicyResponse>(
      'https://jobicy.com/api/v2/remote-jobs?count=30&tag=salesforce'
    ),
  ]);

  const map = new Map<number, RawScrapedJob>();
  for (const res of [devRes, sfRes]) {
    if (res.status !== 'fulfilled') continue;
    for (const item of res.value.jobs || []) {
      if (map.has(item.id)) continue;
      map.set(item.id, {
        externalId: String(item.id),
        title: item.jobTitle || '',
        company: item.companyName || 'Confidential',
        location: item.jobGeo || 'Remote',
        isRemote: true,
        url: item.url,
        postedAt: item.pubDate || new Date().toISOString(),
        jobType: item.jobType?.[0] || null,
        tags: item.jobIndustry || [],
        seniorityTags: item.jobLevel ? [item.jobLevel] : [],
        excerpt: item.jobExcerpt || '',
        description: item.jobDescription || item.jobExcerpt || '',
        portalId: 'jobicy',
        portalName: 'Jobicy',
        portalEngine: 'Community Portals',
        portalAttributionUrl: 'https://jobicy.com',
      });
    }
  }

  if (map.size === 0 && devRes.status === 'rejected') {
    throw devRes.reason;
  }
  return Array.from(map.values());
}

export async function scrapeWeWorkRemotely(): Promise<RawScrapedJob[]> {
  const xml = await fetchTextWithTimeout(
    'https://weworkremotely.com/categories/remote-programming-jobs.rss'
  );
  const $ = cheerio.load(xml, { xmlMode: true });
  const results: RawScrapedJob[] = [];

  $('item').each((_, el) => {
    const rawTitle = $(el).find('title').text().trim();
    const link = $(el).find('link').text().trim();
    const guid = $(el).find('guid').text().trim() || link;
    const region = $(el).find('region').text().trim() || 'Remote';
    const jobType = $(el).find('type').text().trim() || null;
    const pubDate = $(el).find('pubDate').text().trim() || new Date().toISOString();
    const description = $(el).find('description').text().trim();

    if (!rawTitle || !link) return;
    // WWR titles are formatted as "Company: Job Title"
    const colonIdx = rawTitle.indexOf(':');
    const company =
      colonIdx > 0 ? rawTitle.slice(0, colonIdx).trim() : 'Confidential';
    const title =
      colonIdx > 0 ? rawTitle.slice(colonIdx + 1).trim() : rawTitle;

    results.push({
      externalId: guid,
      title,
      company,
      location: region,
      isRemote: true,
      url: link,
      postedAt: pubDate,
      jobType,
      tags: ['Programming'],
      description,
      portalId: 'weworkremotely',
      portalName: 'We Work Remotely',
      portalEngine: 'Community Portals',
      portalAttributionUrl: 'https://weworkremotely.com',
    });
  });

  return results;
}

interface HimalayasResponse {
  jobs?: Array<{
    guid: string;
    title: string;
    excerpt?: string;
    companyName: string;
    employmentType?: string;
    minSalary?: number | null;
    maxSalary?: number | null;
    currency?: string | null;
    seniority?: string[];
    locationRestrictions?: string[];
    categories?: string[];
    description?: string;
    pubDate?: number;
    applicationLink?: string;
  }>;
}

export async function scrapeHimalayas(): Promise<RawScrapedJob[]> {
  const data = await fetchJsonWithTimeout<HimalayasResponse>(
    'https://himalayas.app/jobs/api?limit=80'
  );
  return (data.jobs || []).map((item) => {
    const location =
      item.locationRestrictions && item.locationRestrictions.length > 0
        ? `Remote (${item.locationRestrictions.slice(0, 2).join(', ')})`
        : 'Remote (Worldwide)';

    return {
      externalId: item.guid || `${item.companyName}-${item.title}`,
      title: item.title || '',
      company: item.companyName || 'Confidential',
      location,
      isRemote: true,
      url: item.applicationLink || item.guid || 'https://himalayas.app/jobs',
      postedAt: item.pubDate
        ? new Date(item.pubDate * 1000).toISOString()
        : new Date().toISOString(),
      salaryMin: item.minSalary ?? null,
      salaryMax: item.maxSalary ?? null,
      salaryCurrency: item.currency ?? 'USD',
      jobType: item.employmentType || null,
      tags: item.categories || [],
      seniorityTags: item.seniority || [],
      excerpt: item.excerpt || '',
      description: item.description || item.excerpt || '',
      portalId: 'himalayas',
      portalName: 'Himalayas',
      portalEngine: 'Community Portals',
      portalAttributionUrl: 'https://himalayas.app',
    };
  });
}
