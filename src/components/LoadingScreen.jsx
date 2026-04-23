import styled from 'styled-components';

const BRAND = 'HE FURNITURE';

export default function LoadingScreen({ progress, visible }) {
  return (
    <StyledWrapper className={visible ? 'ls-show' : 'ls-hide'}>
      {/* 拼铺背景图 */}
      <div className="bg-tile" />

      {/* 左上角品牌名 */}
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

      {/* 中央 spinner + 进度数字 */}
      <div className="center-wrap">
        <div className="spinner-ring">
          <span className="progress-text">{Math.round(progress)}%</span>
        </div>
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
    background-image: url('/media/ComfyUI_00001_pnekf_1775978833.jpg');
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
    align-items: center;
    justify-content: center;
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

  @keyframes rotate {
    100% { transform: rotate(1turn); }
  }

  @keyframes counter-rotate {
    100% { transform: rotate(-1turn); }
  }
`;
