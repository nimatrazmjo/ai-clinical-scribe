import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdminEncounters, type AdminEncounterDto } from '@/api/admin';
import { formatDateTime, formatPatientName } from '@/lib/formatters';
import { EncounterStatus } from '@contracts';
import { cn } from '@/lib/cn';

export function AdminEncountersPage() {
  const [providerFilter, setProviderFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const params = {
    ...(providerFilter && { providerId: providerFilter }),
    ...(fromDate && { from: fromDate }),
    ...(toDate && { to: toDate }),
  };

  const { data: encounters = [], isLoading, isError } = useQuery<AdminEncounterDto[]>({
    queryKey: ['admin', 'encounters', params],
    queryFn: ({ signal }) => getAdminEncounters(params, signal),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-provider" className="text-xs text-muted-foreground">Provider ID</label>
          <input
            id="filter-provider"
            type="text"
            value={providerFilter}
            onChange={e => setProviderFilter(e.target.value)}
            placeholder="Filter by provider ID…"
            className="h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-from" className="text-xs text-muted-foreground">From</label>
          <input
            id="filter-from"
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-to" className="text-xs text-muted-foreground">To</label>
          <input
            id="filter-to"
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {(providerFilter || fromDate || toDate) && (
          <button
            type="button"
            onClick={() => { setProviderFilter(''); setFromDate(''); setToDate(''); }}
            className="h-7 px-2 rounded border border-input text-xs hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear
          </button>
        )}
      </div>

      {isLoading && <div className="h-32 bg-muted animate-pulse rounded" />}
      {isError && <p className="text-sm text-destructive">Failed to load encounters.</p>}

      {!isLoading && !isError && (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              {['Patient', 'Provider', 'Status', 'Created'].map((h) => (
                <th key={h} className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {encounters.map(enc => (
              <tr key={enc.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="py-2 font-medium">{formatPatientName(enc.patientFirstName, enc.patientLastName)}</td>
                <td className="py-2 text-xs text-muted-foreground">
                  <span className="font-medium">{enc.providerName}</span>
                  <span className="block text-muted-foreground/70">{enc.providerEmail}</span>
                </td>
                <td className="py-2">
                  <span className={cn(
                    'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
                    enc.status === EncounterStatus.Finalized
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-muted text-muted-foreground',
                  )}>
                    {enc.status}
                  </span>
                </td>
                <td className="py-2 text-xs text-muted-foreground">{formatDateTime(enc.createdAt)}</td>
              </tr>
            ))}
            {encounters.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                  No encounters match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
