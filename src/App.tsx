import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  MapPin,
  Menu,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { JobDetailPane } from './components/JobDetailPane';
import { JobListRow } from './components/JobListRow';
import { Sidebar } from './components/Sidebar';
import { SourcesModal } from './components/SourcesModal';
import type {
  ApplicationStatus,
  EligibilityFilter,
  ExperienceMode,
  JobListing,
  PortalId,
  PortalStatus,
  SavedJobMeta,
  ScrapeResponse,
} from './types/jobs';
import {
  filterJobs,
  jobsToCsv,
  loadSavedJobs,
  saveSavedJobs,
  sortJobs,
  type NavView,
  type SortOption,
} from './utils/jobFilters';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const ALL_PORTAL_IDS: PortalId[] = [
  'linkedin',
  'indeed',
  'naukri',
  'remotive',
  'arbeitnow',
  'remoteok',
  'jobicy',
  'weworkremotely',
  'himalayas',
];

function formatCountdown(targetIso: string | null, nowMs: number): string {
  if (!targetIso) return '2h 0m';
  const remainingMs = Math.min(
    TWO_HOURS_MS,
    Math.max(0, Date.parse(targetIso) - nowMs)
  );
  const totalMins = Math.ceil(remainingMs / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

const VIEW_LABELS: Record<NavView, string> = {
  all: 'All 0–2 Year Roles',
  software: 'Software Developer',
  salesforce: 'Salesforce Developer',
  saved: 'Saved & Applied',
};

export default function App() {
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [portalStats, setPortalStats] = useState<PortalStatus[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [nextAutoRefreshAt, setNextAutoRefreshAt] = useState<string | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [nowTickMs, setNowTickMs] = useState(() => Date.now());
  const [totalScanned, setTotalScanned] = useState(0);
  const [cacheHit, setCacheHit] = useState(false);
  const [isFallbackData, setIsFallbackData] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & navigation
  const [activeView, setActiveView] = useState<NavView>('all');
  const [eligibilityFilter, setEligibilityFilter] =
    useState<EligibilityFilter>('india_global');
  const [experienceMode, setExperienceMode] =
    useState<ExperienceMode>('strict_0_2');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [enabledPortals, setEnabledPortals] = useState<Set<PortalId>>(
    () => new Set(ALL_PORTAL_IDS)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [appliedLocation, setAppliedLocation] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [savedStatusFilter, setSavedStatusFilter] = useState<
    'all' | ApplicationStatus
  >('all');

  // Selection & UI overlays
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sourcesModalOpen, setSourcesModalOpen] = useState(false);

  // Persisted application tracker
  const [savedJobs, setSavedJobs] = useState<Record<string, SavedJobMeta>>(() =>
    loadSavedJobs()
  );

  useEffect(() => {
    saveSavedJobs(savedJobs);
  }, [savedJobs]);

  const fetchListings = useCallback(
    async (opts?: { location?: string; remoteOnly?: boolean; refresh?: boolean }) => {
      const loc = opts?.location ?? appliedLocation;
      const remote = opts?.remoteOnly ?? remoteOnly;
      const isRefresh = Boolean(opts?.refresh);

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        if (loc.trim()) params.set('location', loc.trim());
        if (remote) params.set('remoteOnly', 'true');
        if (isRefresh) params.set('refresh', 'true');

        const res = await fetch(`/api/jobs?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Server responded ${res.status}`);
        }
        const data = (await res.json()) as ScrapeResponse;
        setJobs(data.jobs);
        setPortalStats(data.portalStats);
        setFetchedAt(data.fetchedAt);
        setNextAutoRefreshAt(
          data.nextAutoRefreshAt ||
            new Date(Date.now() + TWO_HOURS_MS).toISOString()
        );
        setNowTickMs(Date.now());
        setTotalScanned(data.totalScanned);
        setCacheHit(data.cacheHit);
        setIsFallbackData(data.isFallbackData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load job listings'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appliedLocation, remoteOnly]
  );

  useEffect(() => {
    fetchListings({ location: appliedLocation, remoteOnly, refresh: false });
  }, [appliedLocation, remoteOnly, fetchListings]);

  // 2-hour automatic refresh scheduler & gentle 30s countdown tick
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const tickId = window.setInterval(() => {
      const now = Date.now();
      setNowTickMs(now);
      if (nextAutoRefreshAt && now >= Date.parse(nextAutoRefreshAt)) {
        fetchListings({ refresh: true });
      }
    }, 30_000);
    return () => window.clearInterval(tickId);
  }, [autoRefreshEnabled, nextAutoRefreshAt, fetchListings]);

  const nextRefreshLabel = useMemo(
    () => formatCountdown(nextAutoRefreshAt, nowTickMs),
    [nextAutoRefreshAt, nowTickMs]
  );

  // Derived sidebar counts respecting current eligibility, experienceMode & portal selection
  const { trackCounts, portalVisibleCounts } = useMemo(() => {
    const scopeBase = jobs.filter((job) => {
      if (
        experienceMode === 'strict_0_2' &&
        job.experienceTier !== 'verified_0_2'
      ) {
        return false;
      }
      if (
        eligibilityFilter === 'india_global' &&
        job.eligibility !== 'india' &&
        job.eligibility !== 'global'
      ) {
        return false;
      }
      if (eligibilityFilter === 'india' && job.eligibility !== 'india') {
        return false;
      }
      if (eligibilityFilter === 'global' && job.eligibility !== 'global') {
        return false;
      }
      if (remoteOnly && !job.isRemote) return false;
      return true;
    });

    const pCounts: Partial<Record<PortalId, number>> = {};
    for (const job of scopeBase) {
      pCounts[job.portalId] = (pCounts[job.portalId] || 0) + 1;
    }

    const base = scopeBase.filter((job) => enabledPortals.has(job.portalId));
    const software = base.filter((j) => j.track === 'software').length;
    const salesforce = base.filter((j) => j.track === 'salesforce').length;
    const saved = Object.values(savedJobs).filter(
      (m) => m.status !== 'none'
    ).length;

    return {
      portalVisibleCounts: pCounts,
      trackCounts: {
        all: base.length,
        software,
        salesforce,
        saved,
      },
    };
  }, [jobs, eligibilityFilter, experienceMode, remoteOnly, enabledPortals, savedJobs]);

  const filteredJobs = useMemo(() => {
    const matched = filterJobs(jobs, savedJobs, {
      view: activeView,
      eligibilityFilter,
      experienceMode,
      remoteOnly,
      enabledPortals,
      searchQuery,
      locationFilter: locationInput,
      savedStatusFilter,
    });
    return sortJobs(matched, sortBy);
  }, [
    jobs,
    savedJobs,
    activeView,
    eligibilityFilter,
    experienceMode,
    remoteOnly,
    enabledPortals,
    searchQuery,
    locationInput,
    savedStatusFilter,
    sortBy,
  ]);

  // Keep a valid job selected on desktop whenever filtered list changes
  const selectedJob = useMemo(() => {
    if (filteredJobs.length === 0) return null;
    return (
      filteredJobs.find((j) => j.id === selectedJobId) || filteredJobs[0]
    );
  }, [filteredJobs, selectedJobId]);

  const handleSelectJob = (job: JobListing) => {
    setSelectedJobId(job.id);
    setMobileDetailOpen(true);
  };

  const handleToggleSave = (job: JobListing) => {
    setSavedJobs((prev) => {
      const current = prev[job.id];
      if (current && current.status !== 'none') {
        const next = { ...prev };
        delete next[job.id];
        return next;
      }
      return {
        ...prev,
        [job.id]: {
          status: 'saved',
          notes: current?.notes || '',
          updatedAt: new Date().toISOString(),
          snapshot: job,
        },
      };
    });
  };

  const handleStatusChange = (job: JobListing, status: ApplicationStatus) => {
    setSavedJobs((prev) => {
      if (status === 'none') {
        const next = { ...prev };
        delete next[job.id];
        return next;
      }
      return {
        ...prev,
        [job.id]: {
          status,
          notes: prev[job.id]?.notes || '',
          updatedAt: new Date().toISOString(),
          snapshot: job,
        },
      };
    });
  };

  const handleNotesChange = (job: JobListing, notes: string) => {
    setSavedJobs((prev) => {
      const existing = prev[job.id];
      return {
        ...prev,
        [job.id]: {
          status: existing?.status && existing.status !== 'none' ? existing.status : 'saved',
          notes,
          updatedAt: new Date().toISOString(),
          snapshot: job,
        },
      };
    });
  };

  const handleTogglePortal = (id: PortalId) => {
    setEnabledPortals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedLocation(locationInput.trim());
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setLocationInput('');
    setAppliedLocation('');
    setEligibilityFilter('india_global');
    setRemoteOnly(false);
    setEnabledPortals(new Set(ALL_PORTAL_IDS));
    setSavedStatusFilter('all');
    if (activeView === 'saved') {
      setActiveView('all');
    }
  };

  const handleExportCsv = () => {
    const csv = jobsToCsv(filteredJobs, savedJobs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `entrystack-${activeView}-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    locationInput.trim().length > 0 ||
    eligibilityFilter !== 'india_global' ||
    remoteOnly ||
    enabledPortals.size < ALL_PORTAL_IDS.length ||
    savedStatusFilter !== 'all';

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeView={activeView}
        onSelectView={(view) => {
          setActiveView(view);
          setMobileDetailOpen(false);
        }}
        counts={trackCounts}
        eligibilityFilter={eligibilityFilter}
        onEligibilityFilterChange={setEligibilityFilter}
        experienceMode={experienceMode}
        onExperienceModeChange={setExperienceMode}
        remoteOnly={remoteOnly}
        onRemoteOnlyChange={setRemoteOnly}
        portals={portalStats}
        portalVisibleCounts={portalVisibleCounts}
        enabledPortals={enabledPortals}
        onTogglePortal={handleTogglePortal}
        onEnableAllPortals={() => setEnabledPortals(new Set(ALL_PORTAL_IDS))}
        autoRefreshEnabled={autoRefreshEnabled}
        onAutoRefreshToggle={setAutoRefreshEnabled}
        nextRefreshLabel={nextRefreshLabel}
        onOpenSourcesModal={() => setSourcesModalOpen(true)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Workspace Column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen xl:h-screen xl:overflow-hidden">
        {/* Top Bar Contract: Breadcrumb on left, max 2 actions on right */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation and filters"
              className="lg:hidden rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-sm min-w-0"
            >
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">
                Listings
              </span>
              <span
                aria-hidden="true"
                className="text-slate-300 hidden sm:inline"
              >
                /
              </span>
              <h1 className="font-display font-semibold text-slate-900 truncate">
                {VIEW_LABELS[activeView]}
              </h1>
            </nav>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredJobs.length === 0}
              aria-label="Export listings to CSV"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => fetchListings({ refresh: true })}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
              />
              <span>{refreshing ? 'Scraping…' : 'Refresh Jobs'}</span>
            </button>
          </div>
        </header>

        {/* Summary Metric Strip (Single-Elevation Hairline Grid) */}
        <section
          aria-label="Listings summary"
          className="grid grid-cols-2 lg:grid-cols-4 border-b border-slate-200 bg-white divide-x divide-y lg:divide-y-0 divide-slate-200 shrink-0"
        >
          <div className="px-5 py-3">
            <div className="text-xs text-slate-500">Matching Listings</div>
            <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-slate-900">
              {loading ? '—' : filteredJobs.length}
            </div>
          </div>
          <div className="px-5 py-3">
            <div className="text-xs text-slate-500">Software Dev (0–2 yr)</div>
            <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-slate-900">
              {loading ? '—' : trackCounts.software}
            </div>
          </div>
          <div className="px-5 py-3">
            <div className="text-xs text-slate-500">Salesforce Dev (0–2 yr)</div>
            <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-sky-700">
              {loading ? '—' : trackCounts.salesforce}
            </div>
          </div>
          <div className="px-5 py-3">
            <div className="text-xs text-slate-500">Saved &amp; Tracked</div>
            <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-blue-700">
              {trackCounts.saved}
            </div>
          </div>
        </section>

        {/* Search, Location & Sort Toolbar */}
        <section
          aria-label="Search and sort listings"
          className="border-b border-slate-200 bg-slate-50/80 px-4 sm:px-6 py-3 shrink-0"
        >
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
            {/* Keyword Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <label htmlFor="job-search-input" className="sr-only">
                Search roles, companies, or skills
              </label>
              <input
                id="job-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by title, company, or skill (React, Python, Apex, LWC, SFDC)..."
                className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search query"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Location Filter Form (submitting also queries LinkedIn JobSpy by location) */}
            <form
              onSubmit={handleLocationSubmit}
              className="relative flex items-center md:w-64 shrink-0"
            >
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <label htmlFor="job-location-input" className="sr-only">
                Filter by location
              </label>
              <input
                id="job-location-input"
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder="Location (USA, India, EU...)"
                className="w-full rounded-md border border-slate-300 bg-white py-2 pl-8 pr-12 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <button
                type="submit"
                className="absolute right-1.5 rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
              >
                Go
              </button>
            </form>

            {/* Saved Status Filter (shown only on Saved view) */}
            {activeView === 'saved' && (
              <div className="flex items-center gap-2 shrink-0">
                <label
                  htmlFor="saved-status-filter"
                  className="text-xs font-medium text-slate-500 whitespace-nowrap"
                >
                  Stage
                </label>
                <select
                  id="saved-status-filter"
                  value={savedStatusFilter}
                  onChange={(e) =>
                    setSavedStatusFilter(
                      e.target.value as 'all' | ApplicationStatus
                    )
                  }
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="all">All Tracked</option>
                  <option value="saved">Saved</option>
                  <option value="applied">Applied</option>
                  <option value="interviewing">Interviewing</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            )}

            {/* Sort Select */}
            <div className="flex items-center gap-2 shrink-0">
              <label
                htmlFor="job-sort-select"
                className="text-xs font-medium text-slate-500 whitespace-nowrap"
              >
                Sort
              </label>
              <select
                id="job-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="relevance">Best 0–2 Yr Fit</option>
                <option value="newest">Newest First</option>
                <option value="salary">Highest Salary</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-md px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 whitespace-nowrap shrink-0"
              >
                Reset
              </button>
            )}
          </div>
        </section>

        {/* Notice Banners (Error or Offline Fallback) */}
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-4 border-b border-red-200 bg-red-50 px-6 py-3 text-xs text-red-800"
          >
            <span>Failed to scrape portals: {error}</span>
            <button
              type="button"
              onClick={() => fetchListings({ refresh: true })}
              className="rounded border border-red-300 bg-white px-2.5 py-1 font-medium text-red-700 hover:bg-red-50 whitespace-nowrap"
            >
              Retry
            </button>
          </div>
        )}

        {isFallbackData && !error && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-xs text-amber-800">
            External job portals are currently unreachable from this network; displaying cached sample listings.
          </div>
        )}

        {/* Main Master-Detail Split Workspace */}
        <main className="flex-1 min-h-0 flex relative xl:overflow-hidden">
          {/* Left Master List Column */}
          <div
            data-testid="job-list-container"
            className={`w-full xl:w-[48%] xl:max-w-[600px] xl:border-r border-slate-200 bg-white overflow-y-auto xl:h-full ${
              mobileDetailOpen ? 'hidden xl:block' : 'block'
            }`}
          >
            {loading ? (
              <div aria-label="Loading job listings" className="divide-y divide-slate-200">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="px-4 py-4 space-y-2 animate-pulse">
                    <div className="flex justify-between gap-4">
                      <div className="h-4 w-2/3 rounded bg-slate-200" />
                      <div className="h-3.5 w-12 rounded bg-slate-100" />
                    </div>
                    <div className="h-3.5 w-1/2 rounded bg-slate-100" />
                    <div className="h-3 w-3/4 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <h2 className="font-display text-sm font-semibold text-slate-900">
                  {activeView === 'saved'
                    ? 'No saved or tracked jobs yet'
                    : 'No matching 0–2 year listings found'}
                </h2>
                <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">
                  {activeView === 'saved'
                    ? 'Bookmark any Software or Salesforce role from the main feed to track your applications and notes here.'
                    : 'Try broadening your keyword search, clearing location filters, or including roles where experience years are unspecified.'}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="rounded-md bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition-colors"
                    >
                      Reset Filters
                    </button>
                  )}
                  {activeView !== 'saved' &&
                    experienceMode === 'strict_0_2' && (
                      <button
                        type="button"
                        onClick={() => setExperienceMode('include_unspecified')}
                        className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Include Unspecified Experience
                      </button>
                    )}
                  {activeView === 'saved' && (
                    <button
                      type="button"
                      onClick={() => setActiveView('all')}
                      className="rounded-md bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition-colors"
                    >
                      Browse All 0–2 Yr Roles
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-2 text-xs text-slate-500">
                  <span>
                    Showing{' '}
                    <strong className="font-mono tabular-nums text-slate-800">
                      {filteredJobs.length}
                    </strong>{' '}
                    {filteredJobs.length === 1 ? 'role' : 'roles'}
                    {appliedLocation ? ` near "${appliedLocation}"` : ''}
                  </span>
                  <span className="font-mono tabular-nums">
                    {totalScanned} scanned
                  </span>
                </div>
                {filteredJobs.map((job) => (
                  <JobListRow
                    key={job.id}
                    job={job}
                    isSelected={selectedJob?.id === job.id}
                    savedStatus={savedJobs[job.id]?.status || 'none'}
                    onSelect={handleSelectJob}
                    onToggleSave={handleToggleSave}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Detail Inspector Column (Desktop Sticky + Mobile Full Panel) */}
          <section
            aria-label="Selected job details"
            className={`flex-1 min-w-0 bg-white xl:h-full ${
              mobileDetailOpen ? 'block w-full' : 'hidden xl:block'
            }`}
          >
            <JobDetailPane
              job={selectedJob}
              savedStatus={
                selectedJob ? savedJobs[selectedJob.id]?.status || 'none' : 'none'
              }
              notes={selectedJob ? savedJobs[selectedJob.id]?.notes || '' : ''}
              onStatusChange={handleStatusChange}
              onNotesChange={handleNotesChange}
              onCloseMobile={
                mobileDetailOpen ? () => setMobileDetailOpen(false) : undefined
              }
            />
          </section>
        </main>
      </div>

      <SourcesModal
        open={sourcesModalOpen}
        onClose={() => setSourcesModalOpen(false)}
        portals={portalStats}
        totalScanned={totalScanned}
        fetchedAt={fetchedAt}
        cacheHit={cacheHit}
        isFallbackData={isFallbackData}
      />
    </div>
  );
}
