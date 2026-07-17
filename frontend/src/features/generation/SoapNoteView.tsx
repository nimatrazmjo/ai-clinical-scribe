import type { Icd10Suggestion, SoapNote } from '@contracts';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Icd10SearchWidget } from '@/features/coding/Icd10SearchWidget';
import type { StreamStatus } from './useSoapStream';

interface Props {
  note: SoapNote;
  status: StreamStatus;
  onChange: (updater: (prev: SoapNote) => SoapNote) => void;
  readOnly?: boolean;
}

const TEXT_SECTIONS = ['subjective', 'objective', 'plan'] as const;

const SECTION_LABEL: Record<string, string> = {
  subjective: 'Subjective',
  objective: 'Objective',
  assessment: 'Assessment',
  plan: 'Plan',
};

export function SoapNoteView({ note, status, onChange, readOnly = false }: Props) {
  const editable = status === 'done' && !readOnly;
  const streaming = status === 'streaming';

  return (
    <div className="flex flex-col gap-4">
      {TEXT_SECTIONS.map(section => (
        <div key={section}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            {SECTION_LABEL[section]}
          </h3>
          <textarea
            aria-label={SECTION_LABEL[section]}
            readOnly={!editable}
            value={note[section]}
            rows={4}
            onChange={e => {
              const text = e.target.value;
              onChange(prev => ({ ...prev, [section]: text }));
            }}
            className={cn(
              'w-full rounded border bg-background px-3 py-2 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring',
              editable ? 'border-input' : 'border-transparent bg-muted/30 cursor-default',
              streaming && note[section] === '' && 'animate-pulse',
            )}
          />
        </div>
      ))}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Assessment
        </h3>
        <textarea
          aria-label="Assessment"
          readOnly={!editable}
          value={note.assessment.text}
          rows={4}
          onChange={e => {
            const text = e.target.value;
            onChange(prev => ({ ...prev, assessment: { ...prev.assessment, text } }));
          }}
          className={cn(
            'w-full rounded border bg-background px-3 py-2 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring',
            editable ? 'border-input' : 'border-transparent bg-muted/30 cursor-default',
            streaming && note.assessment.text === '' && 'animate-pulse',
          )}
        />

        {editable && (
          <div className="mt-2">
            <Icd10SearchWidget
              existingCodes={note.assessment.icd10.map(c => c.code)}
              onAdd={(code: Icd10Suggestion) =>
                onChange(prev => ({
                  ...prev,
                  assessment: {
                    ...prev.assessment,
                    icd10: prev.assessment.icd10.some(c => c.code === code.code)
                      ? prev.assessment.icd10
                      : [...prev.assessment.icd10, code],
                  },
                }))
              }
            />
          </div>
        )}

        {note.assessment.icd10.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-1.5">ICD-10 codes</p>
            <div className="flex flex-wrap gap-1.5" role="list" aria-label="ICD-10 codes">
              {note.assessment.icd10.map(code => (
                <span
                  key={code.code}
                  role="listitem"
                  className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-800 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  <span className="font-mono font-semibold">{code.code}</span>
                  <span className="text-blue-600 dark:text-blue-400">{code.description}</span>
                  {editable && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange(prev => ({
                          ...prev,
                          assessment: {
                            ...prev.assessment,
                            icd10: prev.assessment.icd10.filter(c => c.code !== code.code),
                          },
                        }))
                      }
                      aria-label={`Remove ${code.code}`}
                      className="ml-0.5 rounded p-0.5 hover:bg-blue-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:hover:bg-blue-700"
                    >
                      <X size={10} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
