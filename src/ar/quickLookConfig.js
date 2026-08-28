import { mediaUrl } from '../utils/assetUrl';

export const QUICK_LOOK_PROVIDER = 'quick-look';
export const QUICK_LOOK_SAFARI_REQUIRED_PROVIDER = 'quick-look-safari-required';
export const QUICK_LOOK_USDZ_URL = mediaUrl('12345-ar.usdz');
export const QUICK_LOOK_UNAVAILABLE_MESSAGE =
  '请使用 iPhone Chrome 打开并允许系统 Quick Look 进入 AR 预览';
export const QUICK_LOOK_SAFARI_REQUIRED_MESSAGE =
  '苹果手机请使用 Safari 打开 AR 预览；当前 Chrome 无法直接唤起系统 Quick Look。';

export function getQuickLookUrl() {
  return `${QUICK_LOOK_USDZ_URL}#allowsContentScaling=1`;
}

export function getSafariQuickLookPageUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('ar', 'quicklook');
  return url.toString();
}

export function openQuickLook() {
  const link = document.createElement('a');
  link.rel = 'ar';
  link.href = getQuickLookUrl();
  link.style.position = 'fixed';
  link.style.left = '-9999px';
  link.style.width = '1px';
  link.style.height = '1px';
  link.setAttribute('aria-hidden', 'true');

  const preview = document.createElement('img');
  preview.alt = '';
  preview.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  link.appendChild(preview);

  document.body.appendChild(link);
  link.click();
  link.remove();

  return { provider: QUICK_LOOK_PROVIDER, launchUrl: link.href };
}
