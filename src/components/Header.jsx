// Figma: 方案四-顶部导航+底部工具栏
// 节点: logo4-name(1:8), logo4-sub(1:9), nav-light(1:12→语言切换), nav-max(1:14→全屏)

import { useState } from 'react';
import styled from 'styled-components';
import LangToggle from './LangToggle';
import LangSwitch from './LangSwitch';
import FullscreenToggle from './FullscreenToggle';
import MusicToggle from './MusicToggle';

function NavBtn({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {children}
    </div>
  );
}

const BRAND = 'HE FURNITURE';
const SUB_BRAND = '智能升降桌';
const DELAY = 100; // ms per letter

// 初始化逐字母偏移
if (typeof window !== 'undefined' && !window.__letterOffsets) {
  window.__letterOffsets = [];
}

export default function Header({ onToggleLight, lightOn, lampVisible = true, lang, onLangChange, musicReady = false, authed = false }) {
  const [navExpanded, setNavExpanded] = useState(false);
  const [musicOn, setMusicOn] = useState(false);

  return (
    <StyledWrapper>
      <div
        data-figma-id="1:4-header"
        className="fixed top-0 left-0 right-0 z-50 flex items-start justify-between px-6 pt-6"
        style={{
          height: '240px',
          background: 'transparent',
          backdropFilter: 'none',
          borderBottom: 'none',
          paddingTop: '24px',
          paddingLeft: '24px',
        }}
      >
        {/* logo4-name (1:8) + logo4-sub (1:9) */}
        <div data-figma-id="1:8" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', transform: 'scale(var(--ui-scale, 1))', transformOrigin: '0 0' }}>

          {/* HE FURNITURE — 逐字弹出（空格保留宽度） */}
          <div className="brand-loader" data-figma-id="1:8-text">
            {BRAND.split('').map((ch, i) => (
              <span
                key={i}
                className="brand-letter"
                data-text={ch === ' ' ? '\u00a0' : ch}
                style={{
                  animationDelay: `${i * DELAY}ms`,
                  ...(ch === ' ' ? { width: '0.4em', display: 'inline-block' } : {})
                }}
              >
                {ch === ' ' ? '\u00a0' : ch}
              </span>
            ))}
          </div>

          {/* 智能升降桌 — 逐字弹出，空格不包 span 避免 letter-spacing 放大词间距 */}
          <div
            data-figma-id="1:9"
            className="sub-loader"
          >
            {/* 逐字弹出：空格不可见但参与动画时序，支持逐字母偏移 */}
            {(() => {
              const offsets = window.__letterOffsets || [];
              let li = 0;
              return SUB_BRAND.split('').map((ch, i) => {
                const letterIdx = ch === ' ' ? -1 : li++;
                const baseDelay = (BRAND.length + (letterIdx >= 0 ? letterIdx : i)) * DELAY;
                const offset = offsets[i] || 0;
                const delay = baseDelay + offset;
                return (
                  <span
                    key={i}
                    className="sub-letter"
                    style={{
                      animationDelay: `${delay}ms`,
                      ...(ch === ' ' ? { letterSpacing: 0, width: 0, flexShrink: 0, background: 'none', WebkitTextFillColor: 'transparent', filter: 'none' } : {}),
                    }}
                  >
                    {ch === ' ' ? '' : ch}
                  </span>
                );
              });
            })()}
          </div>
        </div>

        {/* 右侧导航按钮组 — hover 展开灯光+语言，全屏常显 */}
        <div
          className="nav-btn-group"
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            pointerEvents: 'auto',
          }}
          onMouseEnter={() => setNavExpanded(true)}
          onMouseLeave={() => setNavExpanded(false)}
        >
          {/* 毛玻璃背景框（与底部栏一致） */}
          <div
            className="nav-bg"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(204, 208, 212, 0.36)',
              backdropFilter: 'blur(18px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(18px) saturate(1.4)',
              borderRadius: '20px',
              border: '1px solid rgba(255,255,255,0.45)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 24px rgba(0,0,0,0.12)',
              padding: '4px 10px',
              overflow: 'visible',
            }}
          >
            {/* 展开区：灯光 + 语言（hover 时展开） */}
            <div className={`nav-expand-wrap ${navExpanded ? 'nav-open' : ''}`}>
              <div className="nav-expand-inner">
                {/* 音乐开关 — 最左侧 */}
                {authed && <NavBtn><MusicToggle checked={musicOn} onChange={setMusicOn} ready={musicReady} /></NavBtn>}
                {/* nav-lang-en (1:10) — 灯光开关 */}
                <NavBtn><LangToggle checked={lightOn} onChange={onToggleLight} disabled={!lampVisible} /></NavBtn>
                {/* nav-light (1:12) — 语言切换 */}
                <NavBtn><LangSwitch lang={lang} onChange={onLangChange} /></NavBtn>
              </div>
            </div>

            {/* nav-max (1:14) — 最大化，始终显示 */}
            <NavBtn><FullscreenToggle /></NavBtn>
          </div>
        </div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  pointer-events: none;

  /* ── 右上角导航按钮组 ── */
  .nav-btn-group {
    display: flex;
    align-items: center;
    overflow: visible;
    transform: scale(var(--ui-scale, 1));
    transform-origin: top right;
  }

  /* 展开区：灯光 + 语言，折叠时宽度为 0 */
  .nav-expand-wrap {
    display: grid;
    grid-template-columns: 0fr;
    opacity: 0;
    transition: grid-template-columns 400ms cubic-bezier(0.23, 1, 0.32, 1),
                opacity 300ms ease;
  }
  .nav-expand-wrap > .nav-expand-inner {
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .nav-expand-wrap.nav-open {
    grid-template-columns: 1fr;
    opacity: 1;
  }

  /* ── ERGODESK 品牌字 ── */
  .brand-loader {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    overflow: hidden;
    height: 56px;
    position: relative;
  }

  .brand-loader::before {
    content: "";
    position: absolute;
    width: 160px;
    height: 100%;
    background-image: linear-gradient(
      105deg,
      rgba(255, 255, 255, 0) 20%,
      rgba(255, 255, 255, 0.75) 50%,
      rgba(255, 255, 255, 0) 80%
    );
    top: 0;
    left: -160px;
    opacity: 0.9;
    z-index: 2;
    pointer-events: none;
    animation: shine 16s infinite;
  }

  /* ── 品牌字 3D 金属效果 ── */
  .brand-letter {
    display: inline-block;
    position: relative;
    z-index: 1;
    font-family: 'Orbitron', 'Rajdhani', sans-serif;
    font-weight: 800;
    font-size: 44px;
    line-height: 1;
    letter-spacing: 0.08em;
    transform: translateY(4rem);
    animation: letterUp 16s infinite cubic-bezier(0.86, 0, 0.07, 1);

    /* 拉丝钢正面：提亮20% */
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

    /* 斜角切面立体感：左上亮描边 + 右下深色厚度 */
    filter:
      drop-shadow(-1px -1px 0 rgba(255,255,255,0.9))
      drop-shadow(1px 1px 0 #2a2a2a)
      drop-shadow(2px 2px 0 #1e1e1e)
      drop-shadow(3px 3px 0 #181818);
  }

  .brand-letter::before { content: none; }

  /* ── 自动升降桌 副标题 ── */
  .sub-loader {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    overflow: hidden;
    height: 36px;
    position: relative;
  }

  .sub-loader::before {
    content: "";
    position: absolute;
    width: 120px;
    height: 100%;
    background-image: linear-gradient(
      120deg,
      rgba(255, 255, 255, 0) 20%,
      rgba(255, 255, 255, 0.9) 50%,
      rgba(255, 255, 255, 0) 80%
    );
    filter: blur(3px);
    top: 0;
    left: -120px;
    opacity: 0.7;
    z-index: 2;
    animation: shine-sub 16s 0.3s infinite;
  }

  .sub-letter {
    display: inline-block;
    position: relative;
    z-index: 1;
    font-family: 'Rajdhani', 'Inter', sans-serif;
    font-weight: 600;
    font-size: 21.6px;
    line-height: 1;
    letter-spacing: 0.25em;
    transform: translateY(4rem);
    animation: letterUp 16s infinite cubic-bezier(0.86, 0, 0.07, 1);

    /* 金属渐变光泽（提亮20%） */
    background: linear-gradient(
      175deg,
      #ffffff 0%,
      #ffffff 10%,
      #e6e6e6 22%,
      #c5c5c5 34%,
      #f5f5f5 46%,
      #d4d4d4 58%,
      #adadad 72%,
      #e6e6e6 84%,
      #9e9e9e 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;

    /* 3D 厚度：三层轮廓 */
    filter:
      drop-shadow(-1px -1px 0 rgba(255,255,255,0.8))
      drop-shadow(1px 1px 0 #2a2a2a)
      drop-shadow(2px 2px 0 #1e1e1e)
      drop-shadow(3px 3px 0 #181818);
  }

  @keyframes letterUp {
    0%      { transform: translateY(4rem); }  /* 起点 */
    18.75%  { transform: translateY(0); }     /* 3s 弹出完成 (3/16) */
    81.25%  { transform: translateY(0); }     /* 停留 10s (13/16) */
    100%    { transform: translateY(4rem); }  /* 3s 落下 (16/16) */
  }

  @keyframes shine {
    0%      { left: -160px; }
    18.75%  { left: -160px; }       /* 字母弹出完成，开始划 */
    31.25%  { left: 110%; }         /* 2s 划过完成 */
    81.25%  { left: 110%; }         /* 停留期结束（在屏幕外，不可见） */
    81.26%  { left: -160px; }       /* 落下期间复位 */
    100%    { left: -160px; }
  }

  @keyframes shine-sub {
    0%      { left: -120px; }
    20%     { left: -120px; }
    32.5%   { left: 110%; }
    81.25%  { left: 110%; }
    81.26%  { left: -120px; }
    100%    { left: -120px; }
  }

  /* 字体缩放由 --ui-scale transform 统一处理，无需额外媒体查询 */
`;
