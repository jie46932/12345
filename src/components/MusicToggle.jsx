// 背景音乐开关 — 与 LangToggle/FullscreenToggle 同款 neumorphism 结构
// 淡入淡出：2s 线性 gain 渐变，无缝循环播放
import { useEffect, useRef } from 'react';
import styled from 'styled-components';
import useStore from '../store/useStore';

const DEFAULT_MUSIC_SRC = '/media/Rob Simonsen - Blue_cut.mp3';
const FADE_DURATION = 2; // 秒

function resolveMusicSource(asset) {
  if (typeof asset === 'string') return asset;
  return asset?.url || asset?.path || DEFAULT_MUSIC_SRC;
}

export default function MusicToggle({ checked, onChange, ready = false }) {
  const configuredMusic = useStore((s) => s.projectConfig.backgroundMusic);
  const musicSrc = resolveMusicSource(configuredMusic);
  const ctxRef    = useRef(null);
  const sourceRef = useRef(null);
  const gainRef   = useRef(null);
  const bufferRef = useRef(null);
  const playingRef = useRef(true); // 默认 playing=true（checked=false）
  const readyRef   = useRef(false); // 加载完成后才允许播放

  // 初始化 AudioContext + 预加载音频
  useEffect(() => {
    sourceRef.current = null;
    bufferRef.current = null;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    ctxRef.current  = ctx;
    gainRef.current = gain;

    fetch(musicSrc)
      .then(r => r.arrayBuffer())
      .then(ab => ctx.decodeAudioData(ab))
      .then(buf => { bufferRef.current = buf; })
      .catch(e => console.warn('[MusicToggle] 加载音乐失败:', e));

    // 监听首次用户交互，自动开始播放（Chrome autoplay 策略）
    const onFirstInteraction = () => {
      if (!playingRef.current) return; // 已被用户手动关闭则不播放
      if (!readyRef.current) return;  // 加载未完成则不播放
      const startPlayback = () => {
        if (sourceRef.current) return;
        if (!bufferRef.current) return;
        const src = ctx.createBufferSource();
        src.buffer = bufferRef.current;
        src.loop   = true;
        src.connect(gain);
        src.start(0);
        sourceRef.current = src;
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.098, ctx.currentTime + FADE_DURATION);
      };
      ctx.resume().then(startPlayback);
      document.removeEventListener('click', onFirstInteraction);
      document.removeEventListener('touchstart', onFirstInteraction);
    };
    document.addEventListener('click', onFirstInteraction);
    document.addEventListener('touchstart', onFirstInteraction);

    return () => {
      sourceRef.current = null;
      bufferRef.current = null;
      ctx.close();
      document.removeEventListener('click', onFirstInteraction);
      document.removeEventListener('touchstart', onFirstInteraction);
    };
  }, [musicSrc]);

  // ready 变为 true 时更新 ref，如果用户未手动关闭则立即尝试播放（需等用户手势）
  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  // checked=true → 停止（凹陷），checked=false → 播放（突起）
  // playing 是内部播放状态，与 checked 语义相反
  const playing = !checked;

  // playing 变化时淡入/淡出
  useEffect(() => {
    const ctx  = ctxRef.current;
    const gain = gainRef.current;
    if (!ctx || !gain) return;

    playingRef.current = playing;
    if (playing) {
      const startPlayback = () => {
        // 如果没有 source，新建并启动
        if (!sourceRef.current) {
          if (!bufferRef.current) return;
          const src = ctx.createBufferSource();
          src.buffer = bufferRef.current;
          src.loop   = true;
          src.connect(gain);
          src.start(0);
          sourceRef.current = src;
        }
        // 淡入（resume 后 currentTime 才准确）
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.098, ctx.currentTime + FADE_DURATION);
      };

      if (ctx.state === 'suspended') {
        ctx.resume().then(startPlayback);
      } else {
        startPlayback();
      }

    } else {
      if (!sourceRef.current) return;

      // 淡出：gain 从当前值线性降到 0，结束后 stop source
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_DURATION);

      const stopAt = ctx.currentTime + FADE_DURATION + 0.05;
      sourceRef.current.stop(stopAt);
      sourceRef.current = null;
    }
  }, [playing]);

  return (
    <StyledWrapper style={{ opacity: 1, pointerEvents: 'auto' }}>
      <div className="toggle-outer toggle-outer-music">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange?.(e.target.checked)}
        />
        <span className="toggle-inner" />
        <span className="toggle-icon">
          {playing ? (
            // 播放中（突起）：实心音符
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 3v11.586A4 4 0 1 0 11 18V7h5V3H9z" />
            </svg>
          ) : (
            // 停止（凹陷）：音符+斜线
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 3v11.586A4 4 0 1 0 11 18V7h5V3H9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </span>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .toggle-outer {
    position: relative;
    width: 67px;
    height: 67px;
    border-radius: 20px;
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    flex-shrink: 0;
    box-shadow: none;
    user-select: none;
  }

  .toggle-outer input {
    opacity: 0;
    position: absolute;
    cursor: pointer;
    z-index: 3;
    height: 100%;
    width: 100%;
    left: 0;
    top: 0;
    margin: 0;
  }

  .toggle-outer input:focus,
  .toggle-outer input:focus-visible {
    outline: none;
  }

  .toggle-inner {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: #ccd0d4;
    filter: blur(1px);
    box-shadow:
      inset 0 -3px 4px -1px rgba(0, 0, 0, 0.25),
      inset 0 3px 4px -1px rgba(255, 255, 255, 0.4),
      inset 0 0 5px 1px rgba(255, 255, 255, 0.8),
      inset 0 20px 30px 0 rgba(255, 255, 255, 0.2),
      0 4px 12px -2px rgba(0, 0, 0, 0.25),
      0 -4px 8px -2px rgba(255, 255, 255, 0.4);
    transition: box-shadow 300ms cubic-bezier(0.23, 1, 0.32, 1),
                transform 300ms cubic-bezier(0.23, 1, 0.32, 1);
    flex-shrink: 0;
    position: relative;
    z-index: 1;
  }

  .toggle-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 2;
    color: rgba(0, 0, 0, 0.45);
  }

  /* 按下 */
  .toggle-outer:active .toggle-inner,
  .toggle-outer.pressed .toggle-inner {
    transform: translateY(1px);
    box-shadow:
      inset 0 -8px 30px 1px rgba(255, 255, 255, 0.9),
      inset 0 8px 25px 0 rgba(0, 0, 0, 0.4),
      inset 0 0 10px 1px rgba(255, 255, 255, 0.6);
  }

  /* 选中态（播放中） */
  .toggle-outer input:checked ~ .toggle-inner {
    box-shadow:
      inset 0 -8px 25px -1px rgba(255, 255, 255, 0.9),
      inset 0 8px 20px 0 rgba(0, 0, 0, 0.2),
      inset 0 0 5px 1px rgba(255, 255, 255, 0.6);
  }

  .toggle-outer input:checked ~ .toggle-icon {
    color: rgba(0, 0, 0, 0.55);
  }
`;
