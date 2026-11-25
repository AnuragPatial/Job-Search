import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import type {
  ApplicationStatus,
  JobListing,
  LinkedInJobDetailResponse,
} from '../types/jobs';
import { formatRelativeDate } from '../utils/jobFilters';

interface JobDetailPaneProps {
  job: JobListing | null;
  savedStatus: ApplicationStatus;
  notes: string;
  onStatusChange: (job: JobListing, status: ApplicationStatus) => void;
  onNotesChange: (job: JobListing, notes: string) => void;
  onCloseMobile?: () => void;
}

const linkedinDetailCache = new Map<string, LinkedInJobDetailResponse>();

export function JobDetailPane({
  job,
  savedStatus,
  notes,
  onStatusChange,
  onNotesChange,
  onCloseMobile,
}: JobDetailPaneProps) {
  const [detailData, setDetailData] = useState<LinkedInJobDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    setDetailData(null);
    setDetailError(null);

    if (!job || !job.linkedinJobId || job.hasFullDescription) {
      setLoadingDetail(false);
      return;
    }

    const cached = linkedinDetailCache.get(job.linkedinJobId);
    if (cached) {
      setDetailData(cached);
      setLoadingDetail(false);
      return;
    }

    let cancelled = false;
    setLoadingDetail(true);

    fetch(
      `/api/jobs/linkedin-detail/${encodeURIComponent(job.linkedinJobId)}?title=${encodeURIComponent(job.title)}`
    )
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Could not fetch full LinkedIn posting details');
        }
        return (await res.json()) as LinkedInJobDetailResponse;
      })
      .then((data) => {
        if (cancelled) return;
        if (!data.descriptionUnavailable) {
          linkedinDetailCache.set(job.linkedinJobId!, data);
        }
        setDetailData(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setDetailError(
          err instanceof Error ? err.message : 'Unable to load full description'
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [job]);

  if (!job) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-500">
        <p className="text-sm font-medium text-slate-700">
          Select a listing to inspect full requirements
        </p>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
          Review 0–2 year experience verification, matched skills, application tracking, and direct portal links.
        </p>
      </div>
    );
  }

  const effectiveDescription = detailData?.description || job.description || job.excerpt;
  const effectiveExpLabel =
    detailData?.experienceAnalysis.label || job.experienceLabel;
  const effectiveExpReason =
    detailData?.experienceAnalysis.reason || job.experienceReason;
  const effectiveExpTier =
    detailData?.experienceAnalysis.tier || job.experienceTier;

  const paragraphs = effectiveDescription
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Mobile Back Bar */}
      {onCloseMobile && (
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 xl:hidden shrink-0">
          <button
            type="button"
            onClick={onCloseMobile}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to listings</span>
          </button>
          <span className="text-xs text-slate-500">{job.portalName}</span>
        </div>
      )}

      {/* Scrollable Inspector Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Header Block */}
        <div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">
              {job.track === 'salesforce'
                ? 'Salesforce Developer Track'
                : 'Software Developer Track'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-slate-700">
              {job.eligibilityLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Posted {formatRelativeDate(job.postedAt)}
            </span>
            {job.jobType && (
              <>
                <span aria-hidden="true">·</span>
                <span>{job.jobType}</span>
              </>
            )}
          </div>

          <h2 className="mt-1.5 font-display text-xl font-bold tracking-tight text-slate-900 leading-snug">
            {job.title}
          </h2>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">{job.company}</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span>{job.location}</span>
            {job.salaryText && (
              <>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="font-mono text-sm font-medium tabular-nums text-slate-900">
                  {job.salaryText}
                </span>
              </>
            )}
          </div>

          {/* Primary Actions Row */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <span>Apply on {job.portalName}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <div className="flex items-center gap-2">
              <label
                htmlFor="job-application-status"
                className="text-xs font-medium text-slate-500 whitespace-nowrap"
              >
                Status
              </label>
              <select
                id="job-application-status"
                value={savedStatus}
                onChange={(e) =>
                  onStatusChange(job, e.target.value as ApplicationStatus)
                }
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="none">Not Tracked</option>
                <option value="saved">Saved</option>
                <option value="applied">Applied</option>
                <option value="interviewing">Interviewing</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {/* Structured Verification & Source Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-y border-slate-200 py-4 text-xs">
          <div>
            <div className="font-medium text-slate-500">
              Experience Assessment
            </div>
            <div
              className={`mt-1 font-semibold ${
                effectiveExpTier === 'verified_0_2'
                  ? 'text-emerald-700'
                  : effectiveExpTier === 'senior_excluded'
                    ? 'text-amber-700'
                    : 'text-slate-800'
              }`}
            >
              {effectiveExpLabel}
            </div>
            <p className="mt-0.5 leading-relaxed text-slate-600">
              {effectiveExpReason}
            </p>
          </div>

          <div>
            <div className="font-medium text-slate-500">Source Attribution</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-slate-800">
              <a
                href={job.portalAttributionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-700 hover:underline"
              >
                {job.portalName}
              </a>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="text-slate-600">{job.portalEngine} adapter</span>
            </div>
            {job.crossPostedPortals.length > 0 && (
              <p className="mt-0.5 text-slate-500">
                Also indexed on {job.crossPostedPortals.join(', ')}
              </p>
            )}
            {detailData?.seniorityLevel && (
              <p className="mt-0.5 text-slate-500">
                Seniority: {detailData.seniorityLevel}
                {detailData.employmentType ? ` · ${detailData.employmentType}` : ''}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <div className="font-medium text-slate-500">
              Matched Keywords &amp; Tags
            </div>
            <p className="mt-1 text-slate-700 leading-relaxed">
              {Array.from(new Set([...job.matchedKeywords, ...job.tags])).join(
                ' · '
              ) || 'Entry-level developer match'}
            </p>
          </div>
        </div>

        {/* Personal Application Notes */}
        <div className="space-y-1.5">
          <label
            htmlFor="job-tracker-notes"
            className="block text-xs font-medium text-slate-600"
          >
            Application Notes
          </label>
          <textarea
            id="job-tracker-notes"
            rows={2}
            value={notes}
            onChange={(e) => onNotesChange(job, e.target.value)}
            placeholder="Add referral contact, tailored resume version, or follow-up date..."
            className="w-full rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        {/* Full Description Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Role Description
            </h3>
            {loadingDetail && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading full description from LinkedIn
              </span>
            )}
          </div>

          {(detailError || detailData?.fallbackNotice) && (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 leading-relaxed">
              {detailData?.fallbackNotice ||
                `${detailError}. Use the direct link above to view the full description on ${job.portalName}.`}
            </p>
          )}

          {loadingDetail ? (
            <div className="space-y-2.5 animate-pulse">
              <div className="h-3.5 w-11/12 rounded bg-slate-100" />
              <div className="h-3.5 w-full rounded bg-slate-100" />
              <div className="h-3.5 w-4/5 rounded bg-slate-100" />
              <div className="h-3.5 w-10/12 rounded bg-slate-100" />
            </div>
          ) : (
            <div className="space-y-3 text-sm leading-relaxed text-slate-700 max-w-[70ch]">
              {paragraphs.length > 0 ? (
                paragraphs.map((para, idx) => (
                  <p key={idx} className="whitespace-pre-line break-words">
                    {para}
                  </p>
                ))
              ) : (
                <p className="text-slate-500">
                  No full description preview provided by this portal. Open the original job posting to inspect full details.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
