import { useState } from 'react';
import type { NoteVersionDto } from '@contracts';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatDateTime } from '@/lib/formatters';
import { SoapNoteView } from '@/features/generation/SoapNoteView';

interface Props {
  versions: NoteVersionDto[];
}

export function VersionHistoryPanel({ versions }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  if (versions.length === 0) return null;

  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const activeVersion = sorted.find(v => v.id === activeVersionId) ?? null;

  return (
    <section aria-labelledby="version-history-heading" className="border-t border-border pt-4">
      <button
        type="button"
        id="version-history-heading"
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
        Version history ({versions.length})
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2">
          <ol className="flex flex-col gap-1" aria-label="Note versions">
            {sorted.map(v => (
              <li key={v.id} className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm">
                <div>
                  <span className="font-medium tabular-nums">v{v.versionNumber}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatDateTime(v.createdAt)} · {v.savedByEmail}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveVersionId(activeVersionId === v.id ? null : v.id)}
                  className="text-xs text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  aria-pressed={activeVersionId === v.id}
                >
                  {activeVersionId === v.id ? 'Close' : 'View'}
                </button>
              </li>
            ))}
          </ol>

          {activeVersion && (
            <div className="rounded border border-border bg-muted/20 p-4" role="region" aria-label={`Version ${activeVersion.versionNumber} read-only`}>
              <p className="mb-3 text-xs font-semibold text-muted-foreground">
                v{activeVersion.versionNumber} — {formatDateTime(activeVersion.createdAt)} · {activeVersion.savedByEmail}
              </p>
              <SoapNoteView
                note={activeVersion.soapNote}
                status="done"
                onChange={() => {}}
                readOnly
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
