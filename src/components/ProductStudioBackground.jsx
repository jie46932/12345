import useStore from '../store/useStore';

export default function ProductStudioBackground({ forceVisible = false }) {
  const backgroundMode = useStore((s) => s.backgroundMode);
  const bg = useStore((s) => s.studioBackground);

  const visible = forceVisible || backgroundMode === 'solidStudio';
  const highlightSize = Math.max(0.15, Math.min(1.8, bg.highlightSize ?? 1));
  const highlightWidth = 138 * highlightSize;
  const highlightHeight = 138 * highlightSize;
  const midStop = Math.max(18, Math.min(56, 38 + (highlightSize - 1) * 20));
  const fadeStop = Math.max(38, Math.min(94, 76 + (highlightSize - 1) * 28));

  return (
    <div
      id="product-studio-bg"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        visibility: visible ? 'visible' : 'hidden',
        transition: 'opacity 260ms ease',
        background: [
          `radial-gradient(ellipse ${highlightWidth}% ${highlightHeight}% at 50% 48%, rgba(255,255,255,${bg.highlightOpacity * 0.72}) 0%, rgba(255,255,255,${bg.highlightOpacity * 0.32}) ${midStop}%, transparent ${fadeStop}%)`,
          `radial-gradient(ellipse 120% 95% at 50% 48%, transparent 38%, rgba(0,0,0,${bg.vignetteStrength * 0.58}) 78%, rgba(0,0,0,${bg.vignetteStrength}) 100%)`,
          bg.baseColor,
        ].join(', '),
      }}
    />
  );
}
