import type { PortalId, PortalStatus, ScrapeResponse } from '../../types/jobs';
import {
  scrapeArbeitnow,
  scrapeHimalayas,
  scrapeJobicy,
  scrapeRemoteOK,
  scrapeRemotive,
  scrapeWeWorkRemotely,
} from './communityPortals';
import { scrapeIndeedJobSpy } from './indeedJobSpy';
import { processRawJobs, type RawScrapedJob } from './jobMatcher';
import { scrapeLinkedInJobSpy } from './linkedinJobSpy';
import { scrapeNaukriJobSpy } from './naukriJobSpy';

export const AUTO_REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface PortalDefinition {
  id: PortalId;
  name: string;
  engine: 'JobSpy' | 'Community Portals';
  sourceRepo: string;
  attributionUrl: string;
  description: string;
}

export const PORTAL_DEFINITIONS: PortalDefinition[] = [
  {
    id: 'linkedin',
    name: 'LinkedIn',
    engine: 'JobSpy',
    sourceRepo: 'https://github.com/speedyapply/JobSpy',
    attributionUrl: 'https://www.linkedin.com/jobs',
    description: 'Guest Jobs API across India & Global Remote (Internship & Entry-Level f_E=1,2)',
  },
  {
    id: 'indeed',
    name: 'Indeed',
    engine: 'JobSpy',
    sourceRepo: 'https://github.com/speedyapply/JobSpy',
    attributionUrl: 'https://in.indeed.com',
    description: 'Indeed GraphQL API covering India (IN) & Global Remote listings',
  },
  {
    id: 'naukri',
    name: 'Naukri',
    engine: 'JobSpy',
    sourceRepo: 'https://github.com/speedyapply/JobSpy',
    attributionUrl: 'https://www.naukri.com',
    description: 'Naukri v3 search API with RSA nkparam token filtered to 0–2 yrs in India',
  },
  {
    id: 'remotive',
    name: 'Remotive',
    engine: 'Community Portals',
    sourceRepo: 'https://github.com/ai-job-search-dev/community-portals',
    attributionUrl: 'https://remotive.com',
    description: 'Public remote software engineering & Salesforce job feed',
  },
  {
    id: 'arbeitnow',
    name: 'Arbeitnow',
    engine: 'Community Portals',
    sourceRepo: 'https://github.com/ai-job-search-dev/community-portals',
    attributionUrl: 'https://www.arbeitnow.com',
    description: 'Tech & developer board covering Europe and remote roles',
  },
  {
    id: 'remoteok',
    name: 'RemoteOK',
    engine: 'Community Portals',
    sourceRepo: 'https://github.com/ai-job-search-dev/community-portals',
    attributionUrl: 'https://remoteok.com',
    description: 'Global remote engineering & developer API feed',
  },
  {
    id: 'jobicy',
    name: 'Jobicy',
    engine: 'Community Portals',
    sourceRepo: 'https://github.com/ai-job-search-dev/community-portals',
    attributionUrl: 'https://jobicy.com',
    description: 'Remote engineering & CRM roles with seniority metadata',
  },
  {
    id: 'weworkremotely',
    name: 'We Work Remotely',
    engine: 'Community Portals',
    sourceRepo: 'https://github.com/ai-job-search-dev/community-portals',
    attributionUrl: 'https://weworkremotely.com',
    description: 'Programming category RSS feed adapter',
  },
  {
    id: 'himalayas',
    name: 'Himalayas',
    engine: 'Community Portals',
    sourceRepo: 'https://github.com/ai-job-search-dev/community-portals',
    attributionUrl: 'https://himalayas.app',
    description: 'Structured remote tech job feed with explicit seniority tags',
  },
];

interface CacheEntry {
  expiresAt: number;
  response: ScrapeResponse;
}

const scrapeCache = new Map<string, CacheEntry>();

function buildFallbackSeed(): RawScrapedJob[] {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();
  return [
    {
      externalId: 'seed-sf-in-1',
      title: 'Junior Salesforce Developer (Apex / LWC)',
      company: 'CloudBridge India',
      location: 'Bengaluru, India',
      countryCode: 'IN',
      isRemote: false,
      url: 'https://www.naukri.com',
      postedAt: hoursAgo(4),
      salaryMin: 600000,
      salaryMax: 1000000,
      salaryCurrency: 'INR',
      jobType: 'Full-time',
      tags: ['Salesforce', 'Apex', 'LWC', 'SOQL'],
      structuredMinExp: 0,
      structuredMaxExp: 2,
      description:
        'Seeking a Junior Salesforce Developer with 0-2 years of experience building Apex triggers, Lightning Web Components (LWC), and Flows across Sales Cloud and Service Cloud.',
      portalId: 'naukri',
      portalName: 'Naukri',
      portalEngine: 'JobSpy',
      portalAttributionUrl: 'https://www.naukri.com',
    },
    {
      externalId: 'seed-sw-in-1',
      title: 'Associate Software Developer (React / Node.js)',
      company: 'Northstar FinTech',
      location: 'Hyderabad, India',
      countryCode: 'IN',
      isRemote: false,
      url: 'https://in.indeed.com',
      postedAt: hoursAgo(6),
      salaryMin: 700000,
      salaryMax: 1200000,
      salaryCurrency: 'INR',
      jobType: 'Full-time',
      tags: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
      seniorityTags: ['Junior'],
      description:
        'Entry-level Software Developer role for graduates or engineers with 0-2 years of experience in React, TypeScript, and REST APIs.',
      portalId: 'indeed',
      portalName: 'Indeed',
      portalEngine: 'JobSpy',
      portalAttributionUrl: 'https://in.indeed.com',
    },
    {
      externalId: 'seed-sf-gl-1',
      title: 'Associate Salesforce Platform Engineer',
      company: 'Veridian Cloud Global',
      location: 'Worldwide (Remote)',
      isRemote: true,
      url: 'https://www.linkedin.com/jobs',
      postedAt: hoursAgo(10),
      salaryMin: 65000,
      salaryMax: 85000,
      salaryCurrency: 'USD',
      jobType: 'Full-time',
      tags: ['Salesforce', 'SFDC', 'Integration', 'REST API'],
      seniorityTags: ['Entry-Level'],
      description:
        '1-2 years of Salesforce development experience working with Apex classes, batch jobs, LWC, and CRM data modeling. Open to candidates worldwide.',
      portalId: 'linkedin',
      portalName: 'LinkedIn',
      portalEngine: 'JobSpy',
      portalAttributionUrl: 'https://www.linkedin.com/jobs',
      portalEntryLevelHint: true,
    },
  ];
}

export async function runMultiPortalScrape(params: {
  location?: string;
  remoteOnly?: boolean;
  refresh?: boolean;
}): Promise<ScrapeResponse> {
  const location = (params.location || '').trim();
  const remoteOnly = Boolean(params.remoteOnly);
  const cacheKey = `${location.toLowerCase()}::${remoteOnly ? 'remote' : 'all'}`;

  if (!params.refresh) {
    const cached = scrapeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.response, cacheHit: true };
    }
  }

  const runners: Array<{
    def: PortalDefinition;
    run: () => Promise<RawScrapedJob[]>;
  }> = [
    {
      def: PORTAL_DEFINITIONS[0],
      run: () => scrapeLinkedInJobSpy({ location, remoteOnly }),
    },
    {
      def: PORTAL_DEFINITIONS[1],
      run: () => scrapeIndeedJobSpy({ location, remoteOnly }),
    },
    {
      def: PORTAL_DEFINITIONS[2],
      run: () => scrapeNaukriJobSpy({ location, remoteOnly }),
    },
    { def: PORTAL_DEFINITIONS[3], run: scrapeRemotive },
    { def: PORTAL_DEFINITIONS[4], run: scrapeArbeitnow },
    { def: PORTAL_DEFINITIONS[5], run: scrapeRemoteOK },
    { def: PORTAL_DEFINITIONS[6], run: scrapeJobicy },
    { def: PORTAL_DEFINITIONS[7], run: scrapeWeWorkRemotely },
    { def: PORTAL_DEFINITIONS[8], run: scrapeHimalayas },
  ];

  const rawAll: RawScrapedJob[] = [];
  const portalStats: PortalStatus[] = [];
  let totalScanned = 0;

  const results = await Promise.all(
    runners.map(async ({ def, run }) => {
      const started = Date.now();
      try {
        const rawJobs = await run();
        return {
          def,
          rawJobs,
          status: 'ok' as const,
          durationMs: Date.now() - started,
        };
      } catch (err) {
        return {
          def,
          rawJobs: [] as RawScrapedJob[],
          status: 'error' as const,
          durationMs: Date.now() - started,
          errorMessage: err instanceof Error ? err.message : 'Portal fetch failed',
        };
      }
    })
  );

  for (const res of results) {
    totalScanned += res.rawJobs.length;
    rawAll.push(...res.rawJobs);
  }

  let isFallbackData = false;
  let processedJobs = processRawJobs(rawAll);

  const anyPortalOk = results.some((r) => r.status === 'ok');
  if (!anyPortalOk && processedJobs.length === 0) {
    isFallbackData = true;
    processedJobs = processRawJobs(buildFallbackSeed());
  }

  const matchedByPortal = new Map<PortalId, number>();
  for (const job of processedJobs) {
    matchedByPortal.set(
      job.portalId,
      (matchedByPortal.get(job.portalId) || 0) + 1
    );
  }

  for (const res of results) {
    portalStats.push({
      id: res.def.id,
      name: res.def.name,
      engine: res.def.engine,
      sourceRepo: res.def.sourceRepo,
      attributionUrl: res.def.attributionUrl,
      status: res.status,
      scannedCount: res.rawJobs.length,
      matchedCount: matchedByPortal.get(res.def.id) || 0,
      durationMs: res.durationMs,
      errorMessage: res.errorMessage,
    });
  }

  const nowMs = Date.now();
  const response: ScrapeResponse = {
    jobs: processedJobs,
    portalStats,
    fetchedAt: new Date(nowMs).toISOString(),
    nextAutoRefreshAt: new Date(nowMs + AUTO_REFRESH_INTERVAL_MS).toISOString(),
    autoRefreshIntervalMs: AUTO_REFRESH_INTERVAL_MS,
    totalScanned,
    cacheHit: false,
    isFallbackData,
    query: {
      location,
      remoteOnly,
    },
  };

  if (!isFallbackData) {
    scrapeCache.set(cacheKey, {
      expiresAt: nowMs + AUTO_REFRESH_INTERVAL_MS,
      response,
    });
  }

  return response;
}

let schedulerHandle: ReturnType<typeof setInterval> | null = null;

export function startAutoRefreshScheduler(): void {
  if (schedulerHandle) return;
  schedulerHandle = setInterval(() => {
    runMultiPortalScrape({ location: '', remoteOnly: false, refresh: true }).catch(
      (err) => {
        console.error('Scheduled 2-hour auto-refresh failed:', err);
      }
    );
  }, AUTO_REFRESH_INTERVAL_MS);
  if (typeof schedulerHandle.unref === 'function') {
    schedulerHandle.unref();
  }
}
