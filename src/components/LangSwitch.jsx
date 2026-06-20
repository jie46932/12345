// 语言切换 — 与 cb-cart-outer 同款结构
import styled from 'styled-components';

export default function LangSwitch({ lang, onChange }) {
  const isZh = lang === 'zh';

  return (
    <StyledWrapper>
      <label
        className="toggle-outer toggle-outer2"
        title={isZh ? '切换为英文' : 'Switch to Chinese'}
      >
        <input
          type="checkbox"
          checked={!isZh}
          onChange={e => onChange?.(e.target.checked ? 'en' : 'zh')}
        />
        <span className="toggle-inner" />
        <span className="toggle-icon" style={isZh ? undefined : { fontWeight: 400 }}>{isZh ? '中' : 'EN'}</span>
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
    font-family: 'Inter', sans-serif;
    font-weight: 800;
    font-size: 13px;
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

  /* 选中态（中文） */
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
