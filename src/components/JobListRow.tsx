import { Bookmark } from 'lucide-react';
import type { ApplicationStatus, JobListing } from '../types/jobs';
import { formatRelativeDate } from '../utils/jobFilters';

interface JobListRowProps {
  job: JobListing;
  isSelected: boolean;
  savedStatus: ApplicationStatus;
  onSelect: (job: JobListing) => void;
  onToggleSave: (job: JobListing) => void;
}

const STATUS_LABELS: Record<Exclude<ApplicationStatus, 'none'>, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  archived: 'Archived',
};

export function JobListRow({
  job,
  isSelected,
  savedStatus,
  onSelect,
  onToggleSave,
}: JobListRowProps) {
  const isSaved = savedStatus !== 'none';

  return (
    <div
      className={`group relative border-b border-slate-200 transition-colors ${
        isSelected
          ? 'bg-blue-50/70'
          : 'bg-white hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <button
          type="button"
          onClick={() => onSelect(job)}
          aria-current={isSelected ? 'true' : undefined}
          className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 rounded"
        >
          {/* Line 1: Role Title */}
          <div className="flex items-baseline justify-between gap-2">
            <h3
              className={`text-sm font-semibold leading-snug truncate ${
                isSelected ? 'text-blue-900' : 'text-slate-900'
              }`}
            >
              {job.title}
            </h3>
            <span className="font-mono text-xs tabular-nums text-slate-400 shrink-0">
              {formatRelativeDate(job.postedAt)}
            </span>
          </div>

          {/* Line 2: Company & Location */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-700">
            <span className="font-medium truncate max-w-[200px] sm:max-w-[260px]">
              {job.company}
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="text-slate-500 truncate max-w-[180px] sm:max-w-[220px]">
              {job.location}
            </span>
          </div>

          {/* Line 3: Unboxed Metadata Strip (Zero-Pill Discipline) */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
            <span
              className={
                job.track === 'salesforce'
                  ? 'font-medium text-sky-700'
                  : 'font-medium text-slate-700'
              }
            >
              {job.track === 'salesforce' ? 'Salesforce' : 'Software'}
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span
              className={
                job.experienceTier === 'verified_0_2'
                  ? 'font-medium text-emerald-700'
                  : 'text-slate-500'
              }
            >
              {job.experienceLabel}
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span>{job.eligibilityLabel}</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span>{job.portalName}</span>
            {job.salaryText && (
              <>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="font-mono tabular-nums text-slate-700">
                  {job.salaryText}
                </span>
              </>
            )}
            {isSaved && (
              <>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="font-medium text-blue-700">
                  {STATUS_LABELS[savedStatus]}
                </span>
              </>
            )}
          </div>
        </button>

        {/* Save / Bookmark Action */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave(job);
          }}
          aria-label={
            isSaved
              ? `Remove ${job.title} at ${job.company} from saved`
              : `Save ${job.title} at ${job.company}`
          }
          aria-pressed={isSaved}
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors ${
            isSaved
              ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
              : 'border-transparent text-slate-400 hover:border-slate-200 hover:bg-white hover:text-slate-700'
          }`}
        >
          <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
        </button>
      </div>
    </div>
  );
}
