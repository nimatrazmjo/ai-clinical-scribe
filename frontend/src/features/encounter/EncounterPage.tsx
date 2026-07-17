import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronLeft, Save } from 'lucide-react';
import { useEncounterQuery } from './useEncounterQuery';
import { useDraftAutosave } from './useDraftAutosave';
import { formatPatientName, formatDate } from '@/lib/formatters';
import { EncounterStatus } from '@contracts';
import { cn } from '@/lib/cn';

const saveStatusLabel: Record<string, string> = {
  idle: '',
  unsaved: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

const saveStatusColor: Record<string, string> = {
  idle: 'text-muted-foreground',
  unsaved: 'text-yellow-600 dark:text-yellow-400',
  saving: 'text-muted-foreground',
  saved: 'text-green-600 dark:text-green-400',
  error: 'text-destructive',
};

export function EncounterPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: encounter, isLoading, isError, error } = useEncounterQuery(id ?? '');
  const { status, scheduleAutosave, initSavedText } = useDraftAutosave(id ?? '');
  // null = user hasn't typed yet; derive display value from server until they do
  const [localEdit, setLocalEdit] = useState<string | null>(null);
  const transcript = localEdit ?? encounter?.transcript ?? '';

  useEffect(() => {
    if (encounter?.transcript != null) {
      initSavedText(encounter.transcript);
    }
  }, [encounter?.transcript, initSavedText]);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="h-4 w-48 bg-muted animate-pulse rounded mb-6" />
        <div className="h-48 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (isError || !encounter) {
    return (
      <div role="alert" className="flex items-center gap-2 text-sm text-destructive py-4">
        <AlertCircle size={16} aria-hidden="true" />
        <span>{error instanceof Error ? error.message : 'Failed to load encounter'}</span>
      </div>
    );
  }

  const isFinalized = encounter.status === EncounterStatus.Finalized;
  const patientName = formatPatientName(encounter.patientFirstName, encounter.patientLastName);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/encounters')}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Back to encounters"
        >
          <ChevronLeft size={16} />
        </button>
        <div>
          <h1 className="text-base font-semibold">{patientName}</h1>
          <p className="text-xs text-muted-foreground">
            DOB {formatDate(encounter.patientDateOfBirth)}
            {isFinalized && (
              <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs font-medium">
                Finalized
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Transcript */}
      <section aria-labelledby="transcript-heading">
        <div className="flex items-baseline justify-between mb-1">
          <h2 id="transcript-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Transcript
          </h2>
          {status !== 'idle' && (
            <span className={cn('text-xs', saveStatusColor[status])} aria-live="polite">
              {saveStatusLabel[status]}
            </span>
          )}
        </div>
        <textarea
          id="transcript"
          aria-label="Encounter transcript"
          value={transcript}
          readOnly={isFinalized}
          onChange={(e) => {
            setLocalEdit(e.target.value);
            scheduleAutosave(e.target.value);
          }}
          rows={10}
          placeholder={isFinalized ? '' : 'Paste or type the encounter transcript here…'}
          className={cn(
            'w-full rounded border bg-background px-3 py-2 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring',
            isFinalized ? 'border-transparent bg-muted/30 cursor-default' : 'border-input',
          )}
        />
      </section>

      {/* Action area — placeholder for FE-08/09 */}
      {!isFinalized && (
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded bg-primary text-primary-foreground text-sm font-medium opacity-40 cursor-not-allowed"
            title="Generation coming in FE-09"
          >
            <Save size={14} aria-hidden="true" />
            Generate note
          </button>
          <span className="text-xs text-muted-foreground">
            Template selection and generation available after FE-08.
          </span>
        </div>
      )}
    </div>
  );
}
