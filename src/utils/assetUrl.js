const mediaBase = String(import.meta.env.VITE_MEDIA_BASE_URL || '').trim();

function normalizeBase(base) {
  if (!base) return '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

export const MEDIA_BASE_URL = normalizeBase(mediaBase);

function cleanMediaPath(path) {
  return String(path || '')
    .replace(/^\.?\//, '')
    .replace(/^media\//, '');
}

export function mediaUrl(path) {
  const value = String(path || '');
  if (!value) return '';
  if (/^(?:https?:|data:|blob:)/i.test(value)) return value;

  const cleanPath = cleanMediaPath(value);
  if (typeof window !== 'undefined' && window.__electronOffline) {
    return `./media/${cleanPath}`;
  }
  return MEDIA_BASE_URL ? `${MEDIA_BASE_URL}/${cleanPath}` : `/media/${cleanPath}`;
}

export function assetUrl(path) {
  return mediaUrl(path);
}
