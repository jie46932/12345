import { useEffect, useRef } from 'react';

export default function V3DCanvas({ onAppReady }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !window.v3d) return;

    const app = new window.v3d.App(container, { preserveDrawingBuffer: true, alpha: true });

    const gltfPath = (import.meta.env.DEV
      ? '/media/12345.gltf'
      : window.location.pathname.replace(/\/[^/]*$/, '/') + 'media/12345.gltf') + '?v=' + Date.now();
    app.loadScene(gltfPath, () => {
      app.enableControls();
      // 隐藏 HDR 背景图片，但保留环境光照
      if (app.scene) {
        app.scene.background = null;
      }
      app.run();
      if (onAppReady) onAppReady(app);
    });

    return () => app.dispose();
  }, [onAppReady]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
