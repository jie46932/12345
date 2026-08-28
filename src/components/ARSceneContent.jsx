import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { XRDomOverlay, useXRHitTest } from '@react-three/xr';
import * as THREE from 'three';
import { useModel } from '../hooks/useModel';
import { mediaUrl } from '../utils/assetUrl';
import { exitProductAR } from '../xr/productXRStore';

const PRODUCT_MODEL_URL = mediaUrl('12345-draco.gltf');
const TARGET_MODEL_WIDTH_METERS = 1;
const matrixHelper = new THREE.Matrix4();

function prepareARModel(sourceScene) {
  if (!sourceScene) return null;

  const model = sourceScene.clone(true);
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const width = Math.max(size.x, size.z);
  const scale = width > 0 ? TARGET_MODEL_WIDTH_METERS / width : 0.01;

  model.position.sub(center);
  model.position.y += size.y / 2;
  model.scale.setScalar(scale);

  model.traverse((object) => {
    object.frustumCulled = false;
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return model;
}

function ARReticle({ visible }) {
  return (
    <group visible={visible}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.11, 0.13, 48]} />
        <meshBasicMaterial color="#6fffe9" transparent opacity={0.92} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.018, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

export default function ARSceneContent() {
  const gl = useThree((state) => state.gl);
  const gltf = useModel(PRODUCT_MODEL_URL, { renderer: gl });
  const reticleRef = useRef(null);
  const placedGroupRef = useRef(null);
  const latestHitMatrixRef = useRef(null);
  const [hasHit, setHasHit] = useState(false);
  const [placed, setPlaced] = useState(false);

  const arModel = useMemo(() => prepareARModel(gltf?.scene), [gltf]);

  useEffect(() => {
    document.documentElement.dataset.viewerARMode = 'active';
    document.documentElement.dataset.viewerARHitReady = 'false';
    document.documentElement.dataset.viewerARPlaced = 'false';
    return () => {
      document.documentElement.dataset.viewerARMode = 'inactive';
      document.documentElement.dataset.viewerARHitReady = 'false';
      document.documentElement.dataset.viewerARPlaced = 'false';
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.viewerARModelReady = arModel ? 'true' : 'false';
  }, [arModel]);

  useEffect(() => {
    document.documentElement.dataset.viewerARHitReady = hasHit ? 'true' : 'false';
  }, [hasHit]);

  useEffect(() => {
    document.documentElement.dataset.viewerARPlaced = placed ? 'true' : 'false';
  }, [placed]);

  useXRHitTest((results, getWorldMatrix) => {
    const reticle = reticleRef.current;
    const result = results[0];
    if (!reticle || !result) {
      latestHitMatrixRef.current = null;
      setHasHit(false);
      return;
    }

    const ok = getWorldMatrix(matrixHelper, result);
    if (!ok) {
      latestHitMatrixRef.current = null;
      setHasHit(false);
      return;
    }

    reticle.matrixAutoUpdate = false;
    reticle.matrix.copy(matrixHelper);
    reticle.visible = !placed;
    latestHitMatrixRef.current = matrixHelper.clone();
    setHasHit(true);
  }, 'viewer', 'plane');

  const placeModel = useCallback(() => {
    const target = placedGroupRef.current;
    const hitMatrix = latestHitMatrixRef.current;
    if (!target || !hitMatrix || !arModel) return;

    target.matrixAutoUpdate = false;
    target.matrix.copy(hitMatrix);
    target.visible = true;
    setPlaced(true);
  }, [arModel]);

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[1, 2, 1]} intensity={1.4} />

      <group ref={reticleRef} visible={false}>
        <ARReticle visible={!placed} />
      </group>

      <group ref={placedGroupRef} visible={false}>
        {arModel && <primitive object={arModel} />}
      </group>

      <XRDomOverlay className="ar-dom-overlay">
        <style>{`
          .ar-dom-overlay {
            position: fixed;
            inset: 0;
            display: block;
            pointer-events: none;
            font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: #ffffff;
            z-index: 2147483647;
          }

          .ar-place-surface {
            position: fixed;
            inset: 0;
            width: 100%;
            height: 100%;
            border: 0;
            padding: 0;
            margin: 0;
            background: transparent;
            pointer-events: auto;
            touch-action: manipulation;
          }

          .ar-status-panel {
            position: fixed;
            left: 50%;
            bottom: calc(28px + env(safe-area-inset-bottom, 0px));
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            min-width: min(78vw, 340px);
            padding: 12px 18px;
            border-radius: 8px;
            background: rgba(10, 14, 20, 0.72);
            border: 1px solid rgba(255, 255, 255, 0.26);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            pointer-events: none;
            text-align: center;
          }

          .ar-status-title {
            font-size: 12px;
            font-weight: 700;
            line-height: 1;
            opacity: 0.74;
            letter-spacing: 0;
          }

          .ar-status-text {
            font-size: 15px;
            font-weight: 700;
            line-height: 1.35;
            letter-spacing: 0;
          }

          .ar-exit-button {
            position: fixed;
            top: calc(18px + env(safe-area-inset-top, 0px));
            right: 18px;
            min-width: 58px;
            min-height: 38px;
            padding: 0 14px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.34);
            background: rgba(10, 14, 20, 0.72);
            color: #ffffff;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0;
            pointer-events: auto;
            touch-action: manipulation;
          }
        `}</style>
        <button
          type="button"
          className="ar-place-surface"
          onClick={placeModel}
          aria-label="点击放置模型"
        />
        <div className="ar-status-panel">
          <span className="ar-status-title">AR 预览</span>
          <span className="ar-status-text">
            {!arModel
              ? '正在加载模型'
              : placed
                ? '模型已放置，可移动手机查看'
                : hasHit
                  ? '点击屏幕放置模型'
                  : '移动手机扫描地面或桌面'}
          </span>
        </div>
        <button type="button" className="ar-exit-button" onClick={exitProductAR}>
          退出
        </button>
      </XRDomOverlay>
    </>
  );
}
