const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const DATE_TIME_FMT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function safeDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(iso: string | null | undefined): string {
  const d = safeDate(iso);
  return d ? DATE_FMT.format(d) : '—';
}

export function formatDateTime(iso: string | null | undefined): string {
  const d = safeDate(iso);
  return d ? DATE_TIME_FMT.format(d) : '—';
}

export function formatPatientName(firstName: string, lastName: string): string {
  return `${lastName}, ${firstName}`;
}

export function formatDob(iso: string | null | undefined): string {
  const d = safeDate(iso);
  return d ? DATE_FMT.format(d) : '—';
}
