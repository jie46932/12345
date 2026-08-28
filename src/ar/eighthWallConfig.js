export const EIGHTH_WALL_PROVIDER = '8th-wall';
export const EIGHTH_WALL_CONTROL_IDLE = 'idle';
export const EIGHTH_WALL_CONTROL_MOVE = 'move';
export const EIGHTH_WALL_CONTROL_ROTATE = 'rotate';
export const EIGHTH_WALL_LONG_PRESS_MS = 450;
export const EIGHTH_WALL_MODEL_WIDTH_METERS = 1;
export const EIGHTH_WALL_LOCAL_SCRIPT_PATHS = {
  xr: '/external/xr/xr.js',
  extras: '/external/xrextras/xrextras.js',
  landingPage: '/external/landing-page/landing-page.js',
};
export const EIGHTH_WALL_CDN_SCRIPT_PATHS = {
  xr: 'https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1/dist/xr.js',
  extras: 'https://cdn.jsdelivr.net/npm/@8thwall/xrextras@1/dist/xrextras.js',
  landingPage: 'https://cdn.jsdelivr.net/npm/@8thwall/landing-page@1/dist/landing-page.js',
};

export function isEighthWallMobilePlatform(platform) {
  return platform === 'ios' || platform === 'android';
}
