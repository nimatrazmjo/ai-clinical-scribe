import { useCallback, useRef, useState } from 'react';
import type { Icd10Suggestion, LlmEvent, SoapNote } from '@contracts';
import { apiClient } from '@/api/apiClient';

export type StreamStatus = 'idle' | 'streaming' | 'done' | 'refused' | 'error';

const STREAM_TIMEOUT_MS = 30_000;

function emptyNote(): SoapNote {
  return { subjective: '', objective: '', assessment: { text: '', icd10: [] }, plan: '' };
}

/**
 * The model streams the assessment section as a JSON string:
 *   {"text":"...","icd10":[{"code":"J45.909","description":"..."}]}
 * This extracts the narrative + codes. During streaming the JSON is partial,
 * so we fall back to a best-effort regex for the `text` field until it parses.
 */
function parseAssessment(
  raw: string,
): { text: string; icd10: Icd10Suggestion[] } {
  const trimmed = raw.trimStart();
  // Model didn't emit JSON (didn't follow format) — show whatever it sent.
  if (!trimmed.startsWith('{')) return { text: raw, icd10: [] };

  try {
    const parsed = JSON.parse(trimmed) as { text?: string; icd10?: unknown };
    const icd10 = Array.isArray(parsed.icd10)
      ? (parsed.icd10 as Array<{ code: string; description: string; score?: number }>).map(c => ({
          code: c.code,
          description: c.description,
          score: c.score ?? 1,
        }))
      : [];
    return { text: typeof parsed.text === 'string' ? parsed.text : '', icd10 };
  } catch {
    // Partial JSON mid-stream — pull the text field out so it streams live.
    const m = trimmed.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)/);
    if (m) {
      try {
        return { text: JSON.parse(`"${m[1]}"`) as string, icd10: [] };
      } catch { /* fall through */ }
    }
    return { text: '', icd10: [] };
  }
}

export function useSoapStream(initialNote?: SoapNote | null) {
  const [status, setStatus] = useState<StreamStatus>(() => (initialNote ? 'done' : 'idle'));
  const [note, setNote] = useState<SoapNote>(() => initialNote ?? emptyNote());
  const [refusalReason, setRefusalReason] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  // Accumulates raw assessment JSON across section-delta chunks while streaming.
  const assessmentRawRef = useRef('');

  const cancel = useCallback(() => {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
    setStatus('idle');
  }, []);

  const updateNote = useCallback((updater: (prev: SoapNote) => SoapNote) => {
    setNote(updater);
  }, []);

  const start = useCallback(async (encounterId: string, templateId?: string) => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    setStatus('streaming');
    setNote(emptyNote());
    assessmentRawRef.current = '';
    setRefusalReason(null);
    setErrorMessage(null);

    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        setStatus('error');
        setErrorMessage('Generation timed out — no data received for 30 seconds');
        ctrl.abort();
      }, STREAM_TIMEOUT_MS);
    };

    resetIdle();

    try {
      const res = await apiClient.streamPost(
        `/encounters/${encounterId}/generate`,
        templateId ? { templateId } : undefined,
        ctrl.signal,
      );

      if (!res.ok) {
        if (idleTimer) clearTimeout(idleTimer);
        setStatus('error');
        setErrorMessage(
          res.status === 429
            ? 'Rate limit reached — wait a moment before generating again'
            : `Generation failed: HTTP ${res.status}`,
        );
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        resetIdle();

        buf += decoder.decode(value, { stream: true });
        const blocks = buf.split('\n\n');
        buf = blocks.pop() ?? '';

        for (const block of blocks) {
          const dataLine = block.split('\n').find(l => l.startsWith('data: '));
          if (!dataLine) continue;
          let event: LlmEvent;
          try {
            event = JSON.parse(dataLine.slice(6)) as LlmEvent;
          } catch {
            continue;
          }

          switch (event.type) {
            case 'section-delta': {
              const { section, text } = event;
              if (section === 'assessment') {
                // Assessment streams as JSON; accumulate raw and re-parse each chunk
                // so the narrative renders live. Codes resolve once the JSON closes.
                assessmentRawRef.current += text;
                const { text: aText, icd10 } = parseAssessment(assessmentRawRef.current);
                setNote(prev => ({
                  ...prev,
                  assessment: { text: aText, icd10: icd10.length ? icd10 : prev.assessment.icd10 },
                }));
              } else {
                const field = section as 'subjective' | 'objective' | 'plan';
                setNote(prev => ({ ...prev, [field]: prev[field] + text }));
              }
              break;
            }

            case 'tool-result':
              if (event.toolName === 'icd10_search' || event.toolName === 'icd10Lookup') {
                setNote(prev => ({
                  ...prev,
                  assessment: { ...prev.assessment, icd10: event.result as Icd10Suggestion[] },
                }));
              }
              break;

            case 'refused':
              if (idleTimer) clearTimeout(idleTimer);
              setRefusalReason(event.reason);
              setStatus('refused');
              ctrl.abort();
              break outer;

            case 'error':
              if (idleTimer) clearTimeout(idleTimer);
              setErrorMessage(event.message);
              setStatus('error');
              ctrl.abort();
              break outer;

            case 'done': {
              if (idleTimer) clearTimeout(idleTimer);
              // Authoritative parse of the completed assessment JSON → final codes.
              if (assessmentRawRef.current) {
                const { text: aText, icd10 } = parseAssessment(assessmentRawRef.current);
                setNote(prev => ({
                  ...prev,
                  assessment: {
                    text: aText || prev.assessment.text,
                    icd10: icd10.length ? icd10 : prev.assessment.icd10,
                  },
                }));
              }
              setStatus('done');
              break outer;
            }
          }
        }
      }

      if (idleTimer) clearTimeout(idleTimer);
    } catch (err) {
      if (idleTimer) clearTimeout(idleTimer);
      if (!ctrl.signal.aborted) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Generation failed');
      }
    }
  }, []);

  return { status, note, refusalReason, errorMessage, start, cancel, updateNote };
}
