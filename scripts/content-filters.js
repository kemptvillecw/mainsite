export const filterKeys = ['type', 'author', 'tag', 'from', 'to', 'period'];
export function readFilters(search) {
  const source = new URLSearchParams(search); const result = new URLSearchParams();
  for (const key of [...filterKeys, 'page']) for (const value of [...new Set(source.getAll(key))]) if (value) result.append(key, value);
  return result;
}
export function toggleFilter(params, key, value, checked) {
  const next = new URLSearchParams(params); const values = next.getAll(key).filter(item => item !== value);
  if (checked) values.push(value);
  next.delete(key); values.forEach(item => next.append(key, item)); next.delete('page');
  return next;
}
export function localDay(date, timezone = 'America/Toronto') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(key => parts.find(part => part.type === key).value).join('-');
}
export function datePreset(preset, today = localDay(new Date())) {
  if (preset === 'all' || preset === 'custom') return { from: '', to: '' };
  const date = new Date(today + 'T12:00:00Z');
  if (preset === '7' || preset === '30') date.setUTCDate(date.getUTCDate() - Number(preset) + 1);
  else if (preset === 'month') date.setUTCDate(1);
  else if (preset === 'year') { date.setUTCMonth(0); date.setUTCDate(1); }
  return { from: date.toISOString().slice(0, 10), to: today };
}
