import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { mediaUrl } from '../utils/assetUrl';
import { loadEighthWallRuntime } from '../ar/eighthWallLoader';
import {
  EIGHTH_WALL_CONTROL_IDLE,
  EIGHTH_WALL_CONTROL_MOVE,
  EIGHTH_WALL_CONTROL_ROTATE,
  EIGHTH_WALL_LONG_PRESS_MS,
  EIGHTH_WALL_MODEL_WIDTH_METERS,
  EIGHTH_WALL_PROVIDER,
} from '../ar/eighthWallConfig';

const MODEL_URL = mediaUrl('12345-draco.gltf');
const SURFACE_HIT_TYPES = ['DETECTED_SURFACE', 'ESTIMATED_SURFACE'];
const CAMERA_FEED_TIMEOUT_MS = 5000;
const FLOW_SCANNING = 'scanning';
const FLOW_READY_TO_PLACE = 'ready-to-place';
const FLOW_PLACED = 'placed';
const MOVE_STEP_METERS = 0.018;
const ROTATE_STEP_RADIANS = THREE.MathUtils.degToRad(2);
const CONTROL_REPEAT_MS = 40;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

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
  setARData('viewerARCameraPipelineStarted', 'false');
  setARData('viewerARCameraFeedReady', 'false');
  setARData('viewerARCameraViewportReady', 'false');
  setARData('viewerARCameraFrameCount', '0');
  setARData('viewerARCameraBlackFrameSuspected', 'false');
  setARData('viewerARModelReady', 'false');
}

function makeReticle() {
  const group = new THREE.Group();
  group.name = 'eighth_wall_reticle';
  const outerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.22, 0.245, 72),
    new THREE.MeshBasicMaterial({ color: 0x5cf7ff, transparent: true, opacity: 0.96, side: THREE.DoubleSide }),
  );
  outerRing.rotation.x = -Math.PI / 2;
  const innerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.055, 0.07, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.86, side: THREE.DoubleSide }),
  );
  innerRing.rotation.x = -Math.PI / 2;
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.022, 32),
    new THREE.MeshBasicMaterial({ color: 0x5cf7ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  dot.rotation.x = -Math.PI / 2;
  const axisMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.78 });
  const axisX = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.006, 0.006), axisMaterial);
  const axisZ = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.34), axisMaterial);
  group.add(outerRing, innerRing, dot, axisX, axisZ);
  group.visible = false;
  return group;
}

function prepareModel(sourceScene) {
  const model = sourceScene.clone(true);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const width = Math.max(size.x, size.z);
  const scale = width > 0 ? EIGHTH_WALL_MODEL_WIDTH_METERS / width : 0.01;

  model.position.sub(center);
  model.position.y += size.y / 2;
  model.scale.setScalar(scale);
  model.userData.lockedScale = scale;
  model.userData.lockedY = 0;
  model.traverse((object) => {
    object.frustumCulled = false;
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return model;
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

function getCenterHit(XR8) {
  return XR8.XrController.hitTest(0.5, 0.5, SURFACE_HIT_TYPES)
    .find((hit) => hit.type === 'DETECTED_SURFACE' || hit.type === 'ESTIMATED_SURFACE') || null;
}

function getViewportFromProcessGpuResult(processGpuResult) {
  return processGpuResult?.gltexturerenderer?.viewport ||
    processGpuResult?.glTextureRenderer?.viewport ||
    processGpuResult?.viewport ||
    null;
}

function hasUsableViewport(viewport) {
  if (!viewport) return false;
  const width = viewport.width ?? viewport.w ?? viewport[2] ?? 0;
  const height = viewport.height ?? viewport.h ?? viewport[3] ?? 0;
  return Number(width) > 0 && Number(height) > 0;
}

function makeCameraHealthModule({
  cameraFeedReadyRef,
  setCameraIssue,
  setStatusText,
  canUpdateScanStatus = () => true,
}) {
  let frameCount = 0;
  let viewportReady = false;

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
    if (viewportReady && frameCount >= 2) markFeedReady('gltexturerenderer-viewport');
  };

  return {
    name: 'he-furniture-camera-health',
    onStart: () => {
      setARData('viewerARCameraPipelineStarted', 'true');
    },
    onUpdate: ({ processGpuResult } = {}) => {
      noteFrame(processGpuResult);
      if (viewportReady) markFeedReady('gltexturerenderer-viewport');
    },
  };
}

function markCameraFeedReadyFromSurfaceHit({
  cameraFeedReadyRef,
  setCameraIssue,
  setStatusText,
  canUpdateScanStatus = () => true,
}) {
  if (cameraFeedReadyRef.current) {
    setCameraIssue(false);
    setARData('viewerARCameraBlackFrameSuspected', 'false');
    return;
  }
  cameraFeedReadyRef.current = true;
  setARData('viewerARCameraFeedReady', 'true');
  setARData('viewerARCameraFeedReadyReason', 'surface-hit');
  setARData('viewerARCameraBlackFrameSuspected', 'false');
  setCameraIssue(false);
  if (canUpdateScanStatus()) setStatusText('移动手机扫描地面或桌面');
}

function installGestureHandlers({
  element,
  XR8,
  modelRef,
  reticleRef,
  placedRef,
  latestHitRef,
  setStatusText,
  setControlMode,
  setARFlowState,
  setMoveControlsVisible,
  setRotateControlsVisible,
  setPlacementMarkerVisible,
  modelReadyRef,
  cameraIssueRef,
}) {
  const pointers = new Map();
  let longPressTimer = 0;
  let longPressActivated = false;

  const setMode = (mode) => {
    const moveVisible = mode === EIGHTH_WALL_CONTROL_MOVE;
    const rotateVisible = mode === EIGHTH_WALL_CONTROL_ROTATE;
    setControlMode(mode);
    setMoveControlsVisible(moveVisible);
    setRotateControlsVisible(rotateVisible);
    setARData('viewerARControlMode', mode);
    setARData('viewerARMoveControlsVisible', moveVisible ? 'true' : 'false');
    setARData('viewerARRotateControlsVisible', rotateVisible ? 'true' : 'false');
  };

  const clearLongPress = () => {
    if (longPressTimer) window.clearTimeout(longPressTimer);
    longPressTimer = 0;
  };

  const showPlacedIdle = () => {
    setMode(EIGHTH_WALL_CONTROL_IDLE);
    setStatusText('模型已放置，单指长按移动，双指长按旋转');
  };

  const beginLongPress = () => {
    clearLongPress();
    longPressActivated = false;
    longPressTimer = window.setTimeout(() => {
      if (!placedRef.current) return;
      longPressActivated = true;
      if (pointers.size >= 2) {
        setMode(EIGHTH_WALL_CONTROL_ROTATE);
        setStatusText('按住左转或右转箭头旋转');
      } else if (pointers.size === 1) {
        setMode(EIGHTH_WALL_CONTROL_MOVE);
        setStatusText('按住方向箭头移动模型');
      }
    }, EIGHTH_WALL_LONG_PRESS_MS);
  };

  const place = () => {
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
    const hit = latestHitRef.current || getCenterHit(XR8);
    if (!model || !hit || !reticleRef.current?.visible || !copyHitToObject(hit, model)) {
      setStatusText('移动手机扫描地面或桌面');
      return;
    }

    model.visible = true;
    applyLockedTransform(model);
    reticleRef.current.visible = false;
    placedRef.current = true;
    setARFlowState(FLOW_PLACED);
    setPlacementMarkerVisible(false);
    setARData('viewerARPlaced', 'true');
    setARData('viewerARFlowState', FLOW_PLACED);
    showPlacedIdle();
  };

  const onPointerDown = (event) => {
    if (event.target.closest?.('.eighth-wall-control-button')) return;
    element.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
    if (!placedRef.current) {
      place();
      return;
    }
    beginLongPress();
  };

  const onPointerMove = (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
  };

  const onPointerUp = (event) => {
    pointers.delete(event.pointerId);
    clearLongPress();
    if (pointers.size === 0) {
      if (placedRef.current && !longPressActivated) showPlacedIdle();
      longPressActivated = false;
    } else {
      beginLongPress();
    }
  };

  const syncTouches = (touches) => {
    pointers.clear();
    [...touches].forEach((touch, index) => {
      pointers.set(touch.identifier ?? index, {
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
    });
  };

  const onTouchStart = (event) => {
    if (event.target.closest?.('.eighth-wall-control-button')) return;
    event.preventDefault();
    syncTouches(event.touches);
    if (!placedRef.current) {
      place();
      return;
    }
    beginLongPress();
  };

  const onTouchMove = (event) => {
    event.preventDefault();
    syncTouches(event.touches);
  };

  const onTouchEnd = (event) => {
    event.preventDefault();
    syncTouches(event.touches);
    clearLongPress();
    if (pointers.size === 0) {
      if (placedRef.current && !longPressActivated) showPlacedIdle();
      longPressActivated = false;
    } else {
      beginLongPress();
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
    clearLongPress();
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
  const canvasRef = useRef(null);
  const touchLayerRef = useRef(null);
  const cleanupRef = useRef(null);
  const controlIntervalRef = useRef(0);
  const cameraRef = useRef(null);
  const modelRef = useRef(null);
  const reticleRef = useRef(null);
  const latestHitRef = useRef(null);
  const placedRef = useRef(false);
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

  const setARFlowState = (nextState) => {
    flowStateRef.current = nextState;
    setFlowState(nextState);
    setARData('viewerARFlowState', nextState);
  };

  const setPlacementMarkerVisible = (visible) => {
    setARData('viewerARPlacementMarkerVisible', visible ? 'true' : 'false');
  };

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
    setARData('viewerARLastMoveDirection', direction);
  };

  const rotateModel = (direction) => {
    const model = modelRef.current;
    if (!model || !placedRef.current) return;
    const step = direction === 'left' ? ROTATE_STEP_RADIANS : -ROTATE_STEP_RADIANS;
    model.rotateOnWorldAxis(WORLD_UP, step);
    applyLockedTransform(model);
    setARData('viewerARLastRotateDirection', direction);
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

  useEffect(() => {
    let cancelled = false;
    let XR8Ref = null;
    let cameraEvidenceSeen = false;

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
        flowStateRef.current = FLOW_SCANNING;
        latestHitRef.current = null;
        setARFlowState(FLOW_SCANNING);
        setPlacementMarkerVisible(false);
        setControlMode(EIGHTH_WALL_CONTROL_IDLE);
        setMoveControlsVisible(false);
        setRotateControlsVisible(false);
        setCameraIssue(false);
        window.THREE = THREE;
        const { XR8, XRExtras, LandingPage } = await loadEighthWallRuntime();
        if (cancelled) return;
        XR8Ref = XR8;

        XR8.XrController.configure({
          enableLighting: true,
          disableWorldTracking: false,
          scale: 'absolute',
        });

        const appModule = {
          name: 'he-furniture-placement-controls',
          onStart: () => {
            const { scene, camera, renderer } = XR8.Threejs.xrScene();
            cameraRef.current = camera;
            camera.near = 0.01;
            camera.far = 100;
            scene.background = null;
            renderer.setClearColor(0x000000, 0);
            renderer.autoClearColor = false;
            renderer.shadowMap.enabled = true;
            renderer.domElement.style.background = 'transparent';

            scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c7ff, 1.7));
            const directional = new THREE.DirectionalLight(0xffffff, 1.1);
            directional.position.set(1, 3, 2);
            scene.add(directional);

            const reticle = makeReticle();
            scene.add(reticle);
            reticleRef.current = reticle;

            const loader = new GLTFLoader();
            const draco = new DRACOLoader();
            draco.setDecoderPath('/draco/');
            loader.setDRACOLoader(draco);
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
              placedRef,
              latestHitRef,
              setStatusText,
              setControlMode,
              setARFlowState,
              setMoveControlsVisible,
              setRotateControlsVisible,
              setPlacementMarkerVisible,
              modelReadyRef,
              cameraIssueRef,
            });
          },
          onUpdate: () => {
            if (placedRef.current) {
              applyLockedTransform(modelRef.current);
              return;
            }
            const reticle = reticleRef.current;
            if (!reticle) return;
            const hit = getCenterHit(XR8);
            latestHitRef.current = hit;
            const hasHit = Boolean(hit);
            setARData('viewerARPlaneReady', hasHit ? 'true' : 'false');
            setARData('viewerARReticleReady', hasHit ? 'true' : 'false');
            reticle.visible = hasHit;
            setPlacementMarkerVisible(hasHit);
            if (hasHit) {
              markCameraReadyFromHit();
              copyHitToObject(hit, reticle);
              reticle.scale.setScalar(1 + Math.sin(Date.now() * 0.006) * 0.055);
              setARFlowState(FLOW_READY_TO_PLACE);
              if (modelReadyRef.current) {
                setStatusText('点击摆放点放置模型');
              } else {
                setStatusText('正在加载模型');
              }
            } else if (!cameraIssueRef.current && modelReadyRef.current) {
              setARFlowState(FLOW_SCANNING);
              setPlacementMarkerVisible(false);
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

        XR8.addCameraPipelineModules([
          XR8.GlTextureRenderer.pipelineModule(),
          XR8.Threejs.pipelineModule(),
          XR8.XrController.pipelineModule(),
          LandingPage?.pipelineModule?.(),
          XRExtras.FullWindowCanvas.pipelineModule(),
          XRExtras.Loading.pipelineModule(),
          XRExtras.RuntimeError.pipelineModule(),
          cameraHealthModule,
          appModule,
        ].filter(Boolean));

        XR8.run({ canvas: canvasRef.current });
        setARData('viewerARLaunchState', 'started');
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
    };
  }, [canUpdateScanStatus, onError]);

  return (
    <div
      className={`eighth-wall-ar-shell${cameraIssue ? ' eighth-wall-ar-shell--camera-issue' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="8th Wall AR 预览"
    >
      <canvas ref={canvasRef} id="eighth-wall-camera-feed" className="eighth-wall-camera-feed" />
      <div ref={touchLayerRef} className="eighth-wall-touch-layer" aria-label="AR 放置与控制区域" />
      {flowState === FLOW_READY_TO_PLACE && (
        <div className="eighth-wall-place-hint" aria-hidden="true">
          <span>点击摆放点</span>
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
          <div className="rotate-controls" aria-label="Z 轴旋转控制">
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
            <span className="rotate-label">Z 轴</span>
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
        退出
      </button>
      <style>{`
        .eighth-wall-ar-shell {
          position: fixed;
          inset: 0;
          z-index: 700;
          overflow: hidden;
          background: rgba(5, 7, 11, 0.28);
          color: #ffffff;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          touch-action: none;
        }

        .eighth-wall-camera-feed,
        .eighth-wall-touch-layer {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
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

        .eighth-wall-place-hint {
          position: fixed;
          left: 50%;
          top: 50%;
          z-index: 3;
          transform: translate(-50%, calc(-50% + 74px));
          display: grid;
          place-items: center;
          min-width: 108px;
          min-height: 34px;
          padding: 0 12px;
          border: 1px solid rgba(255, 255, 255, 0.32);
          border-radius: 999px;
          background: rgba(10, 14, 20, 0.66);
          color: #ffffff;
          font-size: 13px;
          font-weight: 800;
          pointer-events: none;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .eighth-wall-status-panel {
          position: fixed;
          left: 50%;
          bottom: calc(28px + env(safe-area-inset-bottom, 0px));
          z-index: 4;
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
          right: 18px;
          z-index: 5;
          min-width: 58px;
          min-height: 38px;
          padding: 0 14px;
          border: 1px solid rgba(255, 255, 255, 0.34);
          border-radius: 8px;
          background: rgba(10, 14, 20, 0.72);
          color: #ffffff;
          font-size: 14px;
          font-weight: 700;
        }

        .eighth-wall-axis-controls {
          position: fixed;
          inset: 0;
          z-index: 3;
          pointer-events: none;
        }

        .eighth-wall-control-button,
        .rotate-label {
          position: fixed;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.38);
          background: rgba(10, 14, 20, 0.66);
          color: #ffffff;
          font-size: 15px;
          font-weight: 800;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .eighth-wall-control-button {
          pointer-events: auto;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent;
        }

        .eighth-wall-control-button:active {
          background: rgba(255, 255, 255, 0.22);
          transform: translate(-50%, -50%) scale(0.96);
        }

        .axis {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          grid-template-rows: 26px 18px;
          gap: 0;
        }

        .control-arrow {
          font-size: 24px;
          line-height: 1;
        }

        .control-label {
          font-size: 12px;
          line-height: 1;
        }

        .axis-front { left: 50%; top: 32%; transform: translate(-50%, -50%); }
        .axis-back { left: 50%; top: 68%; transform: translate(-50%, -50%); }
        .axis-left { left: 30%; top: 50%; transform: translate(-50%, -50%); }
        .axis-right { left: 70%; top: 50%; transform: translate(-50%, -50%); }

        .rotate-controls {
          position: fixed;
          left: 50%;
          top: 50%;
          z-index: 3;
          display: grid;
          grid-template-columns: 64px 74px 64px;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .rotate-button {
          position: relative;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          font-size: 34px;
          line-height: 1;
          transform: none;
        }

        .rotate-button:active {
          transform: scale(0.96);
        }

        .rotate-label {
          position: relative;
          width: 74px;
          height: 74px;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          border-style: dashed;
          font-size: 14px;
          pointer-events: none;
        }

        .rotate-controls .rotate-label {
          transform: none;
        }

        @media (max-height: 720px) {
          .axis-front { top: 30%; }
          .axis-back { top: 62%; }
          .eighth-wall-place-hint { transform: translate(-50%, calc(-50% + 58px)); }
        }
      `}</style>
    </div>
  );
}
