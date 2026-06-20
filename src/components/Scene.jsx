/**
 * Scene — R3F Canvas 顶层容器
 *
 * 整合 Canvas、场景内容、后处理特效。
 * App.jsx 使用此组件替代原 Verge3D 场景。
 */
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import SceneContent from './SceneContent';
import Effects from './Effects';
import useStore from '../store/useStore';

export default function Scene({ style, rendererLabel = 'webgl', rendererMessage = '' }) {
  return (
    <div id="r3f-canvas" style={style || { width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [-13.32, 49.13, 81.69], far: 1000, fov: 37 }}
        gl={{
          antialias: true,
          alpha: true,
          // ACESFilmicToneMapping: 匹配 Verge3D 默认渲染管线
          // Verge3D PHYSICAL_MX shader 内建 ACES 近似 tone mapping
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        style={{ width: '100%', height: '100%' }}
        onCreated={({ gl, scene }) => {
          document.documentElement.dataset.viewerRenderer = rendererLabel;
          if (rendererMessage) {
            document.documentElement.dataset.viewerRendererMessage = rendererMessage;
          }
          gl.setClearColor(0x000000, 0);
          scene.background = null;
        }}
        onPointerMissed={() => {
          // 点击空白处清除选中
          useStore.getState().clearSelection();
        }}
      >
        <SceneContent />
        <Effects />
      </Canvas>
    </div>
  );
}
