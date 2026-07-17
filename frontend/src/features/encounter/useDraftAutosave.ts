import { useCallback, useEffect, useRef, useState } from 'react';
import { setTranscript } from '@/api/encounters';

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 1500;

export function useDraftAutosave(encounterId: string) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the text that has been committed to the server
  const savedTextRef = useRef<string | null>(null);

  const save = useCallback(
    async (text: string) => {
      if (text === savedTextRef.current) return;
      setStatus('saving');
      try {
        await setTranscript(encounterId, { text });
        savedTextRef.current = text;
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    },
    [encounterId],
  );

  const scheduleAutosave = useCallback(
    (text: string) => {
      setStatus('unsaved');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => save(text), DEBOUNCE_MS);
    },
    [save],
  );

  // Cancel pending timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Initialize savedTextRef when we first receive the server value
  function initSavedText(text: string) {
    if (savedTextRef.current === null) savedTextRef.current = text;
  }

  return { status, scheduleAutosave, initSavedText };
}
