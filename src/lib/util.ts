let counter = 0;

/** crypto.randomUUID が無い環境（古い Safari / http）でも一意な id を作る */
export function uid(prefix = 'm'): string {
  const cryptoRef = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return `${prefix}_${cryptoRef.randomUUID()}`;
  }
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatTime(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return '';
  }
}

/** キーを伏せて表示する（gsk_abcd…wxyz） */
export function maskKey(key: string): string {
  if (key.length <= 10) return key.length ? `${key.slice(0, 3)}…` : '';
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}
