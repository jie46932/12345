import useStore from '../store/useStore';
import { mediaUrl } from '../utils/assetUrl';

function resolveAssetUrl(asset) {
  if (typeof asset === 'string') return mediaUrl(asset);
  return mediaUrl(asset?.url || asset?.path || '');
}

export default function ProjectConfigBackground() {
  const backgroundMode = useStore((s) => s.backgroundMode);
  const background = useStore((s) => s.projectConfig.background);
  if (backgroundMode !== 'solidStudio') return null;
  if (!background) return null;

  const isMedia = background.mode === 'media' && resolveAssetUrl(background.asset);
  if (!isMedia) return null;

  const isVideo = isMedia && background.asset?.mime?.startsWith('video/');
  const mediaStyle = {
    width: '100%',
    height: '100%',
    objectFit: background.fit || 'cover',
    objectPosition: `${background.positionX ?? 50}% ${background.positionY ?? 50}%`,
    opacity: (Number(background.opacity ?? 100) / 100).toFixed(2),
    filter: `brightness(${Number(background.brightness ?? 100)}%) blur(${Number(background.blur ?? 0)}px)`,
    transform: `scale(${Number(background.scale ?? 100) / 100})`,
  };

  return (
    <div
      id="project-config-bg"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        overflow: 'hidden',
        pointerEvents: 'none',
        backgroundColor: 'transparent',
      }}
    >
      {isMedia && (
        isVideo ? (
          <video
            src={resolveAssetUrl(background.asset)}
            muted
            loop
            playsInline
            autoPlay
            style={mediaStyle}
          />
        ) : (
          <img
            src={resolveAssetUrl(background.asset)}
            alt=""
            style={mediaStyle}
          />
        )
      )}
    </div>
  );
}
