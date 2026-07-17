import { useState } from 'react';
import type { NoteVersionDto } from '@contracts';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatDateTime } from '@/lib/formatters';
import { SoapNoteView } from '@/features/generation/SoapNoteView';
import { VersionDiff } from './VersionDiff';

interface Props {
  encounterId: string;
  versions: NoteVersionDto[];
}

type PanelView = { type: 'note'; id: string } | { type: 'diff'; id: string };

export function VersionHistoryPanel({ encounterId, versions }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [activeView, setActiveView] = useState<PanelView | null>(null);

  if (versions.length === 0) return null;

  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  function toggleView(view: PanelView) {
    setActiveView(prev =>
      prev?.type === view.type && prev.id === view.id ? null : view,
    );
  }

  return (
    <section aria-labelledby="version-history-heading" className="border-t border-border pt-4">
      <button
        type="button"
        id="version-history-heading"
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 rounded text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={expanded}
      >
        {expanded
          ? <ChevronDown size={12} aria-hidden="true" />
          : <ChevronRight size={12} aria-hidden="true" />}
        Version history ({versions.length})
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2">
          <ol className="flex flex-col gap-1" aria-label="Note versions">
            {sorted.map((v, idx) => {
              const prev = sorted[idx + 1];
              const isNoteActive = activeView?.type === 'note' && activeView.id === v.id;
              const isDiffActive = activeView?.type === 'diff' && activeView.id === v.id;

              return (
                <li key={v.id} className="rounded border border-border">
                  <div className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <span className="tabular-nums font-medium">v{v.versionNumber}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatDateTime(v.createdAt)} · {v.savedByEmail}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {prev && (
                        <button
                          type="button"
                          onClick={() => toggleView({ type: 'diff', id: v.id })}
                          className="rounded text-xs text-muted-foreground hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-pressed={isDiffActive}
                        >
                          {isDiffActive ? 'Hide diff' : 'Diff vs prev'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleView({ type: 'note', id: v.id })}
                        className="rounded text-xs text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-pressed={isNoteActive}
                      >
                        {isNoteActive ? 'Close' : 'View'}
                      </button>
                    </div>
                  </div>

                  {isNoteActive && (
                    <div
                      className="border-t border-border bg-muted/20 p-4"
                      role="region"
                      aria-label={`Version ${v.versionNumber} read-only`}
                    >
                      <SoapNoteView note={v.soapNote} status="done" onChange={() => {}} readOnly />
                    </div>
                  )}

                  {isDiffActive && prev && (
                    <div
                      className="border-t border-border bg-muted/20 p-4"
                      role="region"
                      aria-label={`Diff v${prev.versionNumber} to v${v.versionNumber}`}
                    >
                      <VersionDiff
                        encounterId={encounterId}
                        fromVersion={prev.versionNumber}
                        toVersion={v.versionNumber}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
