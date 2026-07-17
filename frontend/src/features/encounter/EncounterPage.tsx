import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ChevronLeft, Loader2, Square, Wand2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EncounterDto, SoapNote, TemplateDto, NoteVersionDto } from '@contracts';
import { ApiError } from '@/api/apiClient';
import { useEncounterQuery } from './useEncounterQuery';
import { useDraftAutosave } from './useDraftAutosave';
import { useNoteVersionsQuery } from './useNoteVersionsQuery';
import { useTemplatesQuery } from '@/features/template/useTemplatesQuery';
import { useSoapStream } from '@/features/generation/useSoapStream';
import { SoapNoteView } from '@/features/generation/SoapNoteView';
import { TemplateSelector } from '@/features/template/TemplateSelector';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import { saveNote } from '@/api/notes';
import { formatPatientName, formatDate } from '@/lib/formatters';
import { EncounterStatus } from '@contracts';
import { cn } from '@/lib/cn';

const draftStatusLabel: Record<string, string> = {
  idle: '',
  unsaved: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

const draftStatusColor: Record<string, string> = {
  idle: 'text-muted-foreground',
  unsaved: 'text-yellow-600 dark:text-yellow-400',
  saving: 'text-muted-foreground',
  saved: 'text-green-600 dark:text-green-400',
  error: 'text-destructive',
};

export function EncounterPage() {
  const { id } = useParams<{ id: string }>();
  const { data: encounter, isLoading, isError, error } = useEncounterQuery(id ?? '');
  const { data: versions = [] } = useNoteVersionsQuery(id ?? '');
  const { data: templates = [] } = useTemplatesQuery();

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

  return (
    <EncounterPageContent
      encounterId={id!}
      encounter={encounter}
      versions={versions}
      templates={templates.filter(t => t.isActive)}
    />
  );
}

interface ContentProps {
  encounterId: string;
  encounter: EncounterDto;
  versions: NoteVersionDto[];
  templates: TemplateDto[];
}

function EncounterPageContent({ encounterId, encounter, versions, templates }: ContentProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const RESCUE_KEY = `scribe_note_rescue_${encounterId}`;
  // useRef so the read+remove runs exactly once even in Strict Mode's double-invoke
  const rescuedNoteRef = useRef<SoapNote | null | undefined>(undefined);
  if (rescuedNoteRef.current === undefined) {
    try {
      const raw = sessionStorage.getItem(RESCUE_KEY);
      sessionStorage.removeItem(RESCUE_KEY);
      rescuedNoteRef.current = raw ? (JSON.parse(raw) as SoapNote) : null;
    } catch {
      rescuedNoteRef.current = null;
    }
  }
  const rescuedNote = rescuedNoteRef.current;

  // Initialize hooks from server data — no post-mount effects needed
  const { status: draftStatus, scheduleAutosave, initSavedText } = useDraftAutosave(encounterId);
  const { status, note, refusalReason, errorMessage, start, cancel, updateNote } = useSoapStream(
    rescuedNote ?? encounter.draft,
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    encounter.templateId ?? null,
  );

  const [localEdit, setLocalEdit] = useState<string | null>(null);
  const transcript = localEdit ?? encounter.transcript ?? '';
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Stable idempotency key so a retried save (e.g. after re-login) doesn't double-write.
  const idempotencyKeyRef = useRef<string>('');

  useEffect(() => {
    if (encounter.transcript != null) {
      initSavedText(encounter.transcript);
    }
  }, [encounter.transcript, initSavedText]);

  const isFinalized = encounter.status === EncounterStatus.Finalized;
  const isStreaming = status === 'streaming';
  const hasNote = status !== 'idle';
  const canGenerate = !isFinalized && !isStreaming && transcript.trim().length > 0;
  const canSave = !isFinalized && status === 'done';

  async function handleGenerate() {
    await start(encounterId, selectedTemplateId ?? undefined);
  }

  async function handleSave() {
    if (!canSave) return;
    // Backend requires at least one ICD-10 code — surface it here, not as a raw 400.
    if (note.assessment.icd10.length === 0) {
      setSaveError('Add at least one ICD-10 code to the assessment before saving.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
    try {
      await saveNote(encounterId, { soapNote: note, draftRevision: idempotencyKeyRef.current });
      await queryClient.invalidateQueries({ queryKey: ['encounters', encounterId, 'notes'] });
      await queryClient.invalidateQueries({ queryKey: ['encounters', encounterId] });
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'TOKEN_EXPIRED' || err.statusCode === 401)) {
        try {
          sessionStorage.setItem(RESCUE_KEY, JSON.stringify(note));
        } catch { /* storage full or blocked */ }
        setSaveError('Session expired — your edits were preserved. Re-login to continue.');
      } else {
        setSaveError(err instanceof Error ? err.message : 'Save failed');
      }
    } finally {
      setIsSaving(false);
    }
  }

  const patientName = formatPatientName(encounter.patientFirstName, encounter.patientLastName);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate('/encounters')}
          aria-label="Back to encounters"
        >
          <ChevronLeft size={16} />
        </Button>
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
          {draftStatus !== 'idle' && (
            <span className={cn('text-xs', draftStatusColor[draftStatus])} aria-live="polite">
              {draftStatusLabel[draftStatus]}
            </span>
          )}
        </div>
        <textarea
          id="transcript"
          aria-label="Encounter transcript"
          value={transcript}
          readOnly={isFinalized || isStreaming}
          onChange={e => {
            setLocalEdit(e.target.value);
            scheduleAutosave(e.target.value);
          }}
          rows={10}
          placeholder={isFinalized ? '' : 'Paste or type the encounter transcript here…'}
          className={cn(
            'w-full rounded border bg-background px-3 py-2 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring',
            isFinalized || isStreaming
              ? 'border-transparent bg-muted/30 cursor-default'
              : 'border-input',
          )}
        />
      </section>

      {/* Generate controls */}
      {!isFinalized && (
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border">
          <TemplateSelector
            templates={templates}
            selectedId={selectedTemplateId}
            onChange={setSelectedTemplateId}
          />

          <div className="flex items-center gap-2 ml-auto">
            {isStreaming ? (
              <Button
                type="button"
                variant="outline"
                onClick={cancel}
                className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Square size={12} aria-hidden="true" />
                Cancel
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={!canGenerate}
                title={transcript.trim().length === 0 ? 'Add a transcript first' : undefined}
                className="h-9 shadow-sm"
              >
                <Wand2 size={14} aria-hidden="true" />
                Generate note
              </Button>
            )}

            {canSave && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                {isSaving
                  ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  : <Save size={14} aria-hidden="true" />}
                {isSaving ? 'Saving…' : 'Save note'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle size={14} aria-hidden="true" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Refusal message */}
      {status === 'refused' && refusalReason && (
        <div role="alert" className="rounded border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700/50 dark:bg-yellow-900/20 dark:text-yellow-300">
          <p className="font-medium mb-1">Note generation declined</p>
          <p>{refusalReason}</p>
        </div>
      )}

      {/* Stream error */}
      {status === 'error' && errorMessage && (
        <div role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle size={14} aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* SOAP note */}
      {hasNote && status !== 'refused' && (
        <section aria-labelledby="soap-note-heading">
          <div className="flex items-baseline justify-between mb-3">
            <h2 id="soap-note-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              SOAP Note
            </h2>
            {isStreaming && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
                <Loader2 size={10} className="animate-spin" aria-hidden="true" />
                Generating…
              </span>
            )}
          </div>
          <SoapNoteView
            note={note}
            status={status}
            onChange={updateNote}
            readOnly={isFinalized}
          />
        </section>
      )}

      {/* Version history */}
      {versions.length > 0 && <VersionHistoryPanel encounterId={encounterId} versions={versions} />}
    </div>
  );
}
