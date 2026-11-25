import { useState } from 'react';
import {
  Bookmark,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Cloud,
  Code2,
  Database,
  X,
} from 'lucide-react';
import type {
  EligibilityFilter,
  ExperienceMode,
  PortalId,
  PortalStatus,
} from '../types/jobs';
import type { NavView } from '../utils/jobFilters';

interface SidebarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  counts: {
    all: number;
    software: number;
    salesforce: number;
    saved: number;
  };
  eligibilityFilter: EligibilityFilter;
  onEligibilityFilterChange: (filter: EligibilityFilter) => void;
  experienceMode: ExperienceMode;
  onExperienceModeChange: (mode: ExperienceMode) => void;
  remoteOnly: boolean;
  onRemoteOnlyChange: (remote: boolean) => void;
  portals: PortalStatus[];
  portalVisibleCounts: Partial<Record<PortalId, number>>;
  enabledPortals: Set<PortalId>;
  onTogglePortal: (id: PortalId) => void;
  onEnableAllPortals: () => void;
  autoRefreshEnabled: boolean;
  onAutoRefreshToggle: (enabled: boolean) => void;
  nextRefreshLabel: string;
  onOpenSourcesModal: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const KEYWORD_REFERENCE = {
  software: [
    'Software Developer',
    'Software Engineer / SWE',
    'Full-Stack / Frontend / Backend',
    'Junior / Associate / Graduate Dev',
    'React / Node / Python / Java Dev',
  ],
  salesforce: [
    'Salesforce Developer',
    'SFDC Developer / Engineer',
    'Apex / LWC / Lightning Dev',
    'Platform Developer',
    'Salesforce Technical Consultant',
  ],
};

export function Sidebar({
  activeView,
  onSelectView,
  counts,
  eligibilityFilter,
  onEligibilityFilterChange,
  experienceMode,
  onExperienceModeChange,
  remoteOnly,
  onRemoteOnlyChange,
  portals,
  portalVisibleCounts,
  enabledPortals,
  onTogglePortal,
  onEnableAllPortals,
  autoRefreshEnabled,
  onAutoRefreshToggle,
  nextRefreshLabel,
  onOpenSourcesModal,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const [keywordsOpen, setKeywordsOpen] = useState(false);

  const navItems: Array<{
    id: NavView;
    label: string;
    count: number;
    icon: typeof Briefcase;
  }> = [
    { id: 'all', label: 'All 0–2 Yr Roles', count: counts.all, icon: Briefcase },
    { id: 'software', label: 'Software Developer', count: counts.software, icon: Code2 },
    { id: 'salesforce', label: 'Salesforce Developer', count: counts.salesforce, icon: Cloud },
    { id: 'saved', label: 'Saved & Applied', count: counts.saved, icon: Bookmark },
  ];

  const allPortalsEnabled =
    portals.length > 0 && portals.every((p) => enabledPortals.has(p.id));

  const content = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      {/* Brand Wordmark */}
      <div className="flex h-14 items-center justify-between px-5 border-b border-slate-200 shrink-0">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectView('all');
            onCloseMobile();
          }}
          className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          EntryStack
        </a>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Filter & Navigation Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        {/* Role Tracks Navigation */}
        <nav aria-label="Role tracks" className="space-y-1">
          <div className="px-2 pb-1.5 text-xs font-medium text-slate-500">
            Role Tracks
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectView(item.id);
                  onCloseMobile();
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-blue-700' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                <span
                  className={`font-mono text-xs tabular-nums ml-2 shrink-0 ${
                    isActive ? 'text-blue-700 font-semibold' : 'text-slate-500'
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200" />

        {/* Eligibility Filter (India & Global default) */}
        <div className="space-y-2">
          <div className="px-1 text-xs font-medium text-slate-500">
            Eligibility
          </div>
          <div
            role="group"
            aria-label="Region eligibility filter"
            className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1"
          >
            {(
              [
                { id: 'india_global', label: 'India & Global' },
                { id: 'india', label: 'India Only' },
                { id: 'global', label: 'Global Remote' },
                { id: 'all', label: 'All Regions' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onEligibilityFilterChange(opt.id)}
                aria-pressed={eligibilityFilter === opt.id}
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  eligibilityFilter === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Experience Scope Filter */}
        <div className="space-y-2">
          <div className="px-1 text-xs font-medium text-slate-500">
            Experience Scope
          </div>
          <div
            role="group"
            aria-label="Experience filter mode"
            className="grid grid-cols-1 gap-1 rounded-lg bg-slate-100 p-1"
          >
            <button
              type="button"
              onClick={() => onExperienceModeChange('strict_0_2')}
              aria-pressed={experienceMode === 'strict_0_2'}
              className={`rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors whitespace-nowrap ${
                experienceMode === 'strict_0_2'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              0–2 Years Verified
            </button>
            <button
              type="button"
              onClick={() => onExperienceModeChange('include_unspecified')}
              aria-pressed={experienceMode === 'include_unspecified'}
              className={`rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors whitespace-nowrap ${
                experienceMode === 'include_unspecified'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Include Unspecified
            </button>
          </div>
          <p className="px-1 text-xs leading-relaxed text-slate-500">
            Senior, lead, staff, and 3+ year postings are automatically excluded.
          </p>
        </div>

        {/* Work Mode Filter */}
        <div className="space-y-2">
          <div className="px-1 text-xs font-medium text-slate-500">
            Work Mode
          </div>
          <div
            role="group"
            aria-label="Work location mode"
            className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1"
          >
            <button
              type="button"
              onClick={() => onRemoteOnlyChange(false)}
              aria-pressed={!remoteOnly}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                !remoteOnly
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => onRemoteOnlyChange(true)}
              aria-pressed={remoteOnly}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                remoteOnly
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Remote Only
            </button>
          </div>
        </div>

        <div className="border-t border-slate-200" />

        {/* Active Portals Filter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-slate-500">
              Job Portals
            </span>
            {!allPortalsEnabled && (
              <button
                type="button"
                onClick={onEnableAllPortals}
                className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
              >
                Select all
              </button>
            )}
          </div>
          <div className="space-y-1">
            {portals.map((portal) => {
              const checked = enabledPortals.has(portal.id);
              return (
                <label
                  key={portal.id}
                  className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onTogglePortal(portal.id)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                    />
                    <span className="truncate font-medium text-slate-800">
                      {portal.name}
                    </span>
                  </span>
                  <span className="font-mono text-xs tabular-nums text-slate-500 ml-2 shrink-0">
                    {portal.status === 'error'
                      ? 'Err'
                      : (portalVisibleCounts[portal.id] ?? 0)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-200" />

        {/* Expandable Keyword Synonyms Reference */}
        <div>
          <button
            type="button"
            onClick={() => setKeywordsOpen((v) => !v)}
            aria-expanded={keywordsOpen}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <span>Matched Synonyms</span>
            {keywordsOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>
          {keywordsOpen && (
            <div className="mt-2 space-y-3 px-2 text-xs text-slate-600">
              <div>
                <div className="font-medium text-slate-800">Software Track</div>
                <p className="mt-0.5 leading-relaxed text-slate-500">
                  {KEYWORD_REFERENCE.software.join(' · ')}
                </p>
              </div>
              <div>
                <div className="font-medium text-slate-800">Salesforce Track</div>
                <p className="mt-0.5 leading-relaxed text-slate-500">
                  {KEYWORD_REFERENCE.salesforce.join(' · ')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer: 2h Auto-Refresh & Sources */}
      <div className="border-t border-slate-200 p-3 space-y-1.5 shrink-0">
        <label className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
          <span className="flex items-center gap-2 min-w-0">
            <input
              type="checkbox"
              checked={autoRefreshEnabled}
              onChange={(e) => onAutoRefreshToggle(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span className="font-medium text-slate-700 whitespace-nowrap">
              Auto-refresh (2h)
            </span>
          </span>
          <span className="font-mono text-xs tabular-nums text-slate-500 ml-2 shrink-0">
            {autoRefreshEnabled ? nextRefreshLabel : 'Off'}
          </span>
        </label>

        <button
          type="button"
          onClick={() => {
            onOpenSourcesModal();
            onCloseMobile();
          }}
          className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-slate-400" />
            <span>Sources &amp; Scrapers</span>
          </span>
          <span className="font-mono tabular-nums text-slate-500">
            {portals.filter((p) => p.status === 'ok').length}/{portals.length}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Permanent Sidebar */}
      <aside className="hidden lg:block lg:w-64 shrink-0 h-screen sticky top-0">
        {content}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filters and navigation"
        >
          <button
            type="button"
            aria-label="Close overlay"
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-900/40"
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full shadow-xl">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
