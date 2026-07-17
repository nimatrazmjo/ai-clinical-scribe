import { useQuery } from '@tanstack/react-query';
import { getVersionDiff } from '@/api/diff';
import type { FieldDiff } from '@contracts';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  encounterId: string;
  fromVersion: number;
  toVersion: number;
}

const SECTION_LABEL: Record<string, string> = {
  subjective: 'Subjective',
  objective: 'Objective',
  plan: 'Plan',
};

export function VersionDiff({ encounterId, fromVersion, toVersion }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['encounters', encounterId, 'diff', fromVersion, toVersion],
    queryFn: ({ signal }) => getVersionDiff(encounterId, fromVersion, toVersion, signal),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        Loading diff…
      </div>
    );
  }

  if (isError || !data) {
    return <p className="py-2 text-sm text-destructive">Failed to load diff.</p>;
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded border border-red-200 bg-red-50/50 px-2 py-1 text-center text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          v{fromVersion} (before)
        </div>
        <div className="rounded border border-green-200 bg-green-50/50 px-2 py-1 text-center text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          v{toVersion} (after)
        </div>
      </div>

      {(['subjective', 'objective', 'plan'] as const).map(field => (
        <TextFieldDiff key={field} label={SECTION_LABEL[field]} diff={data[field]} />
      ))}

      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Assessment
        </h4>
        <TextFieldDiff label="" diff={data.assessment.text} />

        {(data.assessment.icd10Added.length > 0 || data.assessment.icd10Removed.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.assessment.icd10Added.map(code => (
              <span
                key={code}
                className="rounded border border-green-300 bg-green-50 px-2 py-0.5 font-mono text-xs text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300"
              >
                + {code}
              </span>
            ))}
            {data.assessment.icd10Removed.map(code => (
              <span
                key={code}
                className="rounded border border-red-300 bg-red-50 px-2 py-0.5 font-mono text-xs text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300"
              >
                − {code}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TextFieldDiff({ label, diff }: { label: string; diff: FieldDiff }) {
  if (!diff.changed) {
    if (!label) return null;
    return (
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h4>
        <p className="text-xs italic text-muted-foreground">No change</p>
      </div>
    );
  }

  return (
    <div>
      {label && (
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h4>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div
          className={cn(
            'max-h-48 overflow-y-auto whitespace-pre-wrap rounded border border-red-200 bg-red-50 p-2 text-xs text-red-900',
            'dark:border-red-800 dark:bg-red-900/20 dark:text-red-200',
            !diff.before && 'italic opacity-50',
          )}
        >
          {diff.before || '(empty)'}
        </div>
        <div
          className={cn(
            'max-h-48 overflow-y-auto whitespace-pre-wrap rounded border border-green-200 bg-green-50 p-2 text-xs text-green-900',
            'dark:border-green-800 dark:bg-green-900/20 dark:text-green-200',
            !diff.after && 'italic opacity-50',
          )}
        >
          {diff.after || '(empty)'}
        </div>
      </div>
    </div>
  );
}
