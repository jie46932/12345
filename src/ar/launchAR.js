import { enterProductAR, isProductARSupported } from '../xr/productXRStore';
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

function isLocalSecureException() {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
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
      : null,
  };
}

export async function enterAndroidWebXR() {
  return enterProductAR();
}

export function showARUnsupportedNotice(platformInfo) {
  if (platformInfo?.platform === 'ios') {
    return '请使用 iPhone Chrome 或 Safari 通过 HTTPS 打开 8th Wall AR 预览';
  }
  if (platformInfo?.platform === 'android') {
    return '请使用支持 ARCore 的安卓手机 Chrome，并通过 HTTPS 打开页面';
  }
  return '请使用 iPhone 或安卓手机 Chrome/Safari 通过 HTTPS 打开 AR 预览';
}

export async function launchProductAR() {
  const deviceInfo = detectDevicePlatform();
  document.documentElement.dataset.viewerARPlatform = deviceInfo.platform;
  document.documentElement.dataset.viewerARLaunchState = 'starting';

  if (isEighthWallMobilePlatform(deviceInfo.platform)) {
    if (!deviceInfo.secure && !isLocalSecureException()) {
      const error = new Error('真实 AR 相机放置需要 HTTPS 页面，请用 HTTPS 打开当前项目页后再点 AR 按钮');
      error.platformInfo = deviceInfo;
      error.code = 'ar_insecure_context';
      document.documentElement.dataset.viewerARProvider = EIGHTH_WALL_PROVIDER;
      document.documentElement.dataset.viewerARLaunchState = 'insecure-context';
      throw error;
    }
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
