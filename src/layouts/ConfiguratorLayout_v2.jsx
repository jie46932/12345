import { useState } from 'react'
import { BgColorsOutlined, ColumnHeightOutlined, ToolOutlined, ScanOutlined, ShoppingCartOutlined } from '@ant-design/icons'

/**
 * ConfiguratorLayout - 方案四：右侧悬浮卡片布局
 *
 * 布局结构：
 * - 全屏 3D 视口（背景层）
 * - 左上角 Logo
 * - 右上角 AR 入口按钮
 * - 右侧悬浮控制卡片组（材质 / 高度 / 配件）
 * - 底部状态栏（可选）
 */
export default function ConfiguratorLayout({ children, slots = {} }) {
  const [	activeCard, setActiveCard] = useState('material')

  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ background: '#0A1628', fontFamily: "'Rajdhani', 'Space Mono', monospace" }}
    >
      {/* ─── 层 0：字体引入 ─────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');

        :root {
          --c-bg:       #0A1628;
          --c-surface:  #0D1E3A;
          --c-border:   #1A3050;
          --c-accent:   #00D4FF;
          --c-accent2:  #0066CC;
          --c-text:     #E8F4FF;
          --c-muted:    #4A7FA5;
          --c-danger:   #FF4444;
        }

        .card-glass {
          background: rgba(10, 22, 40, 0.85);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(0, 212, 255, 0.15);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(0, 212, 255, 0.08);
        }

        .tab-active {
          color: var(--c-accent);
          border-bottom: 2px solid var(--c-accent);
        }

        .tab-inactive {
          color: var(--c-muted);
          border-bottom: 2px solid transparent;
        }

        .tab-inactive:hover {
          color: var(--c-text);
        }

        .scan-line {
          background: linear-gradient(
            to right,
            transparent,
            rgba(0, 212, 255, 0.03) 50%,
            transparent
          );
          animation: scan 4s linear infinite;
        }

        @keyframes scan {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }

        .ar-pulse::before {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 1px solid rgba(0, 212, 255, 0.4);
          animation: pulse-ring 2s ease-out infinite;
        }

        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>

      {/* ─── 层 1：3D 视口（全屏背景）────────────────── */}
      <div
        data-slot="viewport"
        className="absolute inset-0 z-0"
      >
        {slots.viewport ?? (
          // 占位渐变（无 Verge3D 时显示）
          <div
            className="w-full h-full"
            style={{
              background: 'radial-gradient(ellipse 80% 60% at 40% 60%, #0D2040 0%, #0A1628 60%, #060E1C 100%)'
            }}
          />
        )}
      </div>

      {/* ─── 扫描线氛围层 ─────────────────────────── */}
      <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
        <div className="scan-line absolute left-0 right-0 h-[2px]" />
      </div>

      {/* ─── 层 2：左上角 Logo ───────────────────────── */}
      <header
        data-slot="logo"
        className="absolute top-8 left-8 z-20 flex items-center gap-3"
      >
        {slots.logo ?? (
          <>
            {/* 竖色条 */}
            <div
              className="w-[3px] h-9"
              style={{ background: 'var(--c-accent)' }}
            />
            <div className="flex flex-col">
              <span
                className="text-lg font-bold tracking-[0.2em] leading-none"
                style={{ color: 'var(--c-text)', fontFamily: "'Rajdhani', monospace" }}
              >
                ERGODESK
              </span>
              <span
                className="text-[8px] tracking-[0.35em] uppercase"
                style={{ color: 'var(--c-muted)' }}
              >
                PRO CONFIGURATOR
              </span>
            </div>
          </>
        )}
      </header>

      {/* ─── 层 3：右上角 AR 按钮 ──────────────────── */}
      <div
        data-slot="ar-button"
        className="absolute top-8 right-8 z-20"
      >
        {slots.arButton ?? (
          <button
            className="ar-pulse relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-widest uppercase transition-all duration-200 hover:scale-105"
            style={{
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.4)',
              color: 'var(--c-accent)',
              fontFamily: "'Space Mono', monospace"
            }}
          >
            <ScanOutlined style={{ fontSize: 14 }} />
            AR VIEW
          </button>
        )}
      </div>

      {/* ─── 层 4：右侧悬浮控制卡片组 ──────────────── */}
      <aside
        data-slot="control-panel"
        className="absolute right-8 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3"
        style={{ width: 220 }}
      >
        {slots.controlPanel ?? (
          <>
            {/* 标签页切换器 */}
            <div
              className="card-glass rounded-lg px-2 pt-3 pb-1"
            >
              <div className="flex gap-1 mb-3 px-1">
                {[
                  { id: 'material',    label: 'MAT', Icon: BgColorsOutlined },
                  { id: 'height',      label: 'HGT', Icon: ColumnHeightOutlined  },
                  { id: 'accessories', label: 'ACC', Icon: ToolOutlined },
                ].map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveCard(id)}
                    className={`flex-1 flex flex-col items-center gap-1 pb-2 transition-all duration-150 ${
                      activeCard === id ? 'tab-active' : 'tab-inactive'
                    }`}
                  >
                    <Icon style={{ fontSize: 14 }} />
                    <span className="text-[7px] font-semibold tracking-widest" style={{ fontFamily: "'Space Mono', monospace" }}>{label}</span>
                  </button>
                ))}
              </div>

              {/* 材质面板 */}
              {activeCard === 'material' && (
                <div data-slot="material-panel" className="px-2 pb-3">
                  <p className="text-[8px] tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--c-muted)' }}>SURFACE MATERIAL</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { name: 'OAK',    color: '#8B6F47', active: true },
                      { name: 'WALNUT', color: '#3D2B1F', active: false },
                      { name: 'WHITE',  color: '#D4CFC6', active: false },
                    ].map(mat => (
                      <button key={mat.name} className="flex flex-col items-center gap-1 group">
                        <div
                          className="w-full aspect-square rounded transition-all duration-150"
                          style={{
                            background: mat.color,
                            border: mat.active
                              ? '2px solid var(--c-accent)'
                              : '1px solid var(--c-border)',
                            boxShadow: mat.active ? '0 0 8px rgba(0,212,255,0.3)' : 'none'
                          }}
                        />
                        <span className="text-[7px] tracking-widest" style={{ color: mat.active ? 'var(--c-accent)' : 'var(--c-muted)' }}>{mat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 高度面板 */}
              {activeCard === 'height' && (
                <div data-slot="height-panel" className="px-2 pb-3">
                  <p className="text-[8px] tracking-[0.3em] uppercase mb-1" style={{ color: 'var(--c-muted)' }}>DESK HEIGHT</p>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-2xl font-bold" style={{ color: 'var(--c-text)', fontFamily: "'Rajdhani'" }}>72</span>
                    <span className="text-xs" style={{ color: 'var(--c-muted)' }}>cm</span>
                  </div>
                  <input
                    type="range" min="68" max="120" defaultValue="72"
                    className="w-full accent-cyan-400"
                    style={{ accentColor: 'var(--c-accent)' }}
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[7px]" style={{ color: 'var(--c-muted)' }}>68 cm</span>
                    <span className="text-[7px]" style={{ color: 'var(--c-muted)' }}>120 cm</span>
                  </div>
                </div>
              )}

              {/* 配件面板 */}
              {activeCard === 'accessories' && (
                <div data-slot="accessories-panel" className="px-2 pb-3">
                  <p className="text-[8px] tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--c-muted)' }}>ACCESSORIES</p>
                  {['Monitor Arm', 'Cable Tray', 'Drawer Unit'].map(acc => (
                    <label key={acc} className="flex items-center justify-between py-2 cursor-pointer" style={{ borderBottom: '1px solid var(--c-border)' }}>
                      <span className="text-[10px] tracking-wider" style={{ color: 'var(--c-text)' }}>{acc}</span>
                      <div
                        className="w-8 h-4 rounded-full relative transition-all duration-200"
                        style={{ background: 'var(--c-border)' }}
                      >
                        <div className="absolute left-0.5 top-0.5 w-3 h-3 rounded-full" style={{ background: 'var(--c-muted)' }} />
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* 价格卡片 */}
            <div className="card-glass rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[7px] tracking-[0.3em] uppercase" style={{ color: 'var(--c-muted)' }}>TOTAL</p>
                <span className="text-lg font-bold" style={{ color: 'var(--c-text)', fontFamily: "'Rajdhani'" }}>¥ 4,299</span>
              </div>
              <button
                className="px-4 py-2 rounded text-[9px] font-bold tracking-widest uppercase transition-all duration-200 hover:brightness-110"
                style={{
                  background: 'linear-gradient(135deg, var(--c-accent2), var(--c-accent))',
                  color: '#0A1628',
                  fontFamily: "'Space Mono', monospace"
                }}
              >
                <ShoppingCartOutlined style={{ fontSize: 12 }} className="inline mr-1.5" />
                ORDER
              </button>
            </div>
          </>
        )}
      </aside>

      {/* ─── 层 5：底部状态栏（可选）──────────────── */}
      <footer
        data-slot="status-bar"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20"
      >
        {slots.statusBar ?? (
          <div
            className="flex items-center gap-6 px-6 py-2 rounded-full text-[8px] tracking-[0.25em] uppercase"
            style={{
              background: 'rgba(10,22,40,0.7)',
              border: '1px solid var(--c-border)',
              color: 'var(--c-muted)',
              fontFamily: "'Space Mono', monospace"
            }}
          >
            <span>DRAG TO ROTATE</span>
            <span style={{ color: 'var(--c-border)' }}>|</span>
            <span>SCROLL TO ZOOM</span>
            <span style={{ color: 'var(--c-border)' }}>|</span>
            <span style={{ color: 'var(--c-accent)' }}>● LIVE</span>
          </div>
        )}
      </footer>

      {/* ─── 其他子内容插槽 ───────────────────────── */}
      {children}
    </div>
  )
}
