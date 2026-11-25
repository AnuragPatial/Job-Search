import { ExternalLink, X } from 'lucide-react';
import type { PortalStatus } from '../types/jobs';

interface SourcesModalProps {
  open: boolean;
  onClose: () => void;
  portals: PortalStatus[];
  totalScanned: number;
  fetchedAt: string | null;
  cacheHit: boolean;
  isFallbackData: boolean;
}

export function SourcesModal({
  open,
  onClose,
  portals,
  totalScanned,
  fetchedAt,
  cacheHit,
  isFallbackData,
}: SourcesModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sources-modal-title"
    >
      <button
        type="button"
        aria-label="Close modal backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40"
      />
      <div className="relative z-10 w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2
              id="sources-modal-title"
              className="font-display text-base font-bold text-slate-900"
            >
              Open-Source Scraper Adapters &amp; Diagnostics
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Powered by JobSpy (LinkedIn, Indeed, Naukri) and modular community-portals feeds with 2-hour auto-refresh.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sources modal"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            <span>
              Total scanned:{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {totalScanned}
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span>
              Last fetched:{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : 'Pending'}
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span>
              Source mode:{' '}
              <strong className="text-slate-900">
                {isFallbackData
                  ? 'Offline fallback'
                  : cacheHit
                    ? 'Cached live scrape (2h TTL)'
                    : 'Fresh live scrape'}
              </strong>
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-md">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="px-3 py-2 font-medium">Portal</th>
                  <th className="px-3 py-2 font-medium">Adapter Architecture</th>
                  <th className="px-3 py-2 font-medium text-right">Scanned</th>
                  <th className="px-3 py-2 font-medium text-right">0–2 Yr Match</th>
                  <th className="px-3 py-2 font-medium text-right">Latency</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {portals.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      <a
                        href={p.attributionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-blue-700 hover:underline"
                      >
                        {p.name}
                        <ExternalLink className="h-3 w-3 text-slate-400" />
                      </a>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{p.engine}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {p.scannedCount}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums font-medium text-slate-900">
                      {p.matchedCount}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-500">
                      {p.durationMs}ms
                    </td>
                    <td className="px-3 py-2.5">
                      {p.status === 'ok' ? (
                        <span className="font-medium text-emerald-700">OK</span>
                      ) : (
                        <span
                          className="font-medium text-red-700"
                          title={p.errorMessage}
                        >
                          Error
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500">
            <span>Open-source references:</span>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/speedyapply/JobSpy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 hover:underline"
              >
                speedyapply/JobSpy
              </a>
              <a
                href="https://github.com/ai-job-search-dev/community-portals"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 hover:underline"
              >
                ai-job-search-dev/community-portals
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
