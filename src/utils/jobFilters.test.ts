import test from 'node:test';
import assert from 'node:assert/strict';
import type { JobListing, PortalId, SavedJobMeta } from '../types/jobs';
import {
  filterJobs,
  formatRelativeDate,
  jobsToCsv,
  sortJobs,
} from './jobFilters';

const ALL_PORTALS = new Set<PortalId>([
  'linkedin',
  'indeed',
  'naukri',
  'remotive',
  'arbeitnow',
  'remoteok',
  'jobicy',
  'weworkremotely',
  'himalayas',
]);

const SAMPLE_JOBS: JobListing[] = [
  {
    id: 'li-1',
    externalId: '1',
    title: 'Junior Salesforce Developer',
    company: 'CloudBridge, Inc.',
    location: 'Bengaluru, India',
    isRemote: false,
    eligibility: 'india',
    eligibilityLabel: 'India',
    track: 'salesforce',
    matchedKeywords: ['Salesforce Developer', 'Apex Developer'],
    experienceTier: 'verified_0_2',
    experienceLabel: '0–2 yrs',
    experienceReason: 'Explicitly matches 0-2 years',
    portalId: 'linkedin',
    portalName: 'LinkedIn',
    portalEngine: 'JobSpy',
    portalAttributionUrl: 'https://www.linkedin.com/jobs',
    crossPostedPortals: [],
    url: 'https://www.linkedin.com/jobs/view/1',
    postedAt: '2026-11-18T10:00:00.000Z',
    salaryText: '$80k–$95k',
    salaryMin: 80000,
    salaryMax: 95000,
    salaryCurrency: 'USD',
    jobType: 'Full-time',
    tags: ['Apex', 'LWC'],
    excerpt: 'Build Apex triggers and LWC.',
    description: 'Build Apex triggers and LWC.',
    hasFullDescription: true,
    relevanceScore: 88,
  },
  {
    id: 'rem-2',
    externalId: '2',
    title: 'Software Developer',
    company: 'Northstar',
    location: 'Worldwide (Remote)',
    isRemote: true,
    eligibility: 'global',
    eligibilityLabel: 'Global Remote',
    track: 'software',
    matchedKeywords: ['Software Developer'],
    experienceTier: 'unspecified_open',
    experienceLabel: 'Exp. unspecified',
    experienceReason: 'Non-senior role',
    portalId: 'remotive',
    portalName: 'Remotive',
    portalEngine: 'Community Portals',
    portalAttributionUrl: 'https://remotive.com',
    crossPostedPortals: [],
    url: 'https://remotive.com/jobs/2',
    postedAt: '2026-11-19T10:00:00.000Z',
    salaryText: '$105k',
    salaryMin: 105000,
    salaryMax: 105000,
    salaryCurrency: 'USD',
    jobType: 'Full-time',
    tags: ['TypeScript', 'React'],
    excerpt: 'Full-stack TypeScript work.',
    description: 'Full-stack TypeScript work.',
    hasFullDescription: true,
    relevanceScore: 70,
  },
];

test('filterJobs enforces strict_0_2 vs include_unspecified, eligibility, and role track', () => {
  const strict = filterJobs(SAMPLE_JOBS, {}, {
    view: 'all',
    eligibilityFilter: 'india_global',
    experienceMode: 'strict_0_2',
    remoteOnly: false,
    enabledPortals: ALL_PORTALS,
    searchQuery: '',
    locationFilter: '',
    savedStatusFilter: 'all',
  });
  assert.equal(strict.length, 1);
  assert.equal(strict[0].id, 'li-1');

  const globalOnly = filterJobs(SAMPLE_JOBS, {}, {
    view: 'software',
    eligibilityFilter: 'global',
    experienceMode: 'include_unspecified',
    remoteOnly: false,
    enabledPortals: ALL_PORTALS,
    searchQuery: '',
    locationFilter: '',
    savedStatusFilter: 'all',
  });
  assert.equal(globalOnly.length, 1);
  assert.equal(globalOnly[0].id, 'rem-2');

  const indiaOnly = filterJobs(SAMPLE_JOBS, {}, {
    view: 'all',
    eligibilityFilter: 'india',
    experienceMode: 'include_unspecified',
    remoteOnly: false,
    enabledPortals: ALL_PORTALS,
    searchQuery: '',
    locationFilter: '',
    savedStatusFilter: 'all',
  });
  assert.equal(indiaOnly.length, 1);
  assert.equal(indiaOnly[0].id, 'li-1');
});

test('filterJobs searches across tokens and respects saved view', () => {
  const saved: Record<string, SavedJobMeta> = {
    'li-1': {
      status: 'applied',
      notes: 'Sent resume',
      updatedAt: '2026-11-19T00:00:00.000Z',
      snapshot: SAMPLE_JOBS[0],
    },
  };

  const res = filterJobs(SAMPLE_JOBS, saved, {
    view: 'saved',
    eligibilityFilter: 'india_global',
    experienceMode: 'strict_0_2',
    remoteOnly: false,
    enabledPortals: ALL_PORTALS,
    searchQuery: 'apex cloudbridge',
    locationFilter: '',
    savedStatusFilter: 'applied',
  });
  assert.equal(res.length, 1);
  assert.equal(res[0].id, 'li-1');
});

test('sortJobs sorts by newest and highest salary', () => {
  const byNewest = sortJobs(SAMPLE_JOBS, 'newest');
  assert.equal(byNewest[0].id, 'rem-2');

  const bySalary = sortJobs(SAMPLE_JOBS, 'salary');
  assert.equal(bySalary[0].id, 'rem-2');
});

test('jobsToCsv escapes commas cleanly and includes headers', () => {
  const csv = jobsToCsv([SAMPLE_JOBS[0]], {});
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith('Title,Company,Track'));
  assert.ok(lines[1].includes('"CloudBridge, Inc."'));
});

test('formatRelativeDate formats hours and days cleanly', () => {
  const now = Date.parse('2026-11-19T12:00:00.000Z');
  assert.equal(formatRelativeDate('2026-11-19T09:00:00.000Z', now), '3h ago');
  assert.equal(formatRelativeDate('2026-11-17T12:00:00.000Z', now), '2d ago');
});
