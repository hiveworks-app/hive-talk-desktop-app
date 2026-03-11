const KEY = 'hive-device-id';

export function getBrowserDeviceId(): string {
  const stored = localStorage.getItem(KEY);
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem(KEY, id);
  return id;
}
