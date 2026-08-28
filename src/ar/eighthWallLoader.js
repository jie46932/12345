import {
  EIGHTH_WALL_CDN_SCRIPT_PATHS,
  EIGHTH_WALL_LOCAL_SCRIPT_PATHS,
} from './eighthWallConfig';

function waitForGlobal(globalName, eventName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener(eventName, handleLoaded);
      reject(new Error(`${globalName} did not load before timeout`));
    }, 15000);

    const handleLoaded = () => {
      window.clearTimeout(timeout);
      resolve(window[globalName]);
    };

    window.addEventListener(eventName, handleLoaded, { once: true });
  });
}

function loadScript(src, attrs = {}) {
  const existing = document.querySelector(`script[data-8thwall-src="${src}"]`);
  if (existing?.dataset.loaded === 'true') return Promise.resolve();
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.dataset.eighthwallSrc = src;
    for (const [key, value] of Object.entries(attrs)) {
      if (value != null) script.setAttribute(key, value);
    }
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

async function loadScriptWithFallback(localSrc, cdnSrc, attrs) {
  try {
    await loadScript(localSrc, attrs);
  } catch (localError) {
    console.warn('[8thwall] local runtime unavailable, using CDN fallback', localError);
    await loadScript(cdnSrc, attrs);
  }
}

export async function loadEighthWallRuntime() {
  if (typeof window === 'undefined') throw new Error('8th Wall requires a browser runtime');

  await loadScriptWithFallback(
    EIGHTH_WALL_LOCAL_SCRIPT_PATHS.extras,
    EIGHTH_WALL_CDN_SCRIPT_PATHS.extras,
  );
  await waitForGlobal('XRExtras', 'xrextrasloaded');

  await loadScriptWithFallback(
    EIGHTH_WALL_LOCAL_SCRIPT_PATHS.landingPage,
    EIGHTH_WALL_CDN_SCRIPT_PATHS.landingPage,
  );

  await loadScriptWithFallback(
    EIGHTH_WALL_LOCAL_SCRIPT_PATHS.xr,
    EIGHTH_WALL_CDN_SCRIPT_PATHS.xr,
    { async: '', 'data-preload-chunks': 'slam' },
  );

  await waitForGlobal('XR8', 'xrloaded');
  return {
    XR8: window.XR8,
    XRExtras: window.XRExtras,
    LandingPage: window.LandingPage,
  };
}
