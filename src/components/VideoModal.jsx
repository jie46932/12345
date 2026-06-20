import { useLang, T } from '../LangContext';
import useStore from '../store/useStore';

function resolveAssetUrl(asset) {
  if (typeof asset === 'string') return asset;
  return asset?.url || asset?.path || '';
}

export default function VideoModal({ open, onClose }) {
  const configuredVideo = useStore((s) => s.projectConfig.video);
  const videoSrc = resolveAssetUrl(configuredVideo);

  const t = T[useLang()];

  if (!open) return null;

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        padding: 'clamp(18px, 5vw, 72px)',
        background: 'rgba(0,0,0,0.74)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        display: 'grid',
        placeItems: 'center',
        pointerEvents: 'auto',
      }}
    >
      <button
        onClick={onClose}
        aria-label="关闭视频"
        style={{
          position: 'fixed',
          top: 24,
          right: 24,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.16)',
          border: '1px solid rgba(255,255,255,0.28)',
          color: '#fff',
          fontSize: 20,
          display: 'grid',
          placeItems: 'center',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        x
      </button>
      {videoSrc ? (
        <video
          src={videoSrc}
          controls
          autoPlay
          playsInline
          style={{
            width: 'min(1080px, 100%)',
            maxHeight: 'min(72vh, 720px)',
            borderRadius: 14,
            background: '#111',
            boxShadow: '0 28px 90px rgba(0,0,0,0.55)',
          }}
        />
      ) : (
        <div
          style={{
            width: 'min(520px, 100%)',
            padding: '34px 28px',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.22)',
            color: '#fff',
            textAlign: 'center',
            boxShadow: '0 28px 90px rgba(0,0,0,0.42)',
          }}
        >
          {t.noVideo}
        </div>
      )}
    </div>
  );
}
