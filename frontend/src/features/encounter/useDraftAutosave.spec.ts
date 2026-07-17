import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setupServer';
import { useDraftAutosave } from './useDraftAutosave';

const ENC_ID = 'encounter-1';

describe('useDraftAutosave', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts as idle', () => {
    const { result } = renderHook(() => useDraftAutosave(ENC_ID));
    expect(result.current.status).toBe('idle');
  });

  it('becomes unsaved immediately on scheduleAutosave', () => {
    const { result } = renderHook(() => useDraftAutosave(ENC_ID));
    act(() => { result.current.scheduleAutosave('some text'); });
    expect(result.current.status).toBe('unsaved');
  });

  it('debounces: only one API call after rapid changes', async () => {
    let callCount = 0;
    server.use(
      http.patch('*/encounters/*/transcript', () => {
        callCount++;
        return HttpResponse.json({});
      }),
    );
    const { result } = renderHook(() => useDraftAutosave(ENC_ID));
    act(() => { result.current.scheduleAutosave('a'); });
    act(() => { result.current.scheduleAutosave('ab'); });
    act(() => { result.current.scheduleAutosave('abc'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(callCount).toBe(1);
  });

  it('becomes saved after successful API call', async () => {
    server.use(
      http.patch('*/encounters/*/transcript', () => HttpResponse.json({})),
    );
    const { result } = renderHook(() => useDraftAutosave(ENC_ID));
    act(() => { result.current.scheduleAutosave('hello'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(result.current.status).toBe('saved');
  });

  it('becomes error on failed save', async () => {
    server.use(
      http.patch('*/encounters/*/transcript', () =>
        HttpResponse.json({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'oops' }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useDraftAutosave(ENC_ID));
    act(() => { result.current.scheduleAutosave('fail me'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(result.current.status).toBe('error');
  });

  it('skips save when text is unchanged', async () => {
    let callCount = 0;
    server.use(
      http.patch('*/encounters/*/transcript', () => {
        callCount++;
        return HttpResponse.json({});
      }),
    );
    const { result } = renderHook(() => useDraftAutosave(ENC_ID));
    result.current.initSavedText('existing');
    act(() => { result.current.scheduleAutosave('existing'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(callCount).toBe(0);
  });
});
