// LoginScreen.jsx
// 毛玻璃背景 + neumorphism 按钮，与场景 UI 风格完全一致
// 验证逻辑走 /api/login，绝不在前端写死账密
import { useState, useRef } from 'react';
import styled, { keyframes } from 'styled-components';

export default function LoginScreen({ visible, onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [pressed, setPressed] = useState(false);
  const btnRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (data.success) {
        // 把 token 存到 sessionStorage（关闭标签页自动清除）
        sessionStorage.setItem('v3d_token', data.token);
        // 通知 12345.js 开始加载场景
        window.dispatchEvent(new CustomEvent('v3d-authed', { detail: { token: data.token } }));
        onSuccess?.();
      } else {
        setError(data.message || '账号或密码错误');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Overlay className={visible ? 'ls-show' : 'ls-hide'}>
      {/* 与 LoadingScreen 一致的背景图 */}
      <div className="bg-tile" />

      {/* 左上角品牌名（与 LoadingScreen 完全一致） */}
      <div className="brand-loader">
        {'HE FURNITURE'.split('').map((ch, i) => (
          <span
            key={i}
            className="brand-letter"
            style={ch === ' ' ? { width: '0.4em', display: 'inline-block' } : {}}
          >
            {ch === ' ' ? '\u00a0' : ch}
          </span>
        ))}
      </div>

      {/* 登录卡片 */}
      <Card>
        <h2 className="card-title">访问验证</h2>
        <p className="card-sub">请输入您的访问账号</p>

        <form onSubmit={handleSubmit} autoComplete="off">
          {/* 用户名 */}
          <div className="field">
            <label htmlFor="login-user">账号</label>
            <div className="input-wrap">
              <input
                id="login-user"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="请输入账号"
                autoComplete="username"
                required
              />
            </div>
          </div>

          {/* 密码 */}
          <div className="field">
            <label htmlFor="login-pass">密码</label>
            <div className="input-wrap">
              <input
                id="login-pass"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {/* 错误提示 */}
          {error && <p className="error-msg">{error}</p>}

          {/* 登录按钮 — neumorphism 突起/凹陷效果 */}
          <button
            ref={btnRef}
            type="submit"
            className={`btn-neu${pressed ? ' pressed' : ''}${loading ? ' loading' : ''}`}
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => { setPressed(false); btnRef.current?.blur(); }}
            onMouseLeave={() => setPressed(false)}
            disabled={loading}
          >
            {loading ? (
              <span className="spinner" />
            ) : (
              '进入'
            )}
          </button>
        </form>
      </Card>
    </Overlay>
  );
}

/* ── keyframes ─────────────────────────────── */
const fadeIn = keyframes`from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); }`;
const spin   = keyframes`100% { transform: rotate(1turn); }`;

/* ── Overlay：全屏，与 LoadingScreen 完全同结构 ── */
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;           /* LoadingScreen 是 10000，登录在其下层 */
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 600ms ease;
  pointer-events: all;

  &.ls-show { opacity: 1; pointer-events: all; }
  &.ls-hide { opacity: 0; pointer-events: none; }

  /* 背景图：与 LoadingScreen 完全一致 */
  .bg-tile {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    aspect-ratio: 16 / 9;
    min-height: 100%;
    min-width: calc(100vh * 16 / 9);
    background-image: url('/media/ComfyUI_00001_pnekf_1775978833.jpg');
    background-repeat: no-repeat;
    background-size: 100% 100%;
    background-position: center;
    z-index: 0;
    filter: brightness(0.6);   /* 略暗，凸显卡片 */
  }

  /* 品牌名：与 LoadingScreen 完全一致 */
  .brand-loader {
    position: absolute;
    top: 24px; left: 24px;
    z-index: 2;
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    height: 56px;
  }

  .brand-letter {
    display: inline-block;
    font-family: 'Orbitron', 'Rajdhani', sans-serif;
    font-weight: 800;
    font-size: 44px;
    line-height: 1;
    letter-spacing: 0.08em;
    background: linear-gradient(
      175deg,
      #ffffff 0%, #ffffff 8%, #f2f2f2 18%, #cacaca 30%,
      #f9f9f9 42%, #dedede 54%, #b8b8b8 68%, #ebebeb 80%, #a3a3a3 100%
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
`;

/* ── Card：半透明毛玻璃 ── */
const Card = styled.div`
  position: relative;
  z-index: 2;
  width: min(420px, 90vw);
  padding: 48px 40px 44px;
  border-radius: 24px;
  /* 毛玻璃 */
  background: rgba(200, 208, 216, 0.22);
  backdrop-filter: blur(24px) saturate(1.4);
  -webkit-backdrop-filter: blur(24px) saturate(1.4);
  border: 1px solid rgba(255, 255, 255, 0.28);
  box-shadow:
    0 8px 40px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
  animation: ${fadeIn} 0.5s cubic-bezier(0.23, 1, 0.32, 1) both;

  .card-title {
    font-family: 'Orbitron', 'Rajdhani', sans-serif;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.92);
    text-align: center;
    margin-bottom: 6px;
    text-shadow: 0 1px 4px rgba(0,0,0,0.4);
  }

  .card-sub {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    text-align: center;
    margin-bottom: 36px;
    letter-spacing: 0.04em;
  }

  /* ── 输入组 ── */
  .field {
    margin-bottom: 20px;
  }

  label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.55);
    margin-bottom: 8px;
  }

  .input-wrap {
    border-radius: 14px;
    /* 凹陷质感 */
    background: rgba(160, 170, 180, 0.18);
    box-shadow:
      inset 0 2px 6px rgba(0, 0, 0, 0.28),
      inset 0 -1px 2px rgba(255, 255, 255, 0.12),
      0 1px 0 rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.10);
    transition: box-shadow 200ms ease;

    &:focus-within {
      box-shadow:
        inset 0 2px 8px rgba(0, 0, 0, 0.35),
        inset 0 -1px 2px rgba(255, 255, 255, 0.15),
        0 0 0 2px rgba(255, 255, 255, 0.18);
    }
  }

  input {
    width: 100%;
    padding: 13px 16px;
    background: transparent;
    border: none;
    outline: none;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.88);
    font-family: inherit;
    letter-spacing: 0.02em;
    box-sizing: border-box;

    &::placeholder {
      color: rgba(255, 255, 255, 0.3);
    }
  }

  /* ── 错误提示 ── */
  .error-msg {
    font-size: 12px;
    color: rgba(255, 120, 120, 0.9);
    text-align: center;
    margin: -4px 0 16px;
    letter-spacing: 0.02em;
  }

  /* ── 登录按钮：neumorphism 突起/凹陷 ── */
  .btn-neu {
    width: 100%;
    margin-top: 12px;
    height: 52px;
    border-radius: 16px;
    border: none;
    cursor: pointer;
    font-family: 'Orbitron', 'Rajdhani', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(40, 40, 40, 0.80);
    /* 突起态 */
    background: #ccd0d4;
    box-shadow:
      inset 0 -3px 4px -1px rgba(0, 0, 0, 0.25),
      inset 0  3px 4px -1px rgba(255, 255, 255, 0.4),
      inset 0  0   5px  1px rgba(255, 255, 255, 0.8),
      inset 0 20px 30px  0   rgba(255, 255, 255, 0.2),
      0  4px 12px -2px rgba(0, 0, 0, 0.25),
      0 -4px  8px -2px rgba(255, 255, 255, 0.4);
    transition:
      box-shadow 200ms cubic-bezier(0.23, 1, 0.32, 1),
      transform   200ms cubic-bezier(0.23, 1, 0.32, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    filter: blur(0.4px);

    &:focus { outline: none; }
    &:focus-visible { outline: none; }

    /* 凹陷态（按下 / loading） */
    &.pressed,
    &.loading,
    &:active {
      transform: translateY(1px);
      box-shadow:
        inset 0 -8px 30px  1px rgba(255, 255, 255, 0.9),
        inset 0  8px 25px  0   rgba(0, 0, 0, 0.4),
        inset 0  0   10px  1px rgba(255, 255, 255, 0.6);
    }

    &:disabled { cursor: not-allowed; }
  }

  /* loading 小圆圈 */
  .spinner {
    display: inline-block;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid rgba(40,40,40,0.25);
    border-top-color: rgba(40,40,40,0.7);
    animation: ${spin} 0.7s linear infinite;
  }
`;
