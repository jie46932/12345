import { enterProductAR, isProductARSupported } from '../xr/productXRStore';
import {
  QUICK_LOOK_PROVIDER,
  QUICK_LOOK_SAFARI_REQUIRED_MESSAGE,
  QUICK_LOOK_SAFARI_REQUIRED_PROVIDER,
  QUICK_LOOK_UNAVAILABLE_MESSAGE,
  openQuickLook,
} from './quickLookConfig';
import {
  EIGHTH_WALL_PROVIDER,
  isEighthWallMobilePlatform,
} from './eighthWallConfig';

function getUserAgent() {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent || '';
}

function isIOSLike() {
  if (typeof navigator === 'undefined') return false;
  const ua = getUserAgent();
  return /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isAndroidLike() {
  return /Android/i.test(getUserAgent());
}

function getIOSBrowser() {
  const ua = getUserAgent();
  if (/CriOS/i.test(ua)) return 'chrome-ios';
  if (/FxiOS/i.test(ua)) return 'firefox-ios';
  if (/EdgiOS/i.test(ua)) return 'edge-ios';
  if (/Version\/[\d.]+.*Mobile\/.*Safari/i.test(ua)) return 'safari-ios';
  return 'ios-webkit';
}

function detectDevicePlatform() {
  const platform = isIOSLike()
    ? 'ios'
    : isAndroidLike()
      ? 'android'
      : 'desktop';
  const browser = platform === 'ios' ? getIOSBrowser() : isAndroidLike() ? 'android-browser' : 'desktop-browser';
  const secure = typeof window !== 'undefined' ? window.isSecureContext : false;
  const webXRAvailable = Boolean(navigator.xr?.isSessionSupported);

  return {
    platform,
    browser,
    secure,
    webXRAvailable,
  };
}

export async function detectARPlatform() {
  const platformInfo = detectDevicePlatform();
  const immersiveARSupported = platformInfo.platform === 'android' ? await isProductARSupported() : false;

  return {
    ...platformInfo,
    immersiveARSupported,
    provider: isEighthWallMobilePlatform(platformInfo.platform)
      ? EIGHTH_WALL_PROVIDER
      : 'unsupported',
    fallbackProvider: immersiveARSupported
      ? 'webxr'
      : platformInfo.platform === 'ios'
        ? platformInfo.browser === 'safari-ios'
          ? QUICK_LOOK_PROVIDER
          : QUICK_LOOK_SAFARI_REQUIRED_PROVIDER
        : null,
  };
}

export async function enterAndroidWebXR() {
  return enterProductAR();
}

export function enterIOSQuickLook() {
  return openQuickLook();
}

export function showARUnsupportedNotice(platformInfo) {
  if (platformInfo?.provider === QUICK_LOOK_SAFARI_REQUIRED_PROVIDER) {
    return QUICK_LOOK_SAFARI_REQUIRED_MESSAGE;
  }
  if (platformInfo?.platform === 'ios') {
    return QUICK_LOOK_UNAVAILABLE_MESSAGE;
  }
  if (platformInfo?.platform === 'android') {
    return '请使用支持 ARCore 的安卓手机 Chrome，并通过 HTTPS 打开页面';
  }
  return '请使用 iPhone 或安卓手机 Chrome/Safari 通过 HTTPS 打开 8th Wall AR 预览';
}

export async function launchProductAR() {
  const deviceInfo = detectDevicePlatform();
  document.documentElement.dataset.viewerARPlatform = deviceInfo.platform;
  document.documentElement.dataset.viewerARLaunchState = 'starting';

  if (isEighthWallMobilePlatform(deviceInfo.platform)) {
    const platformInfo = await detectARPlatform();
    document.documentElement.dataset.viewerARProvider = EIGHTH_WALL_PROVIDER;
    document.documentElement.dataset.viewerARLaunchState = 'opening-8th-wall';
    return {
      ...platformInfo,
      provider: EIGHTH_WALL_PROVIDER,
      launchState: 'opening-8th-wall',
    };
  }

  const platformInfo = await detectARPlatform();
  document.documentElement.dataset.viewerARProvider = platformInfo.provider;

  if (platformInfo.provider === 'webxr') {
    await enterAndroidWebXR();
    document.documentElement.dataset.viewerARLaunchState = 'started';
    return { ...platformInfo, launchState: 'started' };
  }

  const error = new Error(showARUnsupportedNotice(platformInfo));
  error.platformInfo = platformInfo;
  error.code = 'ar_unsupported';
  document.documentElement.dataset.viewerARLaunchState = 'unsupported';
  throw error;
}
