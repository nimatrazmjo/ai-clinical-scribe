import { useCallback, useRef, useState } from 'react';
import type { Icd10Suggestion, LlmEvent, SoapNote } from '@contracts';
import { apiClient } from '@/api/apiClient';

export type StreamStatus = 'idle' | 'streaming' | 'done' | 'refused' | 'error';

const STREAM_TIMEOUT_MS = 30_000;

function emptyNote(): SoapNote {
  return { subjective: '', objective: '', assessment: { text: '', icd10: [] }, plan: '' };
}

export function useSoapStream(initialNote?: SoapNote | null) {
  const [status, setStatus] = useState<StreamStatus>(() => (initialNote ? 'done' : 'idle'));
  const [note, setNote] = useState<SoapNote>(() => initialNote ?? emptyNote());
  const [refusalReason, setRefusalReason] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

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
        setErrorMessage(`Generation failed: HTTP ${res.status}`);
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
              setNote(prev => {
                if (section === 'assessment') {
                  return { ...prev, assessment: { ...prev.assessment, text: prev.assessment.text + text } };
                }
                const field = section as 'subjective' | 'objective' | 'plan';
                return { ...prev, [field]: prev[field] + text };
              });
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

            case 'done':
              if (idleTimer) clearTimeout(idleTimer);
              setStatus('done');
              break outer;
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
