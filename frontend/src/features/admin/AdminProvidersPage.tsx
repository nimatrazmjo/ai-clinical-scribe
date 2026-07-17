import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, Plus, UserX } from 'lucide-react';
import { getAdminProviders, createProvider, deactivateProvider } from '@/api/admin';
import { formatDateTime } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export function AdminProvidersPage() {
  const queryClient = useQueryClient();
  const { data: providers = [], isLoading, isError } = useQuery({
    queryKey: ['admin', 'providers'],
    queryFn: ({ signal }) => getAdminProviders(signal),
  });
  const [showForm, setShowForm] = useState(false);
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function resetForm() {
    setFormFirstName('');
    setFormLastName('');
    setFormEmail('');
    setFormPassword('');
    setFormError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormBusy(true);
    setFormError(null);
    try {
      await createProvider({
        firstName: formFirstName,
        lastName: formLastName,
        email: formEmail,
        password: formPassword,
      });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
      setShowForm(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setFormBusy(false);
    }
  }

  async function handleDeactivate(id: string, email: string) {
    if (!window.confirm(`Deactivate ${email}?`)) return;
    setBusyId(id);
    try {
      await deactivateProvider(id);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) return <div className="h-32 bg-muted animate-pulse rounded" />;
  if (isError) return <p className="text-sm text-destructive">Failed to load providers.</p>;

  const inputCls = 'h-8 rounded border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Providers</h2>
        {!showForm && (
          <Button type="button" size="sm" onClick={() => setShowForm(true)}>
            <Plus size={12} aria-hidden="true" />
            Add provider
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={e => void handleCreate(e)} className="rounded border border-border p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Add provider</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="p-first" className="text-xs text-muted-foreground">First name *</label>
              <input
                id="p-first"
                type="text"
                required
                autoComplete="given-name"
                value={formFirstName}
                onChange={e => setFormFirstName(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="p-last" className="text-xs text-muted-foreground">Last name *</label>
              <input
                id="p-last"
                type="text"
                required
                autoComplete="family-name"
                value={formLastName}
                onChange={e => setFormLastName(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="p-email" className="text-xs text-muted-foreground">Email *</label>
            <input
              id="p-email"
              type="email"
              required
              autoComplete="email"
              value={formEmail}
              onChange={e => setFormEmail(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="p-password" className="text-xs text-muted-foreground">Initial password * (min 8 chars)</label>
            <input
              id="p-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={formPassword}
              onChange={e => setFormPassword(e.target.value)}
              className={inputCls}
            />
          </div>

          {formError && (
            <div role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle size={12} aria-hidden="true" />
              {formError}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={formBusy}>
              {formBusy && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
              Create provider
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setShowForm(false); resetForm(); }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border text-left">
            {['Name', 'Email', 'Status', 'Created', ''].map((h, i) => (
              <th key={i} className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {providers.map(p => (
            <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
              <td className="py-2 font-medium">{p.firstName} {p.lastName}</td>
              <td className="py-2 text-muted-foreground">{p.email}</td>
              <td className="py-2">
                <span className={cn(
                  'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
                  p.isActive
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
                )}>
                  {p.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="py-2 text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</td>
              <td className="py-2">
                {p.isActive && (
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => void handleDeactivate(p.id, p.email)}
                    aria-label={`Deactivate ${p.email}`}
                    className="p-1 rounded text-muted-foreground hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                  >
                    {busyId === p.id
                      ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                      : <UserX size={12} />}
                  </button>
                )}
              </td>
            </tr>
          ))}
          {providers.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                No providers yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
