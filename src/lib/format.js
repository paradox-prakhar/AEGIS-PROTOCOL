export function shortAddress(a, head = 6, tail = 4) {
  if (!a) return '';
  return a.length > head + tail + 1 ? `${a.slice(0, head)}…${a.slice(-tail)}` : a;
}

export function formatDate(seconds) {
  if (!seconds) return '—';
  return new Date(seconds * 1000).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function relativeTime(seconds, now = Date.now() / 1000) {
  const diff = Math.round(seconds - now);
  const abs = Math.abs(diff);
  const units = [['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, size] of units) {
    if (abs >= size || unit === 'second') return rtf.format(Math.round(diff / size), unit);
  }
  return '';
}

export function duration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatUsdc(value, digits = 4) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export const isEvmAddress = (v) => /^0x[a-fA-F0-9]{40}$/.test(v || '');
export const isTxHash = (v) => /^0x[a-fA-F0-9]{64}$/.test(v || '');

export function downloadJson(filename, data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
