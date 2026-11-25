export type RoleTrack = 'software' | 'salesforce';

export type ExperienceTier = 'verified_0_2' | 'unspecified_open';

export type ExperienceMode = 'strict_0_2' | 'include_unspecified';

export type PortalId =
  | 'linkedin'
  | 'indeed'
  | 'naukri'
  | 'remotive'
  | 'arbeitnow'
  | 'remoteok'
  | 'jobicy'
  | 'weworkremotely'
  | 'himalayas';

export type EligibilityRegion = 'india' | 'global' | 'other_region';

export type EligibilityFilter = 'india_global' | 'india' | 'global' | 'all';

export type ApplicationStatus =
  | 'none'
  | 'saved'
  | 'applied'
  | 'interviewing'
  | 'archived';

export interface JobListing {
  id: string;
  externalId: string;
  title: string;
  company: string;
  location: string;
  isRemote: boolean;
  eligibility: EligibilityRegion;
  eligibilityLabel: string;
  track: RoleTrack;
  matchedKeywords: string[];
  experienceTier: ExperienceTier;
  experienceLabel: string;
  experienceReason: string;
  portalId: PortalId;
  portalName: string;
  portalEngine: 'JobSpy' | 'Community Portals';
  portalAttributionUrl: string;
  crossPostedPortals: string[];
  url: string;
  postedAt: string;
  salaryText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  jobType: string | null;
  tags: string[];
  excerpt: string;
  description: string;
  hasFullDescription: boolean;
  linkedinJobId?: string;
  relevanceScore: number;
}

export interface PortalStatus {
  id: PortalId;
  name: string;
  engine: 'JobSpy' | 'Community Portals';
  sourceRepo: string;
  attributionUrl: string;
  status: 'ok' | 'error' | 'skipped';
  scannedCount: number;
  matchedCount: number;
  durationMs: number;
  errorMessage?: string;
}

export interface ScrapeResponse {
  jobs: JobListing[];
  portalStats: PortalStatus[];
  fetchedAt: string;
  nextAutoRefreshAt: string;
  autoRefreshIntervalMs: number;
  totalScanned: number;
  cacheHit: boolean;
  isFallbackData: boolean;
  query: {
    location: string;
    remoteOnly: boolean;
  };
}

export interface LinkedInJobDetailResponse {
  linkedinJobId: string;
  description: string;
  seniorityLevel: string | null;
  employmentType: string | null;
  jobFunction: string | null;
  industries: string | null;
  descriptionUnavailable?: boolean;
  fallbackNotice?: string;
  experienceAnalysis: {
    tier: ExperienceTier | 'senior_excluded';
    label: string;
    reason: string;
  };
}

export interface SavedJobMeta {
  status: ApplicationStatus;
  notes: string;
  updatedAt: string;
  snapshot: JobListing;
}
