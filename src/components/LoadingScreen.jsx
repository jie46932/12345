import styled from 'styled-components';
import { mediaUrl } from '../utils/assetUrl';

const BRAND = 'HE FURNITURE';
const DESKTOP_BG = mediaUrl('10.jpg');
const MOBILE_BG = mediaUrl('11.jpg');

export default function LoadingScreen({
  progress,
  message = '正在下载模型',
  error = '',
  visible,
  variant = 'full',
}) {
  if (!visible) return null;

  const isSceneVariant = variant === 'scene';
  const isMobile = typeof window !== 'undefined'
    && (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(window.navigator?.userAgent || ''));
  const roundedProgress = Math.round(progress);
  const displayProgress = roundedProgress === 92 ? 93 : roundedProgress;

  return (
    <StyledWrapper
      className={`${visible ? 'ls-show' : 'ls-hide'}${isMobile ? ' is-mobile-loading' : ''}${isSceneVariant ? ' scene-loading' : ''}`}
    >
      {/* 拼铺背景图：登录页与登录后的模型加载页保持同一背景 */}
      <div className="bg-tile" />

      {/* 左上角品牌名 */}
      {!isSceneVariant && (
        <div className="brand-loader">
          {BRAND.split('').map((ch, i) => (
            <span
              key={i}
              className="brand-letter"
              style={ch === ' ' ? { width: '0.4em', display: 'inline-block' } : {}}
            >
              {ch === ' ' ? '\u00a0' : ch}
            </span>
          ))}
        </div>
      )}

      {/* 中央 spinner + 进度数字 */}
      <div className="center-wrap">
        <div className="spinner-ring">
          <span className="progress-text">{displayProgress}%</span>
        </div>
        {!isSceneVariant && (
          <div className={`loading-stage${error ? ' is-error' : ''}`}>
            {message}
          </div>
        )}
        {error && (
          <div className="loading-error">
            {error}
          </div>
        )}
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 600ms ease;
  pointer-events: all;

  &.ls-show {
    opacity: 1;
    pointer-events: all;
  }
  &.ls-hide {
    opacity: 0;
    pointer-events: none;
  }

  &.scene-loading {
    background: transparent;
    pointer-events: none;
  }

  /* 背景图强制 16:9，居中铺满，不留黑边 */
  .bg-tile {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    aspect-ratio: 16 / 9;
    /* 若宽度不够撑满高度，则改用高度为基准 */
    min-height: 100%;
    min-width: calc(100vh * 16 / 9);
    background-image: url('${DESKTOP_BG}');
    background-repeat: no-repeat;
    background-size: 100% 100%;
    background-position: center;
    z-index: 0;
  }

  /* 左上角品牌名 */
  .brand-loader {
    position: absolute;
    top: 24px;
    left: 24px;
    z-index: 2;
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    height: 56px;
  }

  .brand-letter {
    display: inline-block;
    position: relative;
    z-index: 1;
    font-family: 'Orbitron', 'Rajdhani', sans-serif;
    font-weight: 800;
    font-size: 44px;
    line-height: 1;
    letter-spacing: 0.08em;

    background: linear-gradient(
      175deg,
      #ffffff 0%,
      #ffffff 8%,
      #f2f2f2 18%,
      #cacaca 30%,
      #f9f9f9 42%,
      #dedede 54%,
      #b8b8b8 68%,
      #ebebeb 80%,
      #a3a3a3 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;

    filter:
      drop-shadow(-1px -1px 0 rgba(255,255,255,0.9))
      drop-shadow(1px 1px 0 #2a2a2a)
      drop-shadow(2px 2px 0 #1e1e1e)
      drop-shadow(3px 3px 0 #181818);
  }

  /* 下方居中布局 */
  .center-wrap {
    position: absolute;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
  }

  /* Spinner 圆环 */
  .spinner-ring {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: #ccd0d4;
    filter: blur(1px);
    box-shadow:
      inset 0 -3px 4px -1px rgba(0,0,0,0.25),
      inset 0 3px 4px -1px rgba(255,255,255,0.4),
      inset 0 0 5px 1px rgba(255,255,255,0.8),
      inset 0 20px 30px 0 rgba(255,255,255,0.2),
      0 4px 12px -2px rgba(0,0,0,0.25),
      0 -4px 8px -2px rgba(255,255,255,0.4);
    animation: rotate 2.0s infinite linear;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .progress-text {
    font-family: 'Orbitron', 'Rajdhani', sans-serif;
    font-weight: 700;
    font-size: 18px;
    color: rgba(30, 30, 30, 0.85);
    letter-spacing: 0.02em;
    user-select: none;
    animation: counter-rotate 2.0s infinite linear;
  }

  .loading-stage,
  .loading-error {
    min-width: 180px;
    max-width: min(78vw, 360px);
    padding: 8px 14px;
    border-radius: 999px;
    text-align: center;
    color: rgba(22, 28, 34, 0.88);
    background: rgba(236, 241, 245, 0.72);
    border: 1px solid rgba(255, 255, 255, 0.58);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.55),
      0 10px 28px rgba(20, 31, 42, 0.16);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    font-size: 15px;
    font-weight: 700;
    line-height: 1.35;
    letter-spacing: 0;
    user-select: none;
  }

  .loading-stage.is-error,
  .loading-error {
    color: #7f1d1d;
    background: rgba(254, 226, 226, 0.78);
  }

  .loading-error {
    margin-top: -6px;
    border-radius: 14px;
    font-size: 12px;
    font-weight: 600;
    word-break: break-word;
  }

  &.scene-loading .center-wrap {
    bottom: calc(118px + env(safe-area-inset-bottom, 0px));
    gap: 8px;
  }

  &.scene-loading .spinner-ring {
    width: 76px;
    height: 76px;
    background: rgba(229, 235, 240, 0.78);
    filter: blur(0.6px);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  &.scene-loading .progress-text {
    font-size: 15px;
    color: rgba(18, 24, 30, 0.78);
  }

  @keyframes rotate {
    100% { transform: rotate(1turn); }
  }

  @keyframes counter-rotate {
    100% { transform: rotate(-1turn); }
  }

  @media (max-width: 768px) {
    .bg-tile {
      width: 100%;
      height: 100%;
      min-width: 100%;
      min-height: 100%;
      aspect-ratio: auto;
      background-image: url('${MOBILE_BG}');
      background-size: cover;
      background-position: center;
    }

    .brand-loader {
      top: 16px;
      left: 16px;
      height: 34px;
      transform: scale(0.56);
      transform-origin: 0 0;
    }

    .brand-letter {
      font-size: 44px;
    }

    .center-wrap {
      bottom: max(44px, env(safe-area-inset-bottom));
      gap: 10px;
    }

    .spinner-ring {
      width: 78px;
      height: 78px;
    }

    .progress-text {
      font-size: 15px;
    }

    .loading-stage,
    .loading-error {
      min-width: 148px;
      max-width: calc(100vw - 48px);
      padding: 7px 12px;
      font-size: 13px;
    }
  }

  &.is-mobile-loading .bg-tile {
    width: 100%;
    height: 100%;
    min-width: 100%;
    min-height: 100%;
    aspect-ratio: auto;
    background-image: url('${MOBILE_BG}') !important;
    background-size: cover !important;
    background-position: center !important;
  }

  &.is-mobile-loading .brand-loader {
    top: 14px;
    left: 14px;
    height: 30px;
    transform: scale(0.46) !important;
    transform-origin: 0 0;
  }

  &.is-mobile-loading .loading-stage {
    display: none;
  }

  &.scene-loading.is-mobile-loading .center-wrap {
    bottom: calc(96px + env(safe-area-inset-bottom, 0px));
  }

  &.scene-loading.is-mobile-loading .spinner-ring {
    width: 68px;
    height: 68px;
  }
`;
