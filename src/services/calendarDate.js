function requireValidDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError('A valid Date is required');
  }
  return value;
}

export function formatCalendarDateInTimeZone(date, timeZone) {
  requireValidDate(date);
  if (typeof timeZone !== 'string' || !timeZone.trim()) {
    throw new TypeError('A non-empty IANA time zone is required');
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type === 'year' || part.type === 'month' || part.type === 'day')
      .map((part) => [part.type, part.value]),
  );

  if (!values.year || !values.month || !values.day) {
    throw new Error('Unable to format calendar date');
  }
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatLocalCalendarDate(date = new Date()) {
  requireValidDate(date);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!timeZone) throw new Error('Browser time zone is unavailable');
  return formatCalendarDateInTimeZone(date, timeZone);
}
