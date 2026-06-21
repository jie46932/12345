// LoginScreen.jsx
// 毛玻璃背景 + neumorphism 按钮，与场景 UI 风格完全一致
// 验证逻辑走 /api/login，绝不在前端写死账密
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { storePersistentAuthToken } from '../utils/authStorage';
import { trackError, trackOperation } from '../utils/telemetry';

function makeLoginToken() {
  return `wx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function MockQrPattern({ token }) {
  const cells = useMemo(() => {
    const seed = Array.from(token || '').reduce((total, char) => total + char.charCodeAt(0), 0);
    return Array.from({ length: 121 }, (_, index) => {
      const row = Math.floor(index / 11);
      const col = index % 11;
      const inFinder =
        (row < 3 && col < 3) ||
        (row < 3 && col > 7) ||
        (row > 7 && col < 3);
      if (inFinder) return true;
      return ((index * 17 + seed + row * col) % 5) < 2;
    });
  }, [token]);

  return (
    <div className="wechat-qr is-mock" aria-label="开发模拟二维码">
      {cells.map((active, index) => (
        <span className={active ? 'is-dark' : ''} key={`${token}-${index}`} />
      ))}
    </div>
  );
}

export default function LoginScreen({ visible, onSuccess }) {
  const [loginMode, setLoginMode] = useState('wechat');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [pressed, setPressed] = useState(false);
  const [wechatSession, setWechatSession] = useState(null);
  const [wechatStatus, setWechatStatus] = useState('正在获取微信二维码');
  const [wechatError, setWechatError] = useState('');
  const btnRef = useRef(null);

  const showMockScan = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('dev') === '1' || params.get('mockWechat') === '1' || import.meta.env.DEV;
  }, []);

  const finishWechatLogin = useCallback((user) => {
    trackOperation('login_succeeded', { method: 'wechat', mock: user?.source === 'wechat_mock' });
    storePersistentAuthToken('v3d_token', 'he_furniture_wechat_token');
    if (user) {
      localStorage.setItem('he_furniture_wechat_user', JSON.stringify(user));
    }
    onSuccess?.();
  }, [onSuccess]);

  const createWechatSession = useCallback(async () => {
    setWechatError('');
    setWechatStatus('正在获取微信二维码');
    try {
      const response = await fetch('/api/wechat-login/session', { method: 'POST' });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '微信登录服务未配置');
      }
      setWechatSession(result.session);
      setWechatStatus(result.session?.mock ? '开发模拟扫码' : '等待微信扫码');
      trackOperation('wechat_login_started', { mock: !!result.session?.mock });
    } catch (requestError) {
      const token = makeLoginToken();
      setWechatSession(showMockScan ? { token, mock: true } : null);
      setWechatStatus(showMockScan ? '开发模拟扫码' : '微信登录服务未配置');
      setWechatError(String(requestError?.message || requestError));
      trackError('wechat_login_session_failed', requestError, { mockFallback: showMockScan });
    }
  }, [showMockScan]);

  useEffect(() => {
    if (!visible || loginMode !== 'wechat' || wechatSession) return undefined;
    const timer = window.setTimeout(createWechatSession, 0);
    return () => window.clearTimeout(timer);
  }, [createWechatSession, loginMode, visible, wechatSession]);

  useEffect(() => {
    if (!visible || loginMode !== 'wechat' || !wechatSession?.token) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/wechat-login/status?token=${encodeURIComponent(wechatSession.token)}`);
        const result = await response.json();
        if (result?.success && result?.user) {
          setWechatStatus('登录成功');
          finishWechatLogin(result.user);
        }
      } catch {
        // 轮询失败不打断二维码显示。
      }
    }, 1600);
    return () => window.clearInterval(timer);
  }, [finishWechatLogin, loginMode, visible, wechatSession]);

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
        // 新设备首次登录后长期保留，同设备下次免输入账号密码。
        storePersistentAuthToken('v3d_token', data.token);
        trackOperation('login_succeeded', { method: 'password' });
        onSuccess?.();
      } else {
        trackOperation('login_failed', { method: 'password', reason: 'invalid_credentials' });
        setError(data.message || '账号或密码错误');
      }
    } catch (requestError) {
      trackError('login_request_failed', requestError, { method: 'password' });
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const simulateWechatScan = async () => {
    if (!wechatSession?.token) return;
    setWechatStatus('微信确认中');
    try {
      const response = await fetch('/api/wechat-login/mock-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: wechatSession.token }),
      });
      const result = await response.json();
      if (result?.success && result?.user) {
        finishWechatLogin(result.user);
      }
    } catch {
      trackOperation('wechat_login_failed', { method: 'mock_scan' });
      setWechatError('模拟扫码失败，请刷新二维码');
    }
  };

  if (!visible) return null;

  const isMobileLogin = typeof window !== 'undefined'
    && (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(window.navigator?.userAgent || ''));

  return (
    <Overlay className={`ls-show${isMobileLogin ? ' is-mobile-login' : ''}`}>
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
        <p className="card-sub">请选择登录方式</p>

        <div className="login-switch" role="tablist" aria-label="登录方式">
          <button
            type="button"
            className={loginMode === 'wechat' ? 'active' : ''}
            onClick={() => {
              trackOperation('login_method_selected', { method: 'wechat' });
              setLoginMode('wechat');
            }}
          >
            微信扫码登录
          </button>
          <button
            type="button"
            className={loginMode === 'password' ? 'active' : ''}
            onClick={() => {
              trackOperation('login_method_selected', { method: 'password' });
              setLoginMode('password');
            }}
          >
            账号密码登录
          </button>
        </div>

        {loginMode === 'wechat' ? (
          <div className="wechat-login-panel">
            <div className="wechat-login-head">
              <strong>微信扫码登录</strong>
              <span>{wechatStatus}</span>
            </div>

            {wechatSession?.qrImageUrl && (
              <img className="wechat-qr-image" src={wechatSession.qrImageUrl} alt="微信扫码登录二维码" />
            )}
            {!wechatSession?.qrImageUrl && wechatSession?.mock && <MockQrPattern token={wechatSession.token} />}
            {!wechatSession?.qrImageUrl && !wechatSession?.mock && (
              <div className="wechat-unconfigured">
                <strong>未配置微信登录</strong>
                <span>需要后端接入微信开放平台或公众号扫码授权后生成二维码。</span>
              </div>
            )}

            <p className="wechat-hint">请使用手机微信扫描二维码，授权后进入项目场景</p>
            {wechatError && <p className="error-msg">{wechatError}</p>}

            <div className={`wechat-actions${showMockScan ? '' : ' is-single'}`}>
              <button type="button" onClick={createWechatSession}>刷新二维码</button>
              {showMockScan && (
                <button type="button" onClick={simulateWechatScan}>模拟扫码</button>
              )}
            </div>
          </div>
        ) : (
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
        )}
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
    background-image: url('/media/10.jpg');
    background-repeat: no-repeat;
    background-size: 100% 100%;
    background-position: center;
    z-index: 0;
    filter: brightness(0.6);   /* 略暗，凸显卡片 */
    pointer-events: none;
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
    transform-origin: 0 0;
    transform: scale(clamp(0.44, calc(100vw / 1440), 1));
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

  @media (max-width: 768px) {
    .bg-tile {
      background-image: url('/media/11.jpg');
      width: 100%;
      height: 100%;
      min-width: 100%;
      min-height: 100%;
      aspect-ratio: auto;
      background-size: cover;
      background-position: center;
    }

    .brand-loader {
      top: max(12px, env(safe-area-inset-top));
      left: max(12px, env(safe-area-inset-left));
      height: 40px;
      transform: scale(0.46);
    }
  }

  &.is-mobile-login .bg-tile {
    width: 100%;
    height: 100%;
    min-width: 100%;
    min-height: 100%;
    aspect-ratio: auto;
    background-image: url('/media/11.jpg') !important;
    background-size: cover !important;
    background-position: center !important;
  }

  &.is-mobile-login .brand-loader {
    top: max(12px, env(safe-area-inset-top));
    left: max(12px, env(safe-area-inset-left));
    height: 30px;
    transform: scale(0.46) !important;
    transform-origin: 0 0;
  }
`;

/* ── Card：半透明毛玻璃 ── */
const Card = styled.div`
  position: relative;
  z-index: 3;
  width: min(420px, 90vw);
  padding: 48px 40px 44px;
  border-radius: 24px;
  pointer-events: auto;
  isolation: isolate;
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

  .login-switch {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 26px;
    padding: 6px;
    border-radius: 16px;
    background: rgba(160, 170, 180, 0.16);
    box-shadow:
      inset 0 2px 8px rgba(0, 0, 0, 0.24),
      inset 0 -1px 2px rgba(255, 255, 255, 0.12);
    pointer-events: auto;
  }

  .login-switch button {
    height: 38px;
    border: none;
    border-radius: 12px;
    background: transparent;
    color: rgba(255, 255, 255, 0.52);
    cursor: pointer;
    pointer-events: auto;
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    transition: all 180ms ease;
  }

  .login-switch button.active {
    color: rgba(40, 40, 40, 0.82);
    background: #ccd0d4;
    box-shadow:
      inset 0 -2px 4px rgba(0, 0, 0, 0.22),
      inset 0 2px 4px rgba(255, 255, 255, 0.52),
      0 6px 16px rgba(0, 0, 0, 0.2);
  }

  .wechat-login-panel {
    display: grid;
    gap: 14px;
  }

  .wechat-login-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: rgba(255, 255, 255, 0.84);
  }

  .wechat-login-head strong {
    font-size: 16px;
    letter-spacing: 0.05em;
  }

  .wechat-login-head span {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.52);
  }

  .wechat-qr,
  .wechat-qr-image,
  .wechat-unconfigured {
    width: 206px;
    height: 206px;
    margin: 0 auto;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.38);
    background: rgba(255, 255, 255, 0.92);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.75),
      0 12px 34px rgba(0,0,0,0.28);
  }

  .wechat-qr {
    display: grid;
    grid-template-columns: repeat(11, 1fr);
    gap: 4px;
    padding: 16px;
  }

  .wechat-qr span {
    border-radius: 2px;
    background: #eaf0f4;
  }

  .wechat-qr span.is-dark {
    background: #172535;
  }

  .wechat-qr-image {
    object-fit: contain;
    padding: 10px;
  }

  .wechat-unconfigured {
    display: grid;
    place-items: center;
    gap: 8px;
    padding: 18px;
    text-align: center;
    box-sizing: border-box;
  }

  .wechat-unconfigured strong {
    color: #1f2f3d;
    font-size: 15px;
  }

  .wechat-unconfigured span {
    color: #637789;
    font-size: 12px;
    line-height: 1.45;
  }

  .wechat-hint {
    margin: 0;
    color: rgba(255, 255, 255, 0.56);
    font-size: 12px;
    text-align: center;
    letter-spacing: 0.03em;
  }

  .wechat-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .wechat-actions.is-single {
    grid-template-columns: 1fr;
  }

  .wechat-actions button {
    height: 40px;
    border-radius: 13px;
    border: 1px solid rgba(255,255,255,0.2);
    background: rgba(204, 208, 212, 0.84);
    color: rgba(40,40,40,0.78);
    cursor: pointer;
    pointer-events: auto;
    font-family: inherit;
    font-weight: 700;
    letter-spacing: 0.06em;
    box-shadow:
      inset 0 -2px 4px rgba(0,0,0,0.18),
      inset 0 2px 4px rgba(255,255,255,0.5),
      0 4px 12px rgba(0,0,0,0.2);
  }

  .wechat-actions button:last-child:not(:first-child) {
    background: rgba(38, 132, 86, 0.9);
    color: #fff;
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
