import { useNavigate, Link } from 'react-router-dom';
import { PlusCircle, AlertCircle, Clock, CheckCircle, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEncountersQuery } from './useEncountersQuery';
import { formatDateTime, formatPatientName } from '@/lib/formatters';
import { cn } from '@/lib/cn';
import type { EncounterStatus } from '@contracts';

const statusLabel: Record<string, string> = {
  draft: 'Draft',
  finalized: 'Finalized',
};

const statusStyles: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  finalized: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const StatusIcon = ({ status }: { status: string }) =>
  status === 'finalized'
    ? <CheckCircle size={10} aria-hidden="true" className="shrink-0" />
    : <Clock size={10} aria-hidden="true" className="shrink-0" />;

function StatusBadge({ status }: { status: EncounterStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
        statusStyles[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      <StatusIcon status={status} />
      {statusLabel[status] ?? status}
    </span>
  );
}

export function EncounterListPage() {
  const navigate = useNavigate();
  const { data: encounters, isLoading, isError, error } = useEncountersQuery();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-semibold">Encounters</h1>
        <Button asChild>
          <Link to="/encounters/new">
            <PlusCircle size={14} aria-hidden="true" />
            New encounter
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div aria-label="Loading encounters" className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 rounded bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div role="alert" className="flex items-center gap-2 text-sm text-destructive py-4">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error instanceof Error ? error.message : 'Failed to load encounters'}</span>
        </div>
      )}

      {!isLoading && !isError && encounters?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <Stethoscope size={32} className="text-muted-foreground/40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No encounters yet.</p>
          <Button asChild variant="outline">
            <Link to="/encounters/new">
              <PlusCircle size={14} aria-hidden="true" />
              Start your first encounter
            </Link>
          </Button>
        </div>
      )}

      {!isLoading && !isError && encounters && encounters.length > 0 && (
        <div className="rounded border border-border overflow-hidden">
          <table className="w-full text-sm" aria-label="Encounters list">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Patient</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Date</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {encounters.map((enc, idx) => (
                <tr
                  key={enc.id}
                  onClick={() => navigate(`/encounters/${enc.id}`)}
                  className={cn(
                    'cursor-pointer border-b border-border last:border-0 hover:bg-muted/30 transition-colors',
                    idx % 2 !== 0 && 'bg-muted/10',
                  )}
                >
                  <td className="px-4 py-2.5 font-medium">
                    {formatPatientName(enc.patientFirstName, enc.patientLastName)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {formatDateTime(enc.updatedAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={enc.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
