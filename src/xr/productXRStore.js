import { createXRStore } from '@react-three/xr';

export const productXRStore = createXRStore({
  offerSession: false,
  emulate: false,
  hitTest: 'required',
  domOverlay: true,
  anchors: true,
  handTracking: false,
  layers: false,
  meshDetection: false,
  planeDetection: true,
  controller: false,
  hand: false,
  gaze: false,
  transientPointer: false,
});

export async function isProductARSupported() {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;
  if (!navigator.xr?.isSessionSupported) return false;
  try {
    return await navigator.xr.isSessionSupported('immersive-ar');
  } catch {
    return false;
  }
}

export async function enterProductAR() {
  if (!(await isProductARSupported())) {
    throw new Error('请使用支持 ARCore 的安卓手机 Chrome，并通过 HTTPS 打开页面');
  }
  return productXRStore.enterAR();
}

export function exitProductAR() {
  return productXRStore.getState().session?.end?.();
}
