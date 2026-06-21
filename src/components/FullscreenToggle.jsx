// UIverse 展开/收缩图标 — nav-max(1:14) 窗口最大化/还原
// 与 cb-cart-outer 同款结构
import { useEffect, useRef } from 'react';
import styled from 'styled-components';

const isMobileDevice = () => (
  typeof window !== 'undefined'
  && (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(window.navigator?.userAgent || ''))
);

export default function FullscreenToggle() {
  const inputRef = useRef(null);

  useEffect(() => {
    const onFsChange = () => {
      const fs = !!document.fullscreenElement;
      const pseudo = document.body.classList.contains('pseudo-fullscreen');
      document.documentElement.dataset.viewerFullscreen = fs ? 'native' : (pseudo ? 'pseudo' : 'off');
      if (inputRef.current) inputRef.current.checked = fs || pseudo;
      if (!fs && screen.orientation?.unlock) {
        try {
          screen.orientation.unlock();
        } catch {
          // Some browsers expose unlock but throw outside fullscreen.
        }
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleChange = async (e) => {
    const willMax = e.target.checked;
    if (willMax) {
      try {
        if (isMobileDevice()) {
          document.body.classList.add('pseudo-fullscreen');
          document.documentElement.dataset.viewerFullscreen = 'pseudo';
        }
        const target = document.documentElement;
        const requestFullscreen =
          target.requestFullscreen ||
          target.webkitRequestFullscreen ||
          target.msRequestFullscreen;
        if (requestFullscreen) {
          await requestFullscreen.call(target);
          document.documentElement.dataset.viewerFullscreen = 'native';
        } else {
          document.body.classList.add('pseudo-fullscreen');
          document.documentElement.dataset.viewerFullscreen = 'pseudo';
        }
        try {
          await screen.orientation?.lock?.('landscape');
        } catch {
          // Orientation lock is best-effort and often rejected on mobile.
        }
      } catch (error) {
        console.warn('[fullscreen] request failed:', error?.message || error);
        document.body.classList.add('pseudo-fullscreen');
        document.documentElement.dataset.viewerFullscreen = 'pseudo';
      } finally {
        if (inputRef.current) {
          inputRef.current.checked = !!document.fullscreenElement || document.body.classList.contains('pseudo-fullscreen');
        }
      }
    } else {
      try {
        screen.orientation?.unlock?.();
      } catch {
        // Ignore unsupported orientation unlock.
      }
      document.body.classList.remove('pseudo-fullscreen');
      document.documentElement.dataset.viewerFullscreen = 'off';
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      if (inputRef.current) inputRef.current.checked = false;
    }
  };

  return (
    <StyledWrapper>
      <label className="toggle-outer toggle-outer3" title="最大化/还原窗口">
        <input ref={inputRef} type="checkbox" onChange={handleChange} />
        <span className="toggle-inner" />
        <span className="toggle-icon">
          <svg viewBox="0 0 448 512" height="16" xmlns="http://www.w3.org/2000/svg" className="expand">
            <path d="M32 32C14.3 32 0 46.3 0 64v96c0 17.7 14.3 32 32 32s32-14.3 32-32V96h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H64V352zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32h64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V64c0-17.7-14.3-32-32-32H320zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H320c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V352z" />
          </svg>
          <svg viewBox="0 0 448 512" height="16" xmlns="http://www.w3.org/2000/svg" className="compress">
            <path d="M160 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V64zM32 320c-17.7 0-32 14.3-32 32s14.3 32 32 32H96v64c0 17.7 14.3 32 32 32s32-14.3 32-32V352c0-17.7-14.3-32-32-32H32zM352 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H352V64zM320 320c-17.7 0-32 14.3-32 32v96c0 17.7 14.3 32 32 32s32-14.3 32-32V384h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H320z" />
          </svg>
        </span>
      </label>
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
    fill: rgba(0, 0, 0, 0.45);
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

  /* 选中态（最大化） */
  .toggle-outer input:checked ~ .toggle-inner {
    box-shadow:
      inset 0 -8px 25px -1px rgba(255, 255, 255, 0.9),
      inset 0 8px 20px 0 rgba(0, 0, 0, 0.2),
      inset 0 0 5px 1px rgba(255, 255, 255, 0.6);
  }

  .toggle-outer input:checked ~ .toggle-icon {
    color: rgba(0, 0, 0, 0.5);
    fill: rgba(0, 0, 0, 0.5);
  }

  .expand { display: block; }
  .compress { display: none; }
  .toggle-outer input:checked ~ .toggle-icon .expand { display: none; }
  .toggle-outer input:checked ~ .toggle-icon .compress { display: block; }
`;
