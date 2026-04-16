import { useState } from 'react';

export default function Sidebar({ height, onHeightChange, material, onMaterialChange, price, monitorAddon, onMonitorAddonChange }) {
  const [openAccordion, setOpenAccordion] = useState('material');
  const [cartCount, setCartCount] = useState(0);

  const heightLabel = height === 68 ? '最低' : height === 75 ? '坐姿' : height === 94 ? '标准' : height === 110 ? '站姿' : '最高';

  const materials = [
    { id: 'light', name: '浅胡桃木', price: 0, image: '/media/Wood03_512_BaseColor.png' },
    { id: 'oak', name: '原木白橡', price: 0, image: '/media/Wood06_512_BaseColor.png' },
    { id: 'dark', name: '黑胡桃木', price: 0, image: '/media/Wood07_512_BaseColor.png' }
  ];

  const heightPresets = [
    { cm: 68, label: '最低' },
    { cm: 75, label: '坐姿' },
    { cm: 94, label: '标准' },
    { cm: 110, label: '站姿' },
    { cm: 120, label: '最高' }
  ];

  return (
    <aside className="sidebar sidebar-right">
      <div className="sidebar-inner">
        <div className="sb-row">
          <div className="sb-icon-col">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="cart-badge-sm">{cartCount}</span>
          </div>
          <div className="sb-content-col right-inner">
            {/* 高度实时显示 */}
            <div className="height-live">
              <div className="height-live-num">{height}</div>
              <div className="height-live-unit">cm · {heightLabel}</div>
            </div>

            {/* 价格区 */}
            <div className="price-zone">
              <div className="price-zone-base">
                <span>基础价</span>
                <span>¥899</span>
              </div>
              <div className="price-zone-addon" style={{ opacity: monitorAddon ? 1 : 0.45 }}>
                <span>显示器支架</span>
                <span className="price-addon-val" style={{ display: monitorAddon ? '' : 'none' }}>+¥89</span>
              </div>
              <div className="price-zone-divider"></div>
              <div className="price-zone-total">
                <span className="price-zone-total-label">总计</span>
                <span className="price-zone-total-val">¥{price.toLocaleString()}</span>
              </div>
            </div>

            <button className="btn-inquiry">立即询价</button>

            <div className="accordion">
              {/* 桌面木纹 */}
              <div className={`accordion-item ${openAccordion === 'material' ? 'open' : ''}`}>
                <button className="accordion-header" onClick={() => setOpenAccordion(openAccordion === 'material' ? '' : 'material')}>
                  <div className="acc-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
                      <circle cx="8.5" cy="10" r="1.5" fill="currentColor" opacity="0.6"/>
                      <circle cx="14" cy="8.5" r="1.5" fill="currentColor" opacity="0.8"/>
                      <circle cx="15.5" cy="14" r="1.5" fill="currentColor"/>
                    </svg>
                  </div>
                  <span className="acc-title">桌面木纹</span>
                  <span className="acc-val">{materials.find(m => m.id === material)?.name}</span>
                  <svg className="acc-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div className="accordion-body">
                  <div className="color-list">
                    {materials.map(mat => (
                      <button
                        key={mat.id}
                        className={`material-item ${material === mat.id ? 'active' : ''}`}
                        onClick={() => onMaterialChange(mat.id)}
                      >
                        <span className="swatch-wood" style={{ backgroundImage: `url(${mat.image})` }}></span>
                        <span className="color-name">{mat.name}</span>
                        <span className="color-price">标准</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 配件选择 */}
              <div className={`accordion-item ${openAccordion === 'addons' ? 'open' : ''}`}>
                <button className="accordion-header" onClick={() => setOpenAccordion(openAccordion === 'addons' ? '' : 'addons')}>
                  <div className="acc-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span className="acc-title">配件选择</span>
                  <span className="acc-val">3 项</span>
                  <svg className="acc-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div className="accordion-body">
                  <div className="addon-list">
                    <div className={`addon-item has-checkbox ${monitorAddon ? 'checked' : ''}`} onClick={() => onMonitorAddonChange(!monitorAddon)}>
                      <div className="addon-checkbox">
                        <svg className="addon-checkbox-check" width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <span className="addon-label">显示器支架</span>
                      <span className="addon-badge">+¥89</span>
                    </div>
                    <div className="addon-item">
                      <div className="addon-checkbox" style={{ background: '#F5F0E8', borderColor: 'rgba(74,160,100,0.3)' }}>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#4AA064" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <span className="addon-label">水杯支架</span>
                      <span className="addon-badge free">已包含</span>
                    </div>
                    <div className="addon-item">
                      <div className="addon-checkbox" style={{ background: '#F5F0E8', borderColor: 'rgba(74,160,100,0.3)' }}>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#4AA064" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <span className="addon-label">耳机挂钩</span>
                      <span className="addon-badge free">已包含</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 规格参数 */}
              <div className={`accordion-item ${openAccordion === 'specs' ? 'open' : ''}`}>
                <button className="accordion-header" onClick={() => setOpenAccordion(openAccordion === 'specs' ? '' : 'specs')}>
                  <div className="acc-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span className="acc-title">规格参数</span>
                  <span className="acc-val">{height}cm</span>
                  <svg className="acc-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div className="accordion-body">
                  <div className="spec-list">
                    <div className="spec-row"><span className="spec-k">桌面尺寸</span><span className="spec-v">140 × 70 cm</span></div>
                    <div className="spec-row"><span className="spec-k">高度范围</span><span className="spec-v">68 — 120 cm</span></div>
                    <div className="spec-row"><span className="spec-k">当前高度</span><span className="spec-v">{height}cm</span></div>
                    <div className="spec-row"><span className="spec-k">最大承重</span><span className="spec-v">100 kg</span></div>
                    <div className="spec-row"><span className="spec-k">电机功率</span><span className="spec-v">双电机 160W</span></div>
                    <div className="spec-row"><span className="spec-k">噪音</span><span className="spec-v">&lt; 45 dB</span></div>
                    <div className="spec-row"><span className="spec-k">桌面颜色</span><span className="spec-v">{materials.find(m => m.id === material)?.name}</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="buy-block">
              <button className="btn-reset">↺ 恢复默认</button>
              <button className="btn-buy">立即购买</button>
              <button className="btn-cart">加入购物车</button>
            </div>

            <div className="contact-info">
              <a href="tel:4008888888" className="contact-row">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                400-888-8888
              </a>
              <div className="contact-row">HE FURNITURE 官方旗舰店</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
