// 购物车弹窗 — 材质 + 配件 + 价格明细
import { useEffect } from 'react';
import { MATERIALS, ACCESSORY_INFO, BASE_PRICE } from '../data/products';

const MATERIAL_INFO = Object.fromEntries(MATERIALS.map(m => [m.id, m]));

export default function CartModal({ open, onClose, material, activeAccessory, height }) {
  useEffect(() => {
    if (!open) return;
    const handle = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, onClose]);

  if (!open) return null;

  const matInfo = MATERIAL_INFO[material];
  const matPrice = matInfo?.price ?? 0;

  // activeAccessory 是 Set，支持多选
  const accSet = activeAccessory instanceof Set ? activeAccessory : new Set();
  const accItems = [...accSet]
    .map(id => ACCESSORY_INFO[id])
    .filter(Boolean)
    .filter(a => a.price > 0); // 只显示有价格的配件
  const accPrice = accItems.reduce((s, a) => s + a.price, 0);

  const total = BASE_PRICE + matPrice + accPrice;

  const lineItems = [
    { label: '智能升降桌 · 基础款', desc: `桌高 ${height}cm 档位`, price: BASE_PRICE, isBase: true },
    matInfo && { label: `桌面材质 · ${matInfo.name}`, desc: '实木贴面工艺', price: matPrice, isMat: true },
    ...accItems.map(a => ({ label: `配件 · ${a.name}`, desc: '原厂配套', price: a.price })),
  ].filter(Boolean);

  return (
    <>
      <div
        style={{
          position: 'fixed',
          bottom: 120,
          right: 24,
          zIndex: 300,
          width: 360,
          pointerEvents: 'auto',
          background: 'rgba(204,208,212,0.36)',
          backdropFilter: 'blur(18px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.4)',
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.45)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 24px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          animation: 'cart-slide-in 0.35s cubic-bezier(0.23,1,0.32,1)',
          fontFamily: "'Rajdhani','Inter',sans-serif",
        }}
      >
        <style>{`
          @keyframes cart-slide-in {
            from { opacity: 0; transform: translateY(-16px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0)    scale(1);    }
          }
        `}</style>

        {/* 头部 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(0,0,0,0.7)' }}>
            购物清单
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(0,0,0,0.08)', border: 'none',
            color: 'rgba(0,0,0,0.5)', fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* 明细列表 */}
        <div style={{ padding: '12px 24px' }}>
          {lineItems.map((item, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '14px 0',
              borderBottom: i < lineItems.length - 1 ? '1px solid rgba(0,0,0,0.07)' : 'none',
            }}>
              <div>
                {/* 材质色块 */}
                {item.isMat && matInfo && (
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: matInfo.color,
                    display: 'inline-block', verticalAlign: 'middle',
                    marginRight: 8,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  }} />
                )}
                <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(0,0,0,0.72)', letterSpacing: '0.04em' }}>
                  {item.label}
                </span>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.38)', marginTop: 2, letterSpacing: '0.04em' }}>
                  {item.desc}
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(0,0,0,0.65)', whiteSpace: 'nowrap', marginLeft: 12 }}>
                {item.price === 0 ? '已包含' : `¥${item.price}`}
              </div>
            </div>
          ))}
        </div>

        {/* 合计 */}
        <div style={{
          padding: '16px 24px 20px',
          borderTop: '1px solid rgba(0,0,0,0.1)',
          background: 'rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 14, color: 'rgba(0,0,0,0.45)', letterSpacing: '0.08em' }}>合计</span>
            <span style={{
              fontSize: 32, fontWeight: 800, lineHeight: 1,
              color: 'rgba(0,0,0,0.75)',
              fontFamily: "'Orbitron','Rajdhani',sans-serif",
              letterSpacing: '-0.02em',
            }}>¥{total}</span>
          </div>
          {/* 立即下单 — neumorphism 凹槽 + 凸起按钮 */}
          <div style={{
            width: '100%', height: 52, borderRadius: 16,
            background: 'transparent',
            position: 'relative',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
            className="order-btn-wrap"
            onClick={() => {}}
          >
            {/* 凸起圆角矩形 */}
            <span style={{
              position: 'absolute',
              inset: 5,
              borderRadius: 12,
              background: '#ccd0d4',
              filter: 'blur(1px)',
              boxShadow: `
                0 15px 25px -4px rgba(0,0,0,0.5),
                inset 0 -3px 4px -1px rgba(0,0,0,0.2),
                0 -10px 15px -1px rgba(255,255,255,0.6),
                inset 0 3px 4px -1px rgba(255,255,255,0.2),
                inset 0 0 5px 1px rgba(255,255,255,0.8),
                inset 0 20px 30px 0 rgba(255,255,255,0.2)
              `,
              transition: 'box-shadow 300ms cubic-bezier(0.23,1,0.32,1), transform 300ms cubic-bezier(0.23,1,0.32,1)',
            }} className="order-btn-inner" />
            {/* 文字层 */}
            <span style={{
              position: 'relative', zIndex: 2,
              fontSize: 16, fontWeight: 700, letterSpacing: '0.12em',
              color: 'rgba(0,0,0,0.6)',
              fontFamily: "'Rajdhani','Inter',sans-serif",
              pointerEvents: 'none',
            }}>立即下单</span>
            <style>{`
              .order-btn-wrap:active .order-btn-inner {
                transform: translateY(1px);
                box-shadow:
                  0 15px 25px -4px rgba(0,0,0,0.4),
                  inset 0 -8px 30px 1px rgba(255,255,255,0.9),
                  0 -10px 15px -1px rgba(255,255,255,0.6),
                  inset 0 8px 25px 0 rgba(0,0,0,0.4),
                  inset 0 0 10px 1px rgba(255,255,255,0.6) !important;
              }
            `}</style>
          </div>
        </div>
      </div>
    </>
  );
}
