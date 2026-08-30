import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mediaUrl } from '../utils/assetUrl';
import { loadEighthWallRuntime } from '../ar/eighthWallLoader';
import {
  EIGHTH_WALL_CONTROL_IDLE,
  EIGHTH_WALL_CONTROL_MOVE,
  EIGHTH_WALL_CONTROL_ROTATE,
  EIGHTH_WALL_MODEL_WIDTH_METERS,
  EIGHTH_WALL_PROVIDER,
} from '../ar/eighthWallConfig';

const MODEL_URL = mediaUrl('mainModel-ar-ios11.glb');
const SURFACE_HIT_TYPES = ['DETECTED_SURFACE', 'ESTIMATED_SURFACE', 'FEATURE_POINT'];
const HIT_TYPE_PRIORITY = {
  DETECTED_SURFACE: 0,
  ESTIMATED_SURFACE: 1,
  FEATURE_POINT: 2,
};
const CAMERA_FEED_TIMEOUT_MS = 5000;
const FLOW_SCANNING = 'scanning';
const FLOW_READY_TO_PLACE = 'ready-to-place';
const FLOW_PLACED = 'placed';
const MOVE_STEP_METERS = 0.018;
const ROTATE_STEP_RADIANS = THREE.MathUtils.degToRad(2);
const DRAG_ROTATE_SENSITIVITY = 0.009;
const CONTROL_REPEAT_MS = 40;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const AR_ACCENT = 0x5cf7ff;
const FLOOR_GRID_RADIUS = 1.6;
const FLOOR_GRID_SPACING = 0.22;
const SELECTION_RING_RADIUS = 0.72;
const CAMERA_PIXEL_SAMPLE_SIZE = 32;
const CAMERA_PIXEL_MIN_LUMA = 10;
const CAMERA_PIXEL_MIN_VARIANCE = 6;
const CAMERA_PIXEL_READY_FRAMES = 3;
const CAMERA_PIXEL_BLACK_FRAMES = 18;
const AR_PIPELINE_VERSION = '20260829-surface-projected-marker-model-root';
const VIDEO_FRAME_READY_FRAMES = 3;
const NATIVE_VIDEO_FALLBACK_DELAY_MS = 4500;

function setARData(name, value) {
  document.documentElement.dataset[name] = String(value);
}

function setInitialDatasets() {
  setARData('viewerARProvider', EIGHTH_WALL_PROVIDER);
  setARData('viewerARLaunchState', 'starting');
  setARData('viewerARMode', 'active');
  setARData('viewerARPlaneReady', 'false');
  setARData('viewerARReticleReady', 'false');
  setARData('viewerARPlaced', 'false');
  setARData('viewerARControlMode', EIGHTH_WALL_CONTROL_IDLE);
  setARData('viewerARScaleLocked', 'true');
  setARData('viewerARRotationLockedAxis', 'vertical');
  setARData('viewerARFlowState', FLOW_SCANNING);
  setARData('viewerARMoveControlsVisible', 'false');
  setARData('viewerARRotateControlsVisible', 'false');
  setARData('viewerARPlacementRequiresReticle', 'true');
  setARData('viewerARPlacementMarkerVisible', 'false');
  setARData('viewerAROverlayActive', 'true');
  setARData('viewerARFloorGridVisible', 'false');
  setARData('viewerARTapToPlaceVisible', 'false');
  setARData('viewerARSelectionVisible', 'false');
  setARData('viewerARDragging', 'false');
  setARData('viewerARRotationRingVisible', 'false');
  setARData('viewerARLastMoveX', '');
  setARData('viewerARLastMoveZ', '');
  setARData('viewerARLastRotateRadians', '0');
  setARData('viewerARResetCount', '0');
  setARData('viewerARCameraPipelineStarted', 'false');
  setARData('viewerARCameraFeedReady', 'false');
  setARData('viewerARCameraViewportReady', 'false');
  setARData('viewerARCameraFrameCount', '0');
  setARData('viewerARCameraLumaMean', '0');
  setARData('viewerARCameraLumaVariance', '0');
  setARData('viewerARCameraNonBlackFrameCount', '0');
  setARData('viewerARCameraTextureReady', 'false');
  setARData('viewerARCameraBlackFrameSuspected', 'false');
  setARData('viewerARSurfaceHitSeen', 'false');
  setARData('viewerARModelReady', 'false');
  setARData('viewerARModelVisible', 'false');
  setARData('viewerARModelMeshCount', '0');
  setARData('viewerARModelScreenX', '');
  setARData('viewerARModelScreenY', '');
  setARData('viewerARReticleScreenX', '');
  setARData('viewerARReticleScreenY', '');
  setARData('viewerARSurfaceQualified', 'false');
  setARData('viewerARHitCount', '0');
  setARData('viewerARHitType', '');
  setARData('viewerARTrackingStatus', '');
  setARData('viewerARTrackingReason', '');
  setARData('viewerARPipelineVersion', AR_PIPELINE_VERSION);
  setARData('viewerARCameraDirectionRequested', 'unknown');
  setARData('viewerARCameraPixelArrayReady', 'false');
  setARData('viewerARCameraPixelArrayLength', '0');
  setARData('viewerARCameraPixelMin', '0');
  setARData('viewerARCameraPixelMax', '0');
  setARData('viewerARThreeRendererTransparent', 'false');
  setARData('viewerARNativeCameraVideoReady', 'false');
  setARData('viewerARNativeCameraVideoWidth', '0');
  setARData('viewerARNativeCameraVideoHeight', '0');
  setARData('viewerARNativeCameraVideoLumaMean', '0');
  setARData('viewerARNativeCameraVideoError', '');
}

function isARDebugTelemetryEnabled() {
  try {
    return new URLSearchParams(window.location.search).get('arDebug') === '1';
  } catch {
    return false;
  }
}

function sendARDebugState() {
  if (!isARDebugTelemetryEnabled()) return;
  fetch('/__ar-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      href: window.location.href,
      dataset: { ...document.documentElement.dataset },
      timestamp: Date.now(),
    }),
    keepalive: true,
  }).catch(() => {});
}

function makeReticle() {
  const group = new THREE.Group();
  group.name = 'eighth_wall_reticle';
  const square = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.18, 0.004, -0.18),
      new THREE.Vector3(0.18, 0.004, -0.18),
      new THREE.Vector3(0.18, 0.004, 0.18),
      new THREE.Vector3(-0.18, 0.004, 0.18),
    ]),
    new THREE.LineBasicMaterial({ color: AR_ACCENT, transparent: true, opacity: 0.95 }),
  );
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.045, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, side: THREE.DoubleSide }),
  );
  dot.rotation.x = -Math.PI / 2;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.42),
    new THREE.MeshBasicMaterial({ color: 0x0a0f14, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
  );
  shadow.rotation.x = -Math.PI / 2;
  group.add(shadow, square, dot);
  group.visible = false;
  return group;
}

function makeFloorGrid() {
  const group = new THREE.Group();
  group.name = 'eighth_wall_floor_grid';
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const geometry = new THREE.CircleGeometry(0.018, 18);
  for (let x = -FLOOR_GRID_RADIUS; x <= FLOOR_GRID_RADIUS; x += FLOOR_GRID_SPACING) {
    for (let z = -FLOOR_GRID_RADIUS; z <= FLOOR_GRID_RADIUS; z += FLOOR_GRID_SPACING) {
      if (Math.hypot(x, z) > FLOOR_GRID_RADIUS) continue;
      const dot = new THREE.Mesh(geometry, material);
      dot.position.set(x, 0.006, z);
      dot.rotation.x = -Math.PI / 2;
      group.add(dot);
    }
  }
  group.visible = false;
  return group;
}

function makeSelectionVisuals() {
  const group = new THREE.Group();
  group.name = 'eighth_wall_selection_visuals';
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(SELECTION_RING_RADIUS - 0.02, SELECTION_RING_RADIUS, 96),
    new THREE.MeshBasicMaterial({
      color: AR_ACCENT,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.name = 'eighth_wall_selection_rotation_ring';
  ring.rotation.x = -Math.PI / 2;
  const footprint = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.5, 0.01, -0.5),
      new THREE.Vector3(0.5, 0.01, -0.5),
      new THREE.Vector3(0.5, 0.01, 0.5),
      new THREE.Vector3(-0.5, 0.01, 0.5),
    ]),
    new THREE.LineBasicMaterial({ color: AR_ACCENT, transparent: true, opacity: 0.95 }),
  );
  group.add(ring, footprint);
  group.visible = false;
  return group;
}

function prepareModel(sourceScene) {
  const normalizedModel = sourceScene.clone(true);
  normalizedModel.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(normalizedModel);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const width = Math.max(size.x, size.z);
  const scale = width > 0 ? EIGHTH_WALL_MODEL_WIDTH_METERS / width : 0.01;

  const placementRoot = new THREE.Group();
  placementRoot.name = 'eighth_wall_product_placement_root';
  normalizedModel.name = 'eighth_wall_product_normalized_model';
  normalizedModel.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  normalizedModel.scale.setScalar(scale);
  placementRoot.userData.lockedScale = 1;
  placementRoot.userData.lockedY = 0;
  placementRoot.userData.modelScale = scale;
  placementRoot.userData.sourceSize = size;
  placementRoot.add(normalizedModel);
  placementRoot.traverse((object) => {
    object.frustumCulled = false;
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return placementRoot;
}

function applyLockedTransform(model) {
  if (!model) return;
  const lockedScale = Number(model.userData.lockedScale) || EIGHTH_WALL_MODEL_WIDTH_METERS;
  model.scale.setScalar(lockedScale);
  model.rotation.x = 0;
  model.rotation.z = 0;
  if (Number.isFinite(model.userData.lockedY)) {
    model.position.y = model.userData.lockedY;
  }
  setARData('viewerARScaleLocked', 'true');
  setARData('viewerARRotationLockedAxis', 'vertical');
}

function copyHitToObject(hit, object) {
  if (!hit?.position || !object) return false;
  object.position.set(hit.position.x, hit.position.y, hit.position.z);
  if (hit.rotation) {
    object.quaternion.set(hit.rotation.x, hit.rotation.y, hit.rotation.z, hit.rotation.w);
    object.rotation.x = 0;
    object.rotation.z = 0;
  }
  if (object.userData) object.userData.lockedY = object.position.y;
  applyLockedTransform(object);
  return true;
}

function syncSelectionVisuals(model, selection) {
  if (!model || !selection) return;
  selection.position.copy(model.position);
  selection.rotation.set(0, model.rotation.y, 0);
  selection.position.y = (Number(model.userData.lockedY) || 0) + 0.012;
}

function setSelectionVisible(selection, visible) {
  if (selection) selection.visible = visible;
  setARData('viewerARSelectionVisible', visible ? 'true' : 'false');
}

function setFloorGridVisible(floorGrid, visible) {
  if (floorGrid) floorGrid.visible = visible;
  setARData('viewerARFloorGridVisible', visible ? 'true' : 'false');
}

function isSurfaceHit(hit) {
  return hit?.type === 'DETECTED_SURFACE' || hit?.type === 'ESTIMATED_SURFACE';
}

function getClientPointFromWorld(camera, worldPosition) {
  if (!camera || !worldPosition) return null;
  const projected = new THREE.Vector3(worldPosition.x, worldPosition.y, worldPosition.z).project(camera);
  if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y) || projected.z < -1 || projected.z > 1) {
    return null;
  }
  return {
    x: (projected.x * 0.5 + 0.5) * window.innerWidth,
    y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
  };
}

function isUiControlTarget(target) {
  return Boolean(target?.closest?.('.eighth-wall-control-button, .eighth-wall-mode-button, .eighth-wall-reset-button, .eighth-wall-exit-button'));
}

function pickBestHit(hits) {
  if (!Array.isArray(hits) || hits.length === 0) return null;
  return [...hits]
    .filter((hit) => hit?.position)
    .sort((a, b) => (HIT_TYPE_PRIORITY[a.type] ?? 99) - (HIT_TYPE_PRIORITY[b.type] ?? 99))[0] || null;
}

function getHitAtNormalizedPoint(XR8, x, y) {
  let hits = [];
  try {
    hits = XR8.XrController.hitTest(x, y, SURFACE_HIT_TYPES) || [];
  } catch {
    hits = [];
  }
  if (!hits.length) {
    try {
      hits = XR8.XrController.hitTest(x, y) || [];
    } catch {
      hits = [];
    }
  }
  setARData('viewerARHitCount', String(hits.length));
  const hit = pickBestHit(hits);
  setARData('viewerARHitType', hit?.type || '');
  return hit;
}

function getScreenHit(XR8, element, clientX, clientY) {
  const rect = element?.getBoundingClientRect?.();
  const width = rect?.width || window.innerWidth || 1;
  const height = rect?.height || window.innerHeight || 1;
  const left = rect?.left || 0;
  const top = rect?.top || 0;
  const x = THREE.MathUtils.clamp((clientX - left) / width, 0, 1);
  const y = THREE.MathUtils.clamp((clientY - top) / height, 0, 1);
  return getHitAtNormalizedPoint(XR8, x, y);
}

function getCenterHit(XR8) {
  return getHitAtNormalizedPoint(XR8, 0.5, 0.58);
}

function getViewportFromProcessGpuResult(processGpuResult) {
  return processGpuResult?.gltexturerenderer?.viewport ||
    processGpuResult?.glTextureRenderer?.viewport ||
    processGpuResult?.viewport ||
    null;
}

function noteTrackingState(processCpuResult) {
  const reality = processCpuResult?.reality;
  if (!reality) return;
  if (reality.trackingStatus) setARData('viewerARTrackingStatus', reality.trackingStatus);
  if (reality.trackingReason) setARData('viewerARTrackingReason', reality.trackingReason);
}

function hasUsableViewport(viewport) {
  if (!viewport) return false;
  const width = viewport.width ?? viewport.w ?? viewport[2] ?? 0;
  const height = viewport.height ?? viewport.h ?? viewport[3] ?? 0;
  return Number(width) > 0 && Number(height) > 0;
}

function getPixelArray(processCpuResult) {
  return processCpuResult?.camerapixelarray?.pixels ||
    processCpuResult?.cameraPixelArray?.pixels ||
    processCpuResult?.camerapixelarray ||
    processCpuResult?.cameraPixelArray ||
    processCpuResult?.pixels ||
    null;
}

function analyzeCameraPixels(pixels) {
  if (!pixels?.length) return null;
  const stride = pixels.length % 4 === 0 ? 4 : pixels.length % 3 === 0 ? 3 : 1;
  let count = 0;
  let sum = 0;
  let squareSum = 0;
  let min = 255;
  let max = 0;
  for (let i = 0; i < pixels.length; i += stride) {
    const r = Number(pixels[i]) || 0;
    const g = stride > 1 ? Number(pixels[i + 1]) || 0 : r;
    const b = stride > 2 ? Number(pixels[i + 2]) || 0 : r;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    min = Math.min(min, r, g, b);
    max = Math.max(max, r, g, b);
    sum += luma;
    squareSum += luma * luma;
    count += 1;
  }
  if (!count) return null;
  const mean = sum / count;
  const variance = Math.max(0, squareSum / count - mean * mean);
  return { mean, variance, min, max, length: pixels.length };
}

function fitCanvasToViewport(canvas) {
  if (!canvas) return;
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const width = Math.max(1, Math.round((window.innerWidth || canvas.clientWidth || 1) * dpr));
  const height = Math.max(1, Math.round((window.innerHeight || canvas.clientHeight || 1) * dpr));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  setARData('viewerARCanvasWidth', String(width));
  setARData('viewerARCanvasHeight', String(height));
  setARData('viewerARCanvasDpr', String(dpr));
}

function getBackCameraRunOptions(XR8) {
  try {
    const cameraConfig = XR8?.XrConfig?.camera?.();
    const backDirection = cameraConfig?.BACK || cameraConfig?.back || 'back';
    setARData('viewerARCameraDirectionRequested', 'back');
    return { cameraConfig: { direction: backDirection } };
  } catch {
    setARData('viewerARCameraDirectionRequested', 'default');
    return {};
  }
}

function sampleVideoLuma(video) {
  if (!video?.videoWidth || !video?.videoHeight) return null;
  const canvas = document.createElement('canvas');
  canvas.width = CAMERA_PIXEL_SAMPLE_SIZE;
  canvas.height = CAMERA_PIXEL_SAMPLE_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  try {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return analyzeCameraPixels(pixels);
  } catch {
    return null;
  }
}

function makeCameraHealthModule({
  cameraFeedReadyRef,
  setCameraIssue,
  setStatusText,
  canUpdateScanStatus = () => true,
}) {
  let frameCount = 0;
  let viewportReady = false;
  let nonBlackFrameCount = 0;
  let blackFrameCount = 0;

  const markFeedReady = (reason) => {
    if (cameraFeedReadyRef.current) return;
    cameraFeedReadyRef.current = true;
    setARData('viewerARCameraFeedReady', 'true');
    setARData('viewerARCameraFeedReadyReason', reason);
    setARData('viewerARCameraBlackFrameSuspected', 'false');
    setCameraIssue(false);
    if (canUpdateScanStatus()) setStatusText('移动手机扫描地面或桌面');
  };

  const noteFrame = (processGpuResult) => {
    frameCount += 1;
    setARData('viewerARCameraFrameCount', String(frameCount));
    const viewport = getViewportFromProcessGpuResult(processGpuResult);
    if (hasUsableViewport(viewport)) {
      viewportReady = true;
      setARData('viewerARCameraViewportReady', 'true');
    }
  };

  const notePixels = (processCpuResult) => {
    const pixels = getPixelArray(processCpuResult);
    setARData('viewerARCameraPixelArrayReady', pixels?.length ? 'true' : 'false');
    setARData('viewerARCameraPixelArrayLength', String(pixels?.length || 0));
    const stats = analyzeCameraPixels(pixels);
    if (!stats) return;
    setARData('viewerARCameraLumaMean', stats.mean.toFixed(2));
    setARData('viewerARCameraLumaVariance', stats.variance.toFixed(2));
    setARData('viewerARCameraPixelMin', String(stats.min));
    setARData('viewerARCameraPixelMax', String(stats.max));
    const nonBlack = stats.mean >= CAMERA_PIXEL_MIN_LUMA || stats.variance >= CAMERA_PIXEL_MIN_VARIANCE;
    if (nonBlack) {
      nonBlackFrameCount += 1;
      blackFrameCount = 0;
      setARData('viewerARCameraNonBlackFrameCount', String(nonBlackFrameCount));
      setARData('viewerARCameraBlackFrameSuspected', 'false');
      if (viewportReady && nonBlackFrameCount >= CAMERA_PIXEL_READY_FRAMES) {
        markFeedReady('camera-pixels');
      }
      return;
    }
    blackFrameCount += 1;
    if (!cameraFeedReadyRef.current && blackFrameCount >= CAMERA_PIXEL_BLACK_FRAMES) {
      setARData('viewerARCameraBlackFrameSuspected', 'true');
      setCameraIssue(true);
      setStatusText('相机正在运行，但画面是黑帧');
    }
  };

  return {
    name: 'he-furniture-camera-health',
    onStart: () => {
      setARData('viewerARCameraPipelineStarted', 'true');
    },
    onUpdate: ({ processGpuResult, processCpuResult } = {}) => {
      noteFrame(processGpuResult);
      notePixels(processCpuResult);
      noteTrackingState(processCpuResult);
    },
  };
}

function markCameraFeedReadyFromSurfaceHit({
  cameraFeedReadyRef,
  setCameraIssue,
}) {
  setARData('viewerARSurfaceHitSeen', 'true');
  if (cameraFeedReadyRef.current) {
    setCameraIssue(false);
    setARData('viewerARCameraBlackFrameSuspected', 'false');
  }
}

function installGestureHandlers({
  element,
  XR8,
  modelRef,
  reticleRef,
  floorGridRef,
  selectionRef,
  placedRef,
  latestHitRef,
  controlModeRef,
  setStatusText,
  setARControlMode,
  setARFlowState,
  setPlacementMarkerVisible,
  setTapToPlaceVisible,
  modelReadyRef,
  cameraIssueRef,
  syncModelScreenData,
}) {
  const pointers = new Map();
  const dragState = {
    activeId: null,
    startX: 0,
    startRotationY: 0,
  };

  const place = (clientX, clientY) => {
    if (placedRef.current) return;
    if (cameraIssueRef.current) {
      setStatusText('摄像头画面未启动，请刷新或使用兜底 AR');
      return;
    }
    if (!modelReadyRef.current) {
      setStatusText('正在加载模型');
      return;
    }

    const model = modelRef.current;
    const hit = getScreenHit(XR8, element, clientX, clientY) || latestHitRef.current || getCenterHit(XR8);
    if (!isSurfaceHit(hit)) {
      setStatusText('继续移动手机，等待识别真实平面');
      return;
    }
    if (!model || !hit || !reticleRef.current?.visible || !copyHitToObject(hit, model)) {
      setStatusText('移动手机扫描地面或桌面');
      return;
    }

    model.visible = true;
    setARData('viewerARModelVisible', 'true');
    applyLockedTransform(model);
    syncModelScreenData(model);
    reticleRef.current.visible = false;
    setFloorGridVisible(floorGridRef.current, false);
    placedRef.current = true;
    setARFlowState(FLOW_PLACED);
    setPlacementMarkerVisible(false);
    setTapToPlaceVisible(false);
    syncSelectionVisuals(model, selectionRef.current);
    setSelectionVisible(selectionRef.current, true);
    setARControlMode(EIGHTH_WALL_CONTROL_MOVE);
    setARData('viewerARPlaced', 'true');
    setARData('viewerARFlowState', FLOW_PLACED);
    setARData('viewerARLastMoveX', String(model.position.x));
    setARData('viewerARLastMoveZ', String(model.position.z));
    setStatusText('拖动调整位置，切换旋转调整朝向');
  };

  const beginDrag = (pointerId, clientX) => {
    const model = modelRef.current;
    if (!model || !placedRef.current) return;
    dragState.activeId = pointerId;
    dragState.startX = clientX;
    dragState.startRotationY = model.rotation.y;
    setARData('viewerARDragging', 'true');
    setStatusText(controlModeRef.current === EIGHTH_WALL_CONTROL_ROTATE ? '左右拖动旋转模型' : '拖动模型到目标位置');
  };

  const movePlacedModel = (clientX, clientY) => {
    const model = modelRef.current;
    if (!model || !placedRef.current) return;
    const hit = getScreenHit(XR8, element, clientX, clientY);
    if (!hit?.position) return;
    model.position.set(hit.position.x, hit.position.y, hit.position.z);
    model.userData.lockedY = model.position.y;
    applyLockedTransform(model);
    syncSelectionVisuals(model, selectionRef.current);
    syncModelScreenData(model);
    setARData('viewerARLastMoveX', String(model.position.x));
    setARData('viewerARLastMoveZ', String(model.position.z));
  };

  const rotatePlacedModel = (clientX) => {
    const model = modelRef.current;
    if (!model || !placedRef.current) return;
    const delta = (clientX - dragState.startX) * DRAG_ROTATE_SENSITIVITY;
    model.rotation.y = dragState.startRotationY - delta;
    applyLockedTransform(model);
    syncSelectionVisuals(model, selectionRef.current);
    syncModelScreenData(model);
    setARData('viewerARLastRotateRadians', String(model.rotation.y));
  };

  const onPointerDown = (event) => {
    if (isUiControlTarget(event.target)) return;
    element.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
    if (!placedRef.current) {
      place(event.clientX, event.clientY);
      return;
    }
    beginDrag(event.pointerId, event.clientX);
  };

  const onPointerMove = (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    if (dragState.activeId !== event.pointerId || !placedRef.current) return;
    if (controlModeRef.current === EIGHTH_WALL_CONTROL_ROTATE) {
      rotatePlacedModel(event.clientX);
      return;
    }
    movePlacedModel(event.clientX, event.clientY);
  };

  const onPointerUp = (event) => {
    pointers.delete(event.pointerId);
    if (dragState.activeId === event.pointerId) {
      dragState.activeId = null;
      setARData('viewerARDragging', 'false');
      if (placedRef.current) setStatusText('拖动调整位置，切换旋转调整朝向');
    }
  };

  const touchId = (touch) => `touch-${touch.identifier ?? 0}`;

  const onTouchStart = (event) => {
    if (window.PointerEvent) return;
    if (isUiControlTarget(event.target)) return;
    event.preventDefault();
    const touch = event.changedTouches[0];
    if (!touch) return;
    const id = touchId(touch);
    pointers.set(id, { clientX: touch.clientX, clientY: touch.clientY });
    if (!placedRef.current) {
      place(touch.clientX, touch.clientY);
      return;
    }
    beginDrag(id, touch.clientX);
  };

  const onTouchMove = (event) => {
    if (window.PointerEvent) return;
    event.preventDefault();
    const touch = [...event.changedTouches].find((item) => touchId(item) === dragState.activeId);
    if (!touch) return;
    pointers.set(dragState.activeId, { clientX: touch.clientX, clientY: touch.clientY });
    if (controlModeRef.current === EIGHTH_WALL_CONTROL_ROTATE) {
      rotatePlacedModel(touch.clientX);
      return;
    }
    movePlacedModel(touch.clientX, touch.clientY);
  };

  const onTouchEnd = (event) => {
    if (window.PointerEvent) return;
    event.preventDefault();
    [...event.changedTouches].forEach((touch) => pointers.delete(touchId(touch)));
    if (![...event.touches].some((touch) => touchId(touch) === dragState.activeId)) {
      dragState.activeId = null;
      setARData('viewerARDragging', 'false');
      if (placedRef.current) setStatusText('拖动调整位置，切换旋转调整朝向');
    }
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('pointercancel', onPointerUp);
  element.addEventListener('touchstart', onTouchStart, { passive: false });
  element.addEventListener('touchmove', onTouchMove, { passive: false });
  element.addEventListener('touchend', onTouchEnd, { passive: false });
  element.addEventListener('touchcancel', onTouchEnd, { passive: false });

  return () => {
    setARData('viewerARDragging', 'false');
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', onPointerUp);
    element.removeEventListener('pointercancel', onPointerUp);
    element.removeEventListener('touchstart', onTouchStart);
    element.removeEventListener('touchmove', onTouchMove);
    element.removeEventListener('touchend', onTouchEnd);
    element.removeEventListener('touchcancel', onTouchEnd);
  };
}

export default function EighthWallARExperience({ onClose, onError }) {
  const nativeVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const touchLayerRef = useRef(null);
  const cleanupRef = useRef(null);
  const controlIntervalRef = useRef(0);
  const cameraRef = useRef(null);
  const modelRef = useRef(null);
  const reticleRef = useRef(null);
  const floorGridRef = useRef(null);
  const selectionRef = useRef(null);
  const latestHitRef = useRef(null);
  const placedRef = useRef(false);
  const controlModeRef = useRef(EIGHTH_WALL_CONTROL_IDLE);
  const flowStateRef = useRef(FLOW_SCANNING);
  const modelReadyRef = useRef(false);
  const cameraFeedReadyRef = useRef(false);
  const cameraIssueRef = useRef(false);
  const [statusText, setStatusText] = useState('正在启动 AR');
  const [controlMode, setControlMode] = useState(EIGHTH_WALL_CONTROL_IDLE);
  const [cameraIssue, setCameraIssue] = useState(false);
  const [flowState, setFlowState] = useState(FLOW_SCANNING);
  const [moveControlsVisible, setMoveControlsVisible] = useState(false);
  const [rotateControlsVisible, setRotateControlsVisible] = useState(false);
  const [placementMarkerVisible, setPlacementMarkerVisibleState] = useState(false);
  const [tapToPlaceVisible, setTapToPlaceVisibleState] = useState(false);
  const [placementMarkerScreen, setPlacementMarkerScreen] = useState({ x: 50, y: 55 });
  const [resetCount, setResetCount] = useState(0);

  const setARFlowState = (nextState) => {
    flowStateRef.current = nextState;
    setFlowState(nextState);
    setARData('viewerARFlowState', nextState);
  };

  const setPlacementMarkerVisible = (visible) => {
    setPlacementMarkerVisibleState(visible);
    setARData('viewerARPlacementMarkerVisible', visible ? 'true' : 'false');
  };

  const setTapToPlaceVisible = (visible) => {
    setTapToPlaceVisibleState(visible);
    setARData('viewerARTapToPlaceVisible', visible ? 'true' : 'false');
  };

  const setPlacementMarkerScreenFromHit = (hit) => {
    const point = getClientPointFromWorld(cameraRef.current, hit?.position);
    if (!point) return;
    const x = THREE.MathUtils.clamp((point.x / Math.max(1, window.innerWidth)) * 100, 12, 88);
    const y = THREE.MathUtils.clamp((point.y / Math.max(1, window.innerHeight)) * 100, 24, 82);
    setPlacementMarkerScreen({ x, y });
    setARData('viewerARReticleScreenX', x.toFixed(2));
    setARData('viewerARReticleScreenY', y.toFixed(2));
  };

  const syncModelScreenData = (model) => {
    const point = getClientPointFromWorld(cameraRef.current, model?.position);
    if (!point) return;
    setARData('viewerARModelScreenX', String(Math.round(point.x)));
    setARData('viewerARModelScreenY', String(Math.round(point.y)));
  };

  const setARControlMode = useCallback((mode) => {
    const moveVisible = mode === EIGHTH_WALL_CONTROL_MOVE;
    const rotateVisible = mode === EIGHTH_WALL_CONTROL_ROTATE;
    controlModeRef.current = mode;
    setControlMode(mode);
    setMoveControlsVisible(moveVisible);
    setRotateControlsVisible(rotateVisible);
    setARData('viewerARControlMode', mode);
    setARData('viewerARMoveControlsVisible', moveVisible ? 'true' : 'false');
    setARData('viewerARRotateControlsVisible', rotateVisible ? 'true' : 'false');
    setARData('viewerARRotationRingVisible', rotateVisible ? 'true' : 'false');
  }, []);

  const canUpdateScanStatus = useCallback(() =>
    !placedRef.current &&
    flowStateRef.current !== FLOW_PLACED &&
    document.documentElement.dataset.viewerARControlMode === EIGHTH_WALL_CONTROL_IDLE, []);

  const stopControlAction = () => {
    if (controlIntervalRef.current) window.clearInterval(controlIntervalRef.current);
    controlIntervalRef.current = 0;
  };

  const nudgeModel = (direction) => {
    const model = modelRef.current;
    if (!model || !placedRef.current) return;
    const camera = cameraRef.current;
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    if (camera) {
      camera.getWorldDirection(forward);
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    } else {
      forward.set(0, 0, -1).applyQuaternion(model.quaternion);
      right.set(1, 0, 0).applyQuaternion(model.quaternion);
    }
    forward.y = 0;
    right.y = 0;
    if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
    if (right.lengthSq() < 0.0001) right.set(1, 0, 0);
    forward.normalize();
    right.normalize();

    if (direction === 'front') model.position.addScaledVector(forward, MOVE_STEP_METERS);
    if (direction === 'back') model.position.addScaledVector(forward, -MOVE_STEP_METERS);
    if (direction === 'left') model.position.addScaledVector(right, -MOVE_STEP_METERS);
    if (direction === 'right') model.position.addScaledVector(right, MOVE_STEP_METERS);
    applyLockedTransform(model);
    syncSelectionVisuals(model, selectionRef.current);
    setARData('viewerARLastMoveDirection', direction);
    setARData('viewerARLastMoveX', String(model.position.x));
    setARData('viewerARLastMoveZ', String(model.position.z));
  };

  const rotateModel = (direction) => {
    const model = modelRef.current;
    if (!model || !placedRef.current) return;
    const step = direction === 'left' ? ROTATE_STEP_RADIANS : -ROTATE_STEP_RADIANS;
    model.rotateOnWorldAxis(WORLD_UP, step);
    applyLockedTransform(model);
    syncSelectionVisuals(model, selectionRef.current);
    setARData('viewerARLastRotateDirection', direction);
    setARData('viewerARLastRotateRadians', String(model.rotation.y));
  };

  const startControlAction = (type, direction) => {
    stopControlAction();
    const apply = () => {
      if (type === 'move') nudgeModel(direction);
      if (type === 'rotate') rotateModel(direction);
    };
    apply();
    controlIntervalRef.current = window.setInterval(apply, CONTROL_REPEAT_MS);
  };

  const handleControlStart = (event, type, direction) => {
    event.preventDefault();
    event.stopPropagation();
    startControlAction(type, direction);
  };

  const handleControlStop = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    stopControlAction();
  };

  const handleModeChange = (mode) => {
    if (!placedRef.current) return;
    setARControlMode(mode);
    setStatusText(mode === EIGHTH_WALL_CONTROL_ROTATE ? '左右拖动旋转模型' : '拖动模型到目标位置');
  };

  const handleResetPlacement = () => {
    stopControlAction();
    const model = modelRef.current;
    if (model) model.visible = false;
    placedRef.current = false;
    setSelectionVisible(selectionRef.current, false);
    setFloorGridVisible(floorGridRef.current, Boolean(latestHitRef.current));
    setARControlMode(EIGHTH_WALL_CONTROL_IDLE);
    setARFlowState(latestHitRef.current ? FLOW_READY_TO_PLACE : FLOW_SCANNING);
    setPlacementMarkerVisible(Boolean(latestHitRef.current));
    setTapToPlaceVisible(Boolean(latestHitRef.current));
    setARData('viewerARPlaced', 'false');
    setARData('viewerARDragging', 'false');
    setARData('viewerARLastMoveX', '');
    setARData('viewerARLastMoveZ', '');
    setARData('viewerARLastRotateRadians', '0');
    setResetCount((count) => {
      const next = count + 1;
      setARData('viewerARResetCount', String(next));
      return next;
    });
    setStatusText(latestHitRef.current ? '点击摆放点放置模型' : '移动手机扫描地面或桌面');
  };

  useEffect(() => {
    if (!isARDebugTelemetryEnabled()) return undefined;
    const showPlacementGuide = () => {
      if (flowStateRef.current === FLOW_PLACED) return;
      setARFlowState(FLOW_READY_TO_PLACE);
      setPlacementMarkerVisible(true);
      setTapToPlaceVisible(true);
      setFloorGridVisible(floorGridRef.current, true);
      setStatusText('点击摆放点放置模型');
    };
    window.addEventListener('viewer-ar-debug-show-placement-guide', showPlacementGuide);
    return () => window.removeEventListener('viewer-ar-debug-show-placement-guide', showPlacementGuide);
  }, []);

  useEffect(() => {
	    let cancelled = false;
	    let XR8Ref = null;
	    let cameraEvidenceSeen = false;
	    let debugStateTimer = 0;
    let resizeHandler = null;
    let nativeVideoStream = null;
    let nativeVideoTimer = 0;

    const setCameraIssueState = (value) => {
      if (cameraEvidenceSeen && value) return;
      cameraIssueRef.current = value;
      setCameraIssue(value);
    };

    const markCameraReadyFromHit = () => {
      cameraEvidenceSeen = true;
      markCameraFeedReadyFromSurfaceHit({
        cameraFeedReadyRef,
        setCameraIssue: setCameraIssueState,
        setStatusText,
        canUpdateScanStatus,
      });
    };

    async function start() {
      try {
        setInitialDatasets();
        modelReadyRef.current = false;
        cameraFeedReadyRef.current = false;
        cameraIssueRef.current = false;
        placedRef.current = false;
        controlModeRef.current = EIGHTH_WALL_CONTROL_IDLE;
        flowStateRef.current = FLOW_SCANNING;
        latestHitRef.current = null;
        setARFlowState(FLOW_SCANNING);
        setPlacementMarkerVisible(false);
        setTapToPlaceVisible(false);
        setARControlMode(EIGHTH_WALL_CONTROL_IDLE);
	        setCameraIssue(false);
        const startNativeCameraVideo = async () => {
          const video = nativeVideoRef.current;
          if (!video || !navigator.mediaDevices?.getUserMedia || nativeVideoStream) return;
          try {
            nativeVideoStream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            });
            if (cancelled) {
              nativeVideoStream.getTracks().forEach((track) => track.stop());
              return;
            }
            video.srcObject = nativeVideoStream;
            video.muted = true;
            video.playsInline = true;
            await video.play().catch(() => {});
            let readyFrames = 0;
            nativeVideoTimer = window.setInterval(() => {
              const width = video.videoWidth || 0;
              const height = video.videoHeight || 0;
              setARData('viewerARNativeCameraVideoWidth', String(width));
              setARData('viewerARNativeCameraVideoHeight', String(height));
              const stats = sampleVideoLuma(video);
              if (!stats) return;
              setARData('viewerARNativeCameraVideoLumaMean', stats.mean.toFixed(2));
              const nonBlack = stats.mean >= CAMERA_PIXEL_MIN_LUMA || stats.variance >= CAMERA_PIXEL_MIN_VARIANCE;
              if (!nonBlack) return;
              readyFrames += 1;
              if (readyFrames < VIDEO_FRAME_READY_FRAMES) return;
              setARData('viewerARNativeCameraVideoReady', 'true');
              cameraFeedReadyRef.current = true;
              cameraEvidenceSeen = true;
              setARData('viewerARCameraFeedReady', 'true');
              setARData('viewerARCameraFeedReadyReason', 'native-video-background');
              setARData('viewerARCameraBlackFrameSuspected', 'false');
              setCameraIssueState(false);
            }, 350);
          } catch (error) {
            setARData('viewerARNativeCameraVideoError', error?.message || String(error));
          }
        };
	        if (isARDebugTelemetryEnabled()) {
	          debugStateTimer = window.setInterval(sendARDebugState, 1000);
	        }
	        window.THREE = THREE;
	        const { XR8, XRExtras } = await loadEighthWallRuntime();
        if (cancelled) return;
        XR8Ref = XR8;
        fitCanvasToViewport(canvasRef.current);
        resizeHandler = () => fitCanvasToViewport(canvasRef.current);
        window.addEventListener('resize', resizeHandler);

        XR8.XrController.configure({
          enableLighting: true,
          disableWorldTracking: false,
          scale: 'absolute',
        });
        XR8.Threejs.configure?.({
          renderCameraTexture: true,
        });

        const appModule = {
          name: 'he-furniture-placement-controls',
          onStart: () => {
            const { scene, camera, renderer, cameraTexture } = XR8.Threejs.xrScene();
            cameraRef.current = camera;
            camera.near = 0.01;
            camera.far = 100;
            if (cameraTexture) {
              setARData('viewerARCameraTextureReady', 'true');
            } else {
              setARData('viewerARCameraTextureReady', 'false');
            }
            scene.background = null;
            renderer.setClearColor(0x000000, 0);
            renderer.autoClear = true;
            renderer.autoClearColor = true;
            renderer.autoClearDepth = true;
            renderer.autoClearStencil = false;
            renderer.shadowMap.enabled = true;
            renderer.domElement.style.background = 'transparent';
            renderer.domElement.style.backgroundColor = 'transparent';
            setARData('viewerARThreeRendererTransparent', 'true');

            scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c7ff, 1.7));
            const directional = new THREE.DirectionalLight(0xffffff, 1.1);
            directional.position.set(1, 3, 2);
            scene.add(directional);

            const reticle = makeReticle();
            scene.add(reticle);
            reticleRef.current = reticle;

            const floorGrid = makeFloorGrid();
            scene.add(floorGrid);
            floorGridRef.current = floorGrid;

            const selection = makeSelectionVisuals();
            scene.add(selection);
            selectionRef.current = selection;

            const loader = new GLTFLoader();
            const draco = new DRACOLoader();
            draco.setDecoderPath('/draco/');
            loader.setDRACOLoader(draco);
            loader.setMeshoptDecoder(MeshoptDecoder);
            loader.load(
              MODEL_URL,
              (gltf) => {
                if (cancelled) return;
                const model = prepareModel(gltf.scene);
                model.visible = false;
                scene.add(model);
                modelRef.current = model;
                modelReadyRef.current = true;
                setARData('viewerARModelReady', 'true');
                let meshCount = 0;
                model.traverse((object) => {
                  if (object.isMesh) meshCount += 1;
                });
                setARData('viewerARModelMeshCount', String(meshCount));
                setARData('viewerARModelVisible', model.visible ? 'true' : 'false');
                if (canUpdateScanStatus()) setStatusText('移动手机扫描地面或桌面');
              },
              undefined,
              (error) => {
                setARData('viewerARLaunchState', 'failed');
                setStatusText('模型加载失败');
                onError?.(error);
              },
            );

            cleanupRef.current = installGestureHandlers({
              element: touchLayerRef.current,
              XR8,
              modelRef,
              reticleRef,
              floorGridRef,
              selectionRef,
              placedRef,
              latestHitRef,
              controlModeRef,
              setStatusText,
              setARControlMode,
              setARFlowState,
              setPlacementMarkerVisible,
              setTapToPlaceVisible,
              modelReadyRef,
              cameraIssueRef,
              syncModelScreenData,
            });
          },
          onUpdate: () => {
            if (placedRef.current) {
              applyLockedTransform(modelRef.current);
              syncSelectionVisuals(modelRef.current, selectionRef.current);
              return;
            }
            const reticle = reticleRef.current;
            if (!reticle) return;
            const hit = getCenterHit(XR8);
            latestHitRef.current = hit;
            const hasHit = Boolean(hit);
            const surfaceQualified = isSurfaceHit(hit);
            setARData('viewerARPlaneReady', surfaceQualified ? 'true' : 'false');
            setARData('viewerARSurfaceQualified', surfaceQualified ? 'true' : 'false');
            setARData('viewerARReticleReady', hasHit ? 'true' : 'false');
            reticle.visible = hasHit;
            setPlacementMarkerVisible(hasHit);
            setTapToPlaceVisible(surfaceQualified && modelReadyRef.current);
            setFloorGridVisible(floorGridRef.current, hasHit);
            if (hasHit) {
              setPlacementMarkerScreenFromHit(hit);
              markCameraReadyFromHit();
              copyHitToObject(hit, reticle);
              copyHitToObject(hit, floorGridRef.current);
              reticle.scale.setScalar(1 + Math.sin(Date.now() * 0.006) * 0.055);
              setARFlowState(surfaceQualified ? FLOW_READY_TO_PLACE : FLOW_SCANNING);
              if (!surfaceQualified) {
                setStatusText('继续移动手机，等待识别真实平面');
              } else if (modelReadyRef.current) {
                setStatusText('点击摆放点放置模型');
              } else {
                setStatusText('正在加载模型');
              }
            } else if (!cameraIssueRef.current && modelReadyRef.current) {
              setARFlowState(FLOW_SCANNING);
              setPlacementMarkerVisible(false);
              setTapToPlaceVisible(false);
              setFloorGridVisible(floorGridRef.current, false);
              setStatusText('移动手机扫描地面或桌面');
            }
          },
        };

        const cameraHealthModule = makeCameraHealthModule({
          cameraFeedReadyRef,
          setCameraIssue: setCameraIssueState,
          setStatusText,
          canUpdateScanStatus,
        });

        const cameraPixelArrayModule = XR8.CameraPixelArray?.pipelineModule?.({
          luminance: false,
          maxDimension: CAMERA_PIXEL_SAMPLE_SIZE,
        });

        XR8.addCameraPipelineModules([
          XR8.XrController.pipelineModule(),
          XR8.GlTextureRenderer.pipelineModule(),
          cameraPixelArrayModule,
          XR8.Threejs.pipelineModule(),
          XRExtras.FullWindowCanvas.pipelineModule(),
          XRExtras.Loading.pipelineModule(),
          XRExtras.RuntimeError.pipelineModule(),
          cameraHealthModule,
          appModule,
        ].filter(Boolean));

        const runOptions = {
          canvas: canvasRef.current,
          ...getBackCameraRunOptions(XR8),
        };
        setARData('viewerARCameraPixelArrayModuleAdded', cameraPixelArrayModule ? 'true' : 'false');
        XR8.run(runOptions);
        window.setTimeout(() => {
          if (cancelled || cameraFeedReadyRef.current || latestHitRef.current) return;
          startNativeCameraVideo();
        }, NATIVE_VIDEO_FALLBACK_DELAY_MS);
	        setARData('viewerARLaunchState', 'started');
	        sendARDebugState();
        window.setTimeout(() => {
          if (cancelled || cameraFeedReadyRef.current || cameraEvidenceSeen) return;
          setCameraIssueState(true);
          setARData('viewerARCameraBlackFrameSuspected', 'true');
          setStatusText('摄像头画面未启动，请刷新或使用兜底 AR');
        }, CAMERA_FEED_TIMEOUT_MS);
      } catch (error) {
        if (cancelled) return;
        setARData('viewerARLaunchState', 'failed');
        setStatusText('AR 启动失败');
        onError?.(error);
      }
    }

    start();

    return () => {
	      cancelled = true;
      if (debugStateTimer) window.clearInterval(debugStateTimer);
      if (nativeVideoTimer) window.clearInterval(nativeVideoTimer);
      nativeVideoStream?.getTracks?.().forEach((track) => track.stop());
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
	      cleanupRef.current?.();
      cleanupRef.current = null;
      stopControlAction();
      try {
        XR8Ref?.stop?.();
      } catch (error) {
        console.warn('[8thwall] stop failed', error);
      }
      setARData('viewerARMode', 'inactive');
      setARData('viewerARControlMode', EIGHTH_WALL_CONTROL_IDLE);
      setARData('viewerARMoveControlsVisible', 'false');
      setARData('viewerARRotateControlsVisible', 'false');
      setARData('viewerARPlacementMarkerVisible', 'false');
      setARData('viewerAROverlayActive', 'false');
      setARData('viewerARFloorGridVisible', 'false');
      setARData('viewerARTapToPlaceVisible', 'false');
      setARData('viewerARSelectionVisible', 'false');
      setARData('viewerARDragging', 'false');
      setARData('viewerARRotationRingVisible', 'false');
    };
  }, [canUpdateScanStatus, onError, setARControlMode]);

  return (
    <div
      className={`eighth-wall-ar-shell${cameraIssue ? ' eighth-wall-ar-shell--camera-issue' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="8th Wall AR 预览"
    >
      <video
        ref={nativeVideoRef}
        className="eighth-wall-native-camera-video"
        muted
        playsInline
        aria-hidden="true"
      />
      <canvas ref={canvasRef} id="eighth-wall-camera-feed" className="eighth-wall-camera-feed" />
      <div ref={touchLayerRef} className="eighth-wall-touch-layer" aria-label="AR 放置与控制区域" />
      {placementMarkerVisible && flowState !== FLOW_PLACED && (
        <div
          className="eighth-wall-dom-placement-guide"
          style={{
            '--ar-marker-x': `${placementMarkerScreen.x}%`,
            '--ar-marker-y': `${placementMarkerScreen.y}%`,
          }}
          aria-hidden="true"
        >
          <div className="eighth-wall-dom-dot-grid">
            {Array.from({ length: 77 }).map((_, index) => (
              <span key={index} />
            ))}
          </div>
          <div className="eighth-wall-dom-reticle">
            <span />
          </div>
        </div>
      )}
      {tapToPlaceVisible && flowState === FLOW_READY_TO_PLACE && (
        <div className="eighth-wall-place-hint" aria-hidden="true">
          <span>点击放置</span>
        </div>
      )}
      {flowState === FLOW_PLACED && (
        <div className="eighth-wall-mode-switch" data-reset-count={resetCount}>
          <button
            type="button"
            className={`eighth-wall-mode-button${controlMode === EIGHTH_WALL_CONTROL_MOVE ? ' is-active' : ''}`}
            aria-pressed={controlMode === EIGHTH_WALL_CONTROL_MOVE}
            onClick={() => handleModeChange(EIGHTH_WALL_CONTROL_MOVE)}
          >
            移动
          </button>
          <button
            type="button"
            className={`eighth-wall-mode-button${controlMode === EIGHTH_WALL_CONTROL_ROTATE ? ' is-active' : ''}`}
            aria-pressed={controlMode === EIGHTH_WALL_CONTROL_ROTATE}
            onClick={() => handleModeChange(EIGHTH_WALL_CONTROL_ROTATE)}
          >
            旋转
          </button>
        </div>
      )}
      <div className={`eighth-wall-axis-controls eighth-wall-axis-controls--${controlMode}`}>
        {moveControlsVisible && (
          <>
            <button
              type="button"
              className="eighth-wall-control-button axis axis-front"
              aria-label="向前移动"
              onPointerDown={(event) => handleControlStart(event, 'move', 'front')}
              onPointerUp={handleControlStop}
              onPointerCancel={handleControlStop}
              onPointerLeave={handleControlStop}
              onTouchStart={(event) => handleControlStart(event, 'move', 'front')}
              onTouchEnd={handleControlStop}
              onTouchCancel={handleControlStop}
            >
              <span className="control-arrow">↑</span>
              <span className="control-label">前</span>
            </button>
            <button
              type="button"
              className="eighth-wall-control-button axis axis-back"
              aria-label="向后移动"
              onPointerDown={(event) => handleControlStart(event, 'move', 'back')}
              onPointerUp={handleControlStop}
              onPointerCancel={handleControlStop}
              onPointerLeave={handleControlStop}
              onTouchStart={(event) => handleControlStart(event, 'move', 'back')}
              onTouchEnd={handleControlStop}
              onTouchCancel={handleControlStop}
            >
              <span className="control-arrow">↓</span>
              <span className="control-label">后</span>
            </button>
            <button
              type="button"
              className="eighth-wall-control-button axis axis-left"
              aria-label="向左移动"
              onPointerDown={(event) => handleControlStart(event, 'move', 'left')}
              onPointerUp={handleControlStop}
              onPointerCancel={handleControlStop}
              onPointerLeave={handleControlStop}
              onTouchStart={(event) => handleControlStart(event, 'move', 'left')}
              onTouchEnd={handleControlStop}
              onTouchCancel={handleControlStop}
            >
              <span className="control-arrow">←</span>
              <span className="control-label">左</span>
            </button>
            <button
              type="button"
              className="eighth-wall-control-button axis axis-right"
              aria-label="向右移动"
              onPointerDown={(event) => handleControlStart(event, 'move', 'right')}
              onPointerUp={handleControlStop}
              onPointerCancel={handleControlStop}
              onPointerLeave={handleControlStop}
              onTouchStart={(event) => handleControlStart(event, 'move', 'right')}
              onTouchEnd={handleControlStop}
              onTouchCancel={handleControlStop}
            >
              <span className="control-arrow">→</span>
              <span className="control-label">右</span>
            </button>
          </>
        )}
        {rotateControlsVisible && (
          <div className="rotate-controls" aria-label="Y 轴旋转控制">
            <span className="rotate-ring" aria-hidden="true" />
            <button
              type="button"
              className="eighth-wall-control-button rotate-button rotate-left"
              aria-label="向左旋转"
              onPointerDown={(event) => handleControlStart(event, 'rotate', 'left')}
              onPointerUp={handleControlStop}
              onPointerCancel={handleControlStop}
              onPointerLeave={handleControlStop}
              onTouchStart={(event) => handleControlStart(event, 'rotate', 'left')}
              onTouchEnd={handleControlStop}
              onTouchCancel={handleControlStop}
            >
              ↶
            </button>
            <button
              type="button"
              className="eighth-wall-control-button rotate-button rotate-right"
              aria-label="向右旋转"
              onPointerDown={(event) => handleControlStart(event, 'rotate', 'right')}
              onPointerUp={handleControlStop}
              onPointerCancel={handleControlStop}
              onPointerLeave={handleControlStop}
              onTouchStart={(event) => handleControlStart(event, 'rotate', 'right')}
              onTouchEnd={handleControlStop}
              onTouchCancel={handleControlStop}
            >
              ↷
            </button>
          </div>
        )}
      </div>
      <div className="eighth-wall-status-panel">
        <span className="eighth-wall-status-title">AR 预览</span>
        <span className="eighth-wall-status-text">{statusText}</span>
        {cameraIssue && (
          <span className="eighth-wall-status-help">摄像头权限已请求，但相机画面没有输出。</span>
        )}
        {cameraIssue && (
          <span className="eighth-wall-fallback-actions">
            <button
              type="button"
              onClick={() => onError?.(new Error('8th Wall camera feed unavailable'))}
            >
              使用兜底 AR
            </button>
            <button type="button" onClick={onClose}>返回</button>
          </span>
        )}
      </div>
      <button type="button" className="eighth-wall-exit-button" onClick={onClose}>
        ←
      </button>
      <button
        type="button"
        className="eighth-wall-reset-button"
        aria-label="重置 AR 放置"
        onClick={handleResetPlacement}
      >
        ↻
      </button>
      <style>{`
	        .eighth-wall-ar-shell {
	          position: fixed;
	          inset: 0;
	          z-index: 700;
	          overflow: hidden;
	          background: #080b10;
	          color: #ffffff;
	          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	          touch-action: none;
	        }

        .eighth-wall-camera-feed,
        .eighth-wall-native-camera-video,
        .eighth-wall-touch-layer {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .eighth-wall-native-camera-video {
          z-index: 0;
          object-fit: cover;
          background: #080b10;
        }

	        .eighth-wall-camera-feed {
	          z-index: 1;
	          display: block;
	          background: transparent;
	        }

        .eighth-wall-touch-layer {
          z-index: 2;
          background: transparent;
          touch-action: none;
        }

        .eighth-wall-dom-placement-guide {
          position: fixed;
          inset: 0;
          z-index: 3;
          pointer-events: none;
        }

        .eighth-wall-dom-dot-grid {
          position: absolute;
          left: var(--ar-marker-x, 50%);
          top: calc(var(--ar-marker-y, 55%) + 7vh);
          width: min(92vw, 460px);
          display: grid;
          grid-template-columns: repeat(11, 1fr);
          gap: 14px 18px;
          transform: translate(-50%, -50%) perspective(360px) rotateX(58deg);
          transform-origin: center;
          opacity: 0.78;
        }

        .eighth-wall-dom-dot-grid span {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.35);
        }

        .eighth-wall-dom-reticle {
          position: absolute;
          left: var(--ar-marker-x, 50%);
          top: var(--ar-marker-y, 55%);
          width: 82px;
          height: 82px;
          transform: translate(-50%, -50%) perspective(360px) rotateX(58deg);
          border: 4px solid rgba(92, 247, 255, 0.95);
          border-radius: 8px;
          box-shadow: 0 0 18px rgba(92, 247, 255, 0.45);
        }

        .eighth-wall-dom-reticle span {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
          transform: translate(-50%, -50%);
        }

        .eighth-wall-place-hint {
          position: fixed;
          left: 50%;
          top: 50%;
          z-index: 4;
          transform: translate(-50%, calc(-50% + 74px));
          display: grid;
          place-items: center;
          min-width: 178px;
          min-height: 54px;
          padding: 0 22px;
          border: 0;
          border-radius: 999px;
          background: #ffffff;
          color: #07090d;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: 0;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
          pointer-events: none;
        }

        .eighth-wall-status-panel {
          position: fixed;
          left: 50%;
          bottom: calc(28px + env(safe-area-inset-bottom, 0px));
          z-index: 5;
          transform: translateX(-50%);
          display: flex;
          min-width: min(78vw, 340px);
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 18px;
          border: 1px solid rgba(255, 255, 255, 0.26);
          border-radius: 8px;
          background: rgba(10, 14, 20, 0.72);
          text-align: center;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          pointer-events: none;
        }

        .eighth-wall-status-help {
          max-width: 280px;
          font-size: 12px;
          line-height: 1.45;
          color: rgba(255, 255, 255, 0.72);
        }

        .eighth-wall-fallback-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          pointer-events: auto;
        }

        .eighth-wall-fallback-actions button {
          min-height: 34px;
          padding: 0 12px;
          border: 1px solid rgba(255, 255, 255, 0.28);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
          font-size: 13px;
          font-weight: 800;
        }

        .eighth-wall-status-title {
          font-size: 12px;
          font-weight: 700;
          line-height: 1;
          opacity: 0.74;
        }

        .eighth-wall-status-text {
          font-size: 15px;
          font-weight: 700;
          line-height: 1.35;
        }

        .eighth-wall-exit-button {
          position: fixed;
          top: calc(18px + env(safe-area-inset-top, 0px));
          left: 18px;
          z-index: 5;
          width: 62px;
          height: 62px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: rgba(5, 7, 11, 0.76);
          color: #ffffff;
          font-size: 38px;
          font-weight: 500;
          line-height: 1;
          display: grid;
          place-items: center;
          -webkit-tap-highlight-color: transparent;
        }

        .eighth-wall-reset-button {
          position: fixed;
          top: calc(18px + env(safe-area-inset-top, 0px));
          right: 18px;
          z-index: 5;
          width: 62px;
          height: 62px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: rgba(5, 7, 11, 0.76);
          color: #ffffff;
          font-size: 38px;
          font-weight: 700;
          line-height: 1;
          display: grid;
          place-items: center;
          -webkit-tap-highlight-color: transparent;
        }

        .eighth-wall-mode-switch {
          position: fixed;
          left: 50%;
          bottom: calc(94px + env(safe-area-inset-bottom, 0px));
          z-index: 5;
          transform: translateX(-50%);
          display: grid;
          grid-template-columns: repeat(2, minmax(72px, 1fr));
          gap: 4px;
          width: min(72vw, 210px);
          padding: 4px;
          border-radius: 8px;
          background: rgba(5, 7, 11, 0.68);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .eighth-wall-mode-button {
          height: 38px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: rgba(255, 255, 255, 0.72);
          font-size: 14px;
          font-weight: 850;
          letter-spacing: 0;
          -webkit-tap-highlight-color: transparent;
        }

        .eighth-wall-mode-button.is-active {
          background: #5cf7ff;
          color: #061014;
        }

        .eighth-wall-axis-controls {
          position: fixed;
          inset: 0;
          z-index: 3;
          pointer-events: none;
        }

        .eighth-wall-control-button {
          position: fixed;
          display: grid;
          place-items: center;
          border: 0;
          background: transparent;
          color: #5cf7ff;
          font-size: 15px;
          font-weight: 800;
        }

        .eighth-wall-control-button {
          pointer-events: auto;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent;
        }

        .eighth-wall-control-button:active {
          transform: translate(-50%, -50%) scale(0.96);
        }

        .axis {
          width: 76px;
          height: 52px;
          text-shadow: 0 3px 12px rgba(0, 0, 0, 0.46);
          grid-template-rows: 36px 14px;
        }

        .control-arrow {
          font-size: 44px;
          line-height: 1;
        }

        .control-label {
          font-size: 11px;
          line-height: 1;
          color: rgba(255, 255, 255, 0.78);
        }

        .axis-front { left: 50%; top: 38%; transform: translate(-50%, -50%); }
        .axis-back { left: 50%; top: 65%; transform: translate(-50%, -50%); }
        .axis-left { left: 24%; top: 55%; transform: translate(-50%, -50%); }
        .axis-right { left: 76%; top: 55%; transform: translate(-50%, -50%); }

        .rotate-controls {
          position: fixed;
          left: 50%;
          bottom: calc(132px + env(safe-area-inset-bottom, 0px));
          z-index: 3;
          width: min(92vw, 430px);
          height: min(34vw, 150px);
          transform: translateX(-50%);
          pointer-events: none;
        }

        .rotate-ring {
          position: absolute;
          left: 50%;
          bottom: -44px;
          width: min(88vw, 410px);
          height: min(88vw, 410px);
          transform: translateX(-50%);
          border: 14px solid rgba(92, 247, 255, 0.88);
          border-top-color: transparent;
          border-left-color: rgba(92, 247, 255, 0.54);
          border-right-color: rgba(92, 247, 255, 0.54);
          border-radius: 50%;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
        }

        .rotate-button {
          position: absolute;
          top: 54%;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: rgba(5, 7, 11, 0.48);
          color: #5cf7ff;
          font-size: 42px;
          line-height: 1;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .rotate-left {
          left: 10px;
          transform: translateY(-50%);
        }

        .rotate-right {
          right: 10px;
          transform: translateY(-50%);
        }

        .rotate-button:active {
          transform: translateY(-50%) scale(0.96);
        }

        @media (max-height: 720px) {
          .axis-front { top: 34%; }
          .axis-back { top: 61%; }
          .eighth-wall-mode-switch { bottom: calc(82px + env(safe-area-inset-bottom, 0px)); }
          .eighth-wall-place-hint { transform: translate(-50%, calc(-50% + 58px)); }
        }
      `}</style>
    </div>
  );
}
