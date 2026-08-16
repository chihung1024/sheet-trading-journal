const finiteAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new TypeError('Cash event amount must be finite');
  return amount;
};

export const calendarDateAtOffset = (value, timezoneOffsetMinutes) => {
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  if (!Number.isFinite(timestamp) || !Number.isFinite(timezoneOffsetMinutes)) {
    throw new TypeError('A valid date and timezone offset are required');
  }
  return new Date(timestamp - timezoneOffsetMinutes * 60_000).toISOString().slice(0, 10);
};

export const localCalendarDate = (date = new Date()) => (
  calendarDateAtOffset(date, date.getTimezoneOffset())
);

export const formatCashEventAmount = (event, locale = undefined) => {
  const amount = finiteAmount(event?.amount);
  const formatted = Math.abs(amount).toLocaleString(locale, { maximumFractionDigits: 8 });
  if (event?.event_type === 'DEPOSIT') return `+${formatted}`;
  if (event?.event_type === 'WITHDRAWAL') return `-${formatted}`;
  if (event?.event_type === 'OPENING_BALANCE') {
    return amount.toLocaleString(locale, { maximumFractionDigits: 8 });
  }
  throw new TypeError('Cash event type is invalid');
};
