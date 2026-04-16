// nav-lang-en(1:10) 灯光开关 — 与 cb-cart-outer 同款结构
import styled from 'styled-components';

export default function LangToggle({ checked, onChange }) {
  return (
    <StyledWrapper>
      <div className="toggle-outer">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange?.(e.target.checked)}
        />
        <span className="toggle-inner" />
        <span className="toggle-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.9-3.5 6.2V17a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-1.8A7 7 0 0 1 12 2z"
              stroke="currentColor"
              strokeWidth="1.5"
              fill={checked ? 'rgba(0,212,255,0.3)' : 'none'}
            />
            <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="10" y1="23" x2="14" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
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

  /* 选中态（灯亮） */
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
