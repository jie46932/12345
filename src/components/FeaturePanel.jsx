// 产品特性浮动面板
// - 可拖拽，默认右侧居中
// - 5 个特性条目，点击展开详情
// - 与 showAnnotations 联动（面板展开 = 标注可见）

import { useState, useRef, useCallback } from 'react';

const FEATURES = [
  {
    id: 'f034',
    icon: '🪵',
    title: 'FAS级全实木桌面',
    detail: 'FAS级3CM橡胶木100%全实木，更耐用；环保嘉宝莉水性漆多层高规格防刮保护涂装',
  },
  {
    id: 'f035',
    icon: '🦾',
    title: '升级冷轧钢腿框架',
    detail: '升级冷轧桌腿加粗加宽加厚；多重框架升级静态承重可达600斤',
  },
  {
    id: 'f036',
    icon: '✋',
    title: '人体工学桌面边缘',
    detail: '加宽斜坡设计贴合手腕不酸痛；CHAO大圆边设计安全防磕碰',
  },
  {
    id: 'f037',
    icon: '⚡',
    title: '睡眠级静音电机',
    detail: '睡眠级消声电机德国降噪科技；标杆级电机CQC品牌认证澎湃性能',
  },
  {
    id: 'f038',
    icon: '📱',
    title: '智能数显控制器',
    detail: '数显控制器灵活操作不延时；智能久坐提醒站坐交替更健康',
  },
];

export default function FeaturePanel({ visible, onToggle }) {
  const [expanded, setExpanded] = useState(null); // 当前展开的条目 id
  const panelRef = useRef(null);

  // ── 拖拽逻辑 ──
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, origLeft: 0, origTop: 0 });

  const onPointerDown = useCallback((e) => {
    if (e.target.closest('.fp-item')) return; // 点击条目不拖拽
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    // 首次拖拽：从 transform 定位切换到 left/top 绝对定位
    if (!panel.dataset.positioned) {
      panel.style.right = 'auto';
      panel.style.left = rect.left + 'px';
      panel.style.top  = rect.top  + 'px';
      panel.style.transform = 'none';
      panel.dataset.positioned = '1';
    }
    dragState.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origLeft: parseFloat(panel.style.left),
      origTop:  parseFloat(panel.style.top),
    };
    panel.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback((e) => {
    const ds = dragState.current;
    if (!ds.dragging) return;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    const panel = panelRef.current;
    if (panel) {
      panel.style.left = (ds.origLeft + dx) + 'px';
      panel.style.top  = (ds.origTop  + dy) + 'px';
    }
  }, []);

  const onPointerUp = useCallback(() => {
    dragState.current.dragging = false;
  }, []);

  const toggleItem = (id) => {
    setExpanded(prev => prev === id ? null : id);
  };

  return (
    <>
      <style>{`
        /* ── 面板整体 ── */
        .fp-panel {
          position: fixed;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 60;
          width: 300px;
          background: rgba(12, 14, 18, 0.82);
          backdrop-filter: blur(20px) saturate(1.5);
          -webkit-backdrop-filter: blur(20px) saturate(1.5);
          border: 1px solid rgba(180, 150, 80, 0.35);
          border-radius: 16px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
          overflow: hidden;
          user-select: none;
        }

        /* ── 把手（顶部可拖拽区域） ── */
        .fp-handle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px 10px;
          background: rgba(180, 150, 80, 0.12);
          border-bottom: 1px solid rgba(180, 150, 80, 0.2);
          cursor: grab;
        }
        .fp-handle:active { cursor: grabbing; }

        .fp-handle-title {
          font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: rgba(180, 150, 80, 0.9);
          letter-spacing: 0.08em;
        }

        .fp-handle-dots {
          display: flex;
          gap: 4px;
        }
        .fp-handle-dots span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: rgba(180, 150, 80, 0.5);
        }

        /* ── 条目列表 ── */
        .fp-list {
          padding: 8px 0;
        }

        /* ── 单条条目 ── */
        .fp-item {
          cursor: pointer;
          transition: background 0.15s;
        }
        .fp-item:hover .fp-item-header {
          background: rgba(180, 150, 80, 0.08);
        }

        .fp-item-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          transition: background 0.15s;
        }

        .fp-item-icon {
          font-size: 18px;
          width: 24px;
          text-align: center;
          flex-shrink: 0;
        }

        .fp-item-title {
          flex: 1;
          font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          letter-spacing: 0.02em;
        }

        .fp-item-arrow {
          font-size: 11px;
          color: rgba(180, 150, 80, 0.7);
          transition: transform 0.2s;
          flex-shrink: 0;
        }
        .fp-item-arrow.open {
          transform: rotate(90deg);
        }

        /* ── 展开详情 ── */
        .fp-item-detail {
          overflow: hidden;
          max-height: 0;
          transition: max-height 0.25s ease, padding 0.25s ease;
          padding: 0 16px 0 50px;
        }
        .fp-item-detail.open {
          max-height: 120px;
          padding: 0 16px 12px 50px;
        }

        .fp-item-detail-text {
          font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
          font-size: 12px;
          line-height: 1.7;
          color: rgba(200, 200, 200, 0.7);
          border-left: 2px solid rgba(180, 150, 80, 0.4);
          padding-left: 10px;
        }

        /* ── 分隔线 ── */
        .fp-divider {
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 0 16px;
        }

        /* ── 底部关闭按钮 ── */
        .fp-footer {
          padding: 10px 16px;
          border-top: 1px solid rgba(180, 150, 80, 0.2);
          display: flex;
          justify-content: center;
        }

        .fp-close-btn {
          font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
          font-size: 12px;
          color: rgba(180, 150, 80, 0.7);
          background: none;
          border: 1px solid rgba(180, 150, 80, 0.3);
          border-radius: 8px;
          padding: 5px 20px;
          cursor: pointer;
          letter-spacing: 0.05em;
          transition: all 0.15s;
        }
        .fp-close-btn:hover {
          background: rgba(180, 150, 80, 0.12);
          color: rgba(180, 150, 80, 1);
          border-color: rgba(180, 150, 80, 0.6);
        }
      `}</style>

      {visible && (
        <div
          ref={panelRef}
          className="fp-panel"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* 拖拽把手 */}
          <div className="fp-handle">
            <span className="fp-handle-title">产品特性</span>
            <div className="fp-handle-dots">
              <span /><span /><span />
            </div>
          </div>

          {/* 特性列表 */}
          <div className="fp-list">
            {FEATURES.map((feat, idx) => (
              <div key={feat.id} className="fp-item">
                {idx > 0 && <div className="fp-divider" />}
                <div
                  className="fp-item-header"
                  onClick={() => toggleItem(feat.id)}
                >
                  <span className="fp-item-icon">{feat.icon}</span>
                  <span className="fp-item-title">{feat.title}</span>
                  <span className={`fp-item-arrow ${expanded === feat.id ? 'open' : ''}`}>▶</span>
                </div>
                <div className={`fp-item-detail ${expanded === feat.id ? 'open' : ''}`}>
                  <div className="fp-item-detail-text">{feat.detail}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 底部关闭 */}
          <div className="fp-footer">
            <button className="fp-close-btn" onClick={onToggle}>收起面板</button>
          </div>
        </div>
      )}
    </>
  );
}
