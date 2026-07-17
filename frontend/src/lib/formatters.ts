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

export function formatDate(iso: string): string {
  return DATE_FMT.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return DATE_TIME_FMT.format(new Date(iso));
}

export function formatPatientName(firstName: string, lastName: string): string {
  return `${lastName}, ${firstName}`;
}

export function formatDob(iso: string): string {
  return DATE_FMT.format(new Date(iso));
}
