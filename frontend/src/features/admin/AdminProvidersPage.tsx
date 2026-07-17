import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, Plus, UserX } from 'lucide-react';
import { getAdminProviders, createProvider, deactivateProvider } from '@/api/admin';
import { formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/cn';

export function AdminProvidersPage() {
  const queryClient = useQueryClient();
  const { data: providers = [], isLoading, isError } = useQuery({
    queryKey: ['admin', 'providers'],
    queryFn: ({ signal }) => getAdminProviders(signal),
  });
  const [showForm, setShowForm] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'provider' | 'admin'>('provider');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormBusy(true);
    setFormError(null);
    try {
      await createProvider({ email: formEmail, password: formPassword, role: formRole });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
      setShowForm(false);
      setFormEmail('');
      setFormPassword('');
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Providers</h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={12} aria-hidden="true" />
            Add provider
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={e => void handleCreate(e)} className="rounded border border-border p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Add provider</h3>

          <div className="flex flex-col gap-1">
            <label htmlFor="p-email" className="text-xs text-muted-foreground">Email *</label>
            <input
              id="p-email"
              type="email"
              required
              value={formEmail}
              onChange={e => setFormEmail(e.target.value)}
              className="h-8 rounded border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="p-password" className="text-xs text-muted-foreground">Initial password *</label>
            <input
              id="p-password"
              type="password"
              required
              value={formPassword}
              onChange={e => setFormPassword(e.target.value)}
              className="h-8 rounded border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="p-role" className="text-xs text-muted-foreground">Role</label>
            <select
              id="p-role"
              value={formRole}
              onChange={e => setFormRole(e.target.value as 'provider' | 'admin')}
              className="h-8 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="provider">Provider</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {formError && (
            <div role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle size={12} aria-hidden="true" />
              {formError}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={formBusy}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
            >
              {formBusy && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
              Create provider
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError(null); }}
              className="h-8 px-3 rounded border border-input text-sm hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border text-left">
            {['Email', 'Role', 'Status', 'Created', ''].map((h, i) => (
              <th key={i} className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {providers.map(p => (
            <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
              <td className="py-2">{p.email}</td>
              <td className="py-2 text-xs text-muted-foreground capitalize">{p.role}</td>
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
