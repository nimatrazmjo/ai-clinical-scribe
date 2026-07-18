import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getAdminEncounters,
  getAdminProviders,
  type AdminEncounterDto,
  type ProviderDto,
} from '@/api/admin';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatPatientName } from '@/lib/formatters';
import { EncounterStatus } from '@contracts';
import { cn } from '@/lib/cn';

// Debounce a fast-changing value so anything keyed on it (here, the encounters
// query) only reacts once the value settles — e.g. after the user stops typing.
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function AdminEncountersPage() {
  const [providerFilter, setProviderFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Only query 500ms after the admin stops typing the provider ID — no request
  // (or possible 500 on a partial ID) per keystroke.
  const debouncedProvider = useDebouncedValue(providerFilter.trim(), 500);

  const { data: providers = [] } = useQuery<ProviderDto[]>({
    queryKey: ['admin', 'providers'],
    queryFn: ({ signal }) => getAdminProviders(signal),
  });

  const params = {
    ...(debouncedProvider && { providerId: debouncedProvider }),
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
            list="admin-providers"
            value={providerFilter}
            onChange={e => setProviderFilter(e.target.value)}
            placeholder="Type or pick a provider…"
            className="h-7 w-64 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <datalist id="admin-providers">
            {providers.map(p => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName} ({p.email})
              </option>
            ))}
          </datalist>
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { setProviderFilter(''); setFromDate(''); setToDate(''); }}
          >
            Clear
          </Button>
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
