import type {
  ApplicationStatus,
  EligibilityFilter,
  ExperienceMode,
  JobListing,
  PortalId,
  RoleTrack,
  SavedJobMeta,
} from '../types/jobs';

export type NavView = 'all' | RoleTrack | 'saved';
export type SortOption = 'relevance' | 'newest' | 'salary';

export interface FilterCriteria {
  view: NavView;
  experienceMode: ExperienceMode;
  eligibilityFilter: EligibilityFilter;
  remoteOnly: boolean;
  enabledPortals: Set<PortalId>;
  searchQuery: string;
  locationFilter: string;
  savedStatusFilter: 'all' | ApplicationStatus;
}

const STORAGE_KEY = 'entrystack_saved_jobs_v1';

export function loadSavedJobs(): Record<string, SavedJobMeta> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, SavedJobMeta>;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveSavedJobs(map: Record<string, SavedJobMeta>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

export function filterJobs(
  liveJobs: JobListing[],
  savedJobs: Record<string, SavedJobMeta>,
  criteria: FilterCriteria
): JobListing[] {
  const query = criteria.searchQuery.trim().toLowerCase();
  const locQuery = criteria.locationFilter.trim().toLowerCase();

  let pool: JobListing[];
  if (criteria.view === 'saved') {
    // Merge live job updates with saved snapshots so tracked jobs remain accessible even if rotated off live feed
    const liveById = new Map(liveJobs.map((j) => [j.id, j]));
    pool = Object.entries(savedJobs)
      .filter(([, meta]) => meta.status !== 'none')
      .filter(([, meta]) =>
        criteria.savedStatusFilter === 'all'
          ? true
          : meta.status === criteria.savedStatusFilter
      )
      .map(([id, meta]) => liveById.get(id) || meta.snapshot);
  } else {
    pool = liveJobs;
  }

  return pool.filter((job) => {
    // Role track filter (not applied in 'saved' view unless needed)
    if (criteria.view === 'software' || criteria.view === 'salesforce') {
      if (job.track !== criteria.view) return false;
    }

    // Experience tier, eligibility & portal filters (only filter live browsing views; keep all saved jobs visible in saved view)
    if (criteria.view !== 'saved') {
      if (
        criteria.experienceMode === 'strict_0_2' &&
        job.experienceTier !== 'verified_0_2'
      ) {
        return false;
      }

      if (
        criteria.eligibilityFilter === 'india_global' &&
        job.eligibility !== 'india' &&
        job.eligibility !== 'global'
      ) {
        return false;
      }
      if (
        criteria.eligibilityFilter === 'india' &&
        job.eligibility !== 'india'
      ) {
        return false;
      }
      if (
        criteria.eligibilityFilter === 'global' &&
        job.eligibility !== 'global'
      ) {
        return false;
      }

      if (!criteria.enabledPortals.has(job.portalId)) {
        return false;
      }
    }

    if (criteria.remoteOnly && !job.isRemote) {
      return false;
    }

    if (locQuery) {
      const locHaystack = `${job.location} ${job.isRemote ? 'remote' : ''}`.toLowerCase();
      if (!locHaystack.includes(locQuery)) return false;
    }

    if (query) {
      const haystack = [
        job.title,
        job.company,
        job.location,
        job.portalName,
        job.experienceLabel,
        ...job.matchedKeywords,
        ...job.tags,
        job.excerpt,
      ]
        .join(' ')
        .toLowerCase();

      const tokens = query.split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        if (!haystack.includes(token)) return false;
      }
    }

    return true;
  });
}

export function sortJobs(jobs: JobListing[], sortBy: SortOption): JobListing[] {
  const copy = [...jobs];
  if (sortBy === 'newest') {
    return copy.sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));
  }
  if (sortBy === 'salary') {
    const val = (j: JobListing) => j.salaryMax ?? j.salaryMin ?? -1;
    return copy.sort((a, b) => {
      const diff = val(b) - val(a);
      if (diff !== 0) return diff;
      return b.relevanceScore - a.relevanceScore;
    });
  }
  // relevance
  return copy.sort((a, b) => {
    if (a.experienceTier !== b.experienceTier) {
      return a.experienceTier === 'verified_0_2' ? -1 : 1;
    }
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    return Date.parse(b.postedAt) - Date.parse(a.postedAt);
  });
}

export function formatRelativeDate(isoDate: string, nowMs = Date.now()): string {
  const ts = Date.parse(isoDate);
  if (Number.isNaN(ts)) return 'Recent';
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 3600) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    return `${mins}m ago`;
  }
  if (diffSec < 86400) {
    return `${Math.floor(diffSec / 3600)}h ago`;
  }
  const days = Math.floor(diffSec / 86400);
  if (days < 30) {
    return `${days}d ago`;
  }
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function escapeCsvCell(value: string): string {
  const str = value ?? '';
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function jobsToCsv(
  jobs: JobListing[],
  savedJobs: Record<string, SavedJobMeta>
): string {
  const headers = [
    'Title',
    'Company',
    'Track',
    'Experience',
    'Eligibility',
    'Location',
    'Remote',
    'Salary',
    'Portal',
    'Engine',
    'Posted',
    'Status',
    'URL',
  ];

  const rows = jobs.map((job) => {
    const status = savedJobs[job.id]?.status || 'none';
    return [
      job.title,
      job.company,
      job.track === 'salesforce' ? 'Salesforce Developer' : 'Software Developer',
      job.experienceLabel,
      job.eligibilityLabel,
      job.location,
      job.isRemote ? 'Yes' : 'No',
      job.salaryText || '',
      job.portalName,
      job.portalEngine,
      job.postedAt.slice(0, 10),
      status === 'none' ? '' : status,
      job.url,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
