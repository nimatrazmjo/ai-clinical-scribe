import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Edit2, Loader2, Plus, Trash2 } from 'lucide-react';
import { getAllTemplates, createTemplate, updateTemplate, deleteTemplate } from '@/api/adminTemplates';
import type { TemplateDto } from '@contracts';
import { formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/cn';

export function AdminTemplatesPage() {
  const queryClient = useQueryClient();
  const { data: templates = [], isLoading, isError } = useQuery({
    queryKey: ['admin', 'templates'],
    queryFn: ({ signal }) => getAllTemplates(signal),
  });
  const [editing, setEditing] = useState<TemplateDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSave(data: { name: string; promptBody: string; encounterType: string; isActive: boolean }) {
    setBusy('save');
    setFormError(null);
    try {
      if (editing) {
        await updateTemplate(editing.id, { name: data.name, promptBody: data.promptBody, encounterType: data.encounterType || undefined, isActive: data.isActive });
      } else {
        await createTemplate({ name: data.name, promptBody: data.promptBody, encounterType: data.encounterType || undefined });
      }
      await queryClient.invalidateQueries({ queryKey: ['admin', 'templates'] });
      await queryClient.invalidateQueries({ queryKey: ['templates'] });
      setEditing(null);
      setCreating(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this template?')) return;
    setBusy(id);
    try {
      await deleteTemplate(id);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'templates'] });
      await queryClient.invalidateQueries({ queryKey: ['templates'] });
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleActive(t: TemplateDto) {
    setBusy(t.id);
    try {
      await updateTemplate(t.id, { isActive: !t.isActive });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'templates'] });
      await queryClient.invalidateQueries({ queryKey: ['templates'] });
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) return <div className="h-32 bg-muted animate-pulse rounded" />;
  if (isError) return <p className="text-sm text-destructive">Failed to load templates.</p>;

  const showForm = creating || editing != null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Templates</h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => { setCreating(true); setEditing(null); }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={12} aria-hidden="true" />
            New template
          </button>
        )}
      </div>

      {showForm && (
        <TemplateForm
          initial={editing}
          isBusy={busy === 'save'}
          error={formError}
          onSave={handleSave}
          onCancel={() => { setCreating(false); setEditing(null); setFormError(null); }}
        />
      )}

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
            <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</th>
            <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
            <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Updated</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody>
          {templates.map(t => (
            <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20">
              <td className="py-2 font-medium">{t.name}</td>
              <td className="py-2 text-muted-foreground text-xs">{t.encounterType ?? '—'}</td>
              <td className="py-2">
                <button
                  type="button"
                  disabled={busy === t.id}
                  onClick={() => void handleToggleActive(t)}
                  className={cn(
                    'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    t.isActive
                      ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {busy === t.id ? <Loader2 size={10} className="animate-spin" /> : (t.isActive ? 'Active' : 'Inactive')}
                </button>
              </td>
              <td className="py-2 text-xs text-muted-foreground">{formatDateTime(t.updatedAt)}</td>
              <td className="py-2">
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => { setEditing(t); setCreating(false); setFormError(null); }}
                    aria-label={`Edit ${t.name}`}
                    className="p-1 rounded text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(t.id)}
                    disabled={busy === t.id}
                    aria-label={`Delete ${t.name}`}
                    className="p-1 rounded text-muted-foreground hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {templates.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                No templates yet. Create one above.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface FormProps {
  initial: TemplateDto | null;
  isBusy: boolean;
  error: string | null;
  onSave: (data: { name: string; promptBody: string; encounterType: string; isActive: boolean }) => void;
  onCancel: () => void;
}

function TemplateForm({ initial, isBusy, error, onSave, onCancel }: FormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [promptBody, setPromptBody] = useState(initial?.promptBody ?? '');
  const [encounterType, setEncounterType] = useState(initial?.encounterType ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ name, promptBody, encounterType, isActive });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded border border-border p-4 flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{initial ? 'Edit template' : 'New template'}</h3>

      <div className="flex flex-col gap-1">
        <label htmlFor="t-name" className="text-xs text-muted-foreground">Name *</label>
        <input
          id="t-name"
          type="text"
          required
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-8 rounded border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="t-type" className="text-xs text-muted-foreground">Encounter type</label>
        <input
          id="t-type"
          type="text"
          value={encounterType}
          onChange={e => setEncounterType(e.target.value)}
          placeholder="e.g. primary-care, urgent"
          className="h-8 rounded border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="t-prompt" className="text-xs text-muted-foreground">Prompt body *</label>
        <textarea
          id="t-prompt"
          required
          value={promptBody}
          onChange={e => setPromptBody(e.target.value)}
          rows={6}
          className="rounded border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {initial && (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={e => setIsActive(e.target.checked)}
            className="rounded"
          />
          Active (visible to providers)
        </label>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle size={12} aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          {isBusy && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
          {initial ? 'Save changes' : 'Create template'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-8 px-3 rounded border border-input text-sm hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
