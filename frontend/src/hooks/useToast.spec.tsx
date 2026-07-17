import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { type ReactNode } from 'react';
import { ToastProvider } from '@/contexts/ToastContext';
import { useToast } from './useToast';

function wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe('useToast()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('adds a toast and it appears in the list', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => { result.current.toast('Hello world'); });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Hello world');
    expect(result.current.toasts[0].type).toBe('info');
  });

  it('error() adds error-typed toast', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => { result.current.error('Something broke'); });
    expect(result.current.toasts[0].type).toBe('error');
  });

  it('success() adds success-typed toast', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => { result.current.success('Saved!'); });
    expect(result.current.toasts[0].type).toBe('success');
  });

  it('dismiss() removes specific toast', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.toast('A');
      result.current.toast('B');
    });
    const id = result.current.toasts[0].id;
    act(() => { result.current.dismiss(id); });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('B');
  });

  it('auto-dismisses after 5 seconds', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => { result.current.toast('Temp'); });
    expect(result.current.toasts).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.toasts).toHaveLength(0);
  });
});
