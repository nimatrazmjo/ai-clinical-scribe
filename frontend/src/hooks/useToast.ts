import { useToastContext, type ToastType } from '@/contexts/ToastContext';

export function useToast() {
  const { toasts, addToast, removeToast } = useToastContext();

  return {
    toasts,
    toast: (message: string, type: ToastType = 'info') => addToast(message, type),
    dismiss: removeToast,
    error: (message: string) => addToast(message, 'error'),
    success: (message: string) => addToast(message, 'success'),
    warn: (message: string) => addToast(message, 'warning'),
  };
}
