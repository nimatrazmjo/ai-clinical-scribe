import type { TemplateDto } from '@contracts';

interface Props {
  templates: TemplateDto[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
}

export function TemplateSelector({ templates, selectedId, onChange }: Props) {
  if (templates.length === 0) {
    return <span className="text-xs text-muted-foreground">No active templates</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="template-select" className="text-xs text-muted-foreground whitespace-nowrap">
        Template
      </label>
      <select
        id="template-select"
        value={selectedId ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className="h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Default</option>
        {templates.map(t => (
          <option key={t.id} value={t.id}>
            {t.name}{t.encounterType ? ` (${t.encounterType})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
