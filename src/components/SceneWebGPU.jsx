/**
 * SceneWebGPU — experimental WebGPU renderer entry.
 *
 * This entry intentionally keeps the WebGPU path smaller than production
 * WebGL: no postprocessing, no WebGL render targets, no RectAreaLight.
 */
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import Scene from './Scene';
import SceneContent from './SceneContent';
import useStore from '../store/useStore';

function markRenderer(value, message = '') {
  document.documentElement.dataset.viewerRenderer = value;
  if (message) {
    document.documentElement.dataset.viewerRendererMessage = message;
  }
}

function getInitialFallbackReason() {
  if (typeof navigator === 'undefined') return 'navigator is not available';
  if (!navigator.gpu) return 'navigator.gpu is not available';
  return '';
}

function FallbackNotice() {
  return (
    <div
      id="webgpu-fallback-notice"
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 420,
        maxWidth: 'min(560px, calc(100vw - 32px))',
        padding: '10px 14px',
        borderRadius: 10,
        background: 'rgba(20,24,28,0.74)',
        color: '#fff',
        fontSize: 13,
        lineHeight: 1.5,
        pointerEvents: 'none',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.25)',
      }}
    >
      当前环境不支持 WebGPU，已回退 WebGL。
    </div>
  );
}

export default function SceneWebGPU({ style }) {
  const [fallbackReason, setFallbackReason] = useState(getInitialFallbackReason);

  useEffect(() => {
    const originalError = console.error;
    console.error = (...args) => {
      const message = args.map((arg) => String(arg)).join(' ');
      if (message.includes('THREE.NodeBuilder: Material "ShaderMaterial" is not compatible.')) {
        const current = Number(document.documentElement.dataset.viewerWebGPUFilteredWarnings || 0);
        document.documentElement.dataset.viewerWebGPUFilteredWarnings = String(current + 1);
        return;
      }
      originalError(...args);
    };
    return () => {
      console.error = originalError;
    };
  }, []);

  const createWebGPURenderer = useMemo(() => async (defaultProps) => {
    try {
      markRenderer('webgpu-initializing');
      const { WebGPURenderer } = await import('three/webgpu');
      const renderer = new WebGPURenderer({
        ...defaultProps,
        antialias: true,
        alpha: true,
      });
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      await renderer.init();
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      markRenderer('webgpu');
      document.documentElement.dataset.viewerWebGPULighting = 'area-light-disabled';
      window.__viewerRenderer = renderer;
      window.__threeRenderer = renderer;
      return renderer;
    } catch (error) {
      const message = error?.message || String(error);
      markRenderer('webgpu-error', message);
      setFallbackReason(message);
      throw error;
    }
  }, []);

  if (fallbackReason) {
    markRenderer('webgl-fallback', fallbackReason);
    return (
      <>
        <FallbackNotice />
        <Scene
          style={style}
          rendererLabel="webgl-fallback"
          rendererMessage={fallbackReason}
        />
      </>
    );
  }

  return (
    <div id="r3f-canvas" style={style || { width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [-13.32, 49.13, 81.69], far: 1000, fov: 37 }}
        gl={createWebGPURenderer}
        style={{ width: '100%', height: '100%' }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor?.(0x000000, 0);
          gl.setPixelRatio?.(Math.min(window.devicePixelRatio || 1, 2));
          gl.setSize?.(window.innerWidth, window.innerHeight, false);
          scene.background = null;
          markRenderer(gl?.isWebGPURenderer ? 'webgpu' : 'webgpu-compat');
          document.documentElement.dataset.viewerWebGPULighting = 'area-light-disabled';
        }}
        onPointerMissed={() => {
          useStore.getState().clearSelection();
        }}
      >
        <SceneContent disableWebGLReflections disableAreaLights />
      </Canvas>
    </div>
  );
}
