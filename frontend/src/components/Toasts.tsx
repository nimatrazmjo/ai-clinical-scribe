import { useToastContext, type Toast, type ToastType } from '@/contexts/ToastContext';
import { cn } from '@/lib/cn';
import { X } from 'lucide-react';

const typeStyles: Record<ToastType, string> = {
  info: 'bg-blue-600 text-white',
  success: 'bg-green-600 text-white',
  warning: 'bg-yellow-500 text-white',
  error: 'bg-red-600 text-white',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'flex items-start gap-3 rounded px-4 py-3 shadow-md text-sm min-w-72 max-w-sm',
        typeStyles[toast.type],
      )}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        className="shrink-0 opacity-80 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function Toasts() {
  const { toasts, removeToast } = useToastContext();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
      ))}
    </div>
  );
}
