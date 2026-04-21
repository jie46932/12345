// 画廊弹窗 — Apple Carousel 风格 + CometCard 3D 倾斜效果
import { useState, useRef, useEffect } from 'react';

const galleryData = [
  {
    category: '简约白橡',
    title: '自然肌理，极简美学',
    src: '/media/4.png',
    desc: '白橡原木面板搭配铝合金框架，自然纹理与现代工业设计的完美融合。',
  },
  {
    category: '深胡桃色',
    title: '沉稳质感，专属品味',
    src: '/media/5.png',
    desc: '深胡桃色木纹营造出沉稳内敛的氛围，适合追求高级感的工作空间。',
  },
  {
    category: '智能升降',
    title: '站坐自由，健康工作',
    src: '/media/6.png',
    desc: '电动线性马达驱动，68–120cm 无级调节，记忆档位一键到位。',
  },
  {
    category: '整洁桌面',
    title: '走线系统，告别杂乱',
    src: '/media/7.png',
    desc: '内嵌理线槽与桌下线夹，配合无线充电模块，还你干净利落的桌面。',
  },
  {
    category: '双屏办公',
    title: '多屏协同，效率翻倍',
    src: '/media/8.png',
    desc: '宽敞桌面轻松承载双显示器臂，搭配隐藏式线槽，专注不分心。',
  },
  {
    category: '细节工艺',
    title: '每处细节，精心打磨',
    src: '/media/9.png',
    desc: '圆角倒边、无痕拼接、防指纹涂层，用手感说话的高端制造。',
  },
];

// CometCard 3D 倾斜效果
function CometCard({ children }) {
  const cardRef = useRef(null);
  const [transform, setTransform] = useState('');
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    const rotX = -dy * 12;
    const rotY = dx * 12;
    setTransform(`perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.03,1.03,1.03)`);
    setGlare({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
      opacity: 0.15,
    });
  };

  const handleMouseLeave = () => {
    setTransform('perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)');
    setGlare(g => ({ ...g, opacity: 0 }));
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transformStyle: 'preserve-3d',
        transform: transform || 'perspective(800px) rotateX(0deg) rotateY(0deg)',
        transition: 'transform 0.15s ease-out',
        position: 'relative',
        borderRadius: '20px',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {children}
      {/* 光晕层 */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '20px', pointerEvents: 'none',
        background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,${glare.opacity * 2}) 0%, transparent 60%)`,
        transition: 'opacity 0.15s ease-out',
        zIndex: 10,
      }} />
    </div>
  );
}

export default function GalleryModal({ open, onClose }) {
  const [current, setCurrent] = useState(0);
  const dragStartX = useRef(0);
  const dragMoved = useRef(false); // 是否发生了实质性拖拽（>5px），防止和 click 冲突
  const containerRef = useRef(null);

  const prev = () => setCurrent(c => Math.max(0, c - 1));
  const next = () => setCurrent(c => Math.min(galleryData.length - 1, c + 1));

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // window 级 mouseup，防止拖出容器后丢失
  useEffect(() => {
    if (!open) return;
    const handleMouseUp = (e) => {
      if (!dragMoved.current) return;
      dragMoved.current = false;
      const diff = dragStartX.current - e.clientX;
      if (diff > 50) next();
      else if (diff < -50) prev();
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [open]);

  if (!open) return null;

  const handleMouseDown = (e) => {
    dragStartX.current = e.clientX;
    dragMoved.current = false;
  };
  const handleMouseMove = (e) => {
    if (Math.abs(e.clientX - dragStartX.current) > 5) dragMoved.current = true;
  };
  const handleTouchStart = (e) => { dragStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    const diff = dragStartX.current - e.changedTouches[0].clientX;
    if (diff > 50) next();
    else if (diff < -50) prev();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        paddingTop: 80,
        animation: 'gallery-in 0.3s cubic-bezier(0.23,1,0.32,1)',
        pointerEvents: 'auto',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <style>{`
        @keyframes gallery-in {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .gallery-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* 关闭按钮 — fixed + right:90 避开右上角全屏按钮，pointerEvents:auto 覆盖父层 none */}
      <button onClick={onClose} style={{
        position: 'fixed', top: 24, right: 90,
        width: 44, height: 44, borderRadius: '50%',
        background: 'rgba(255,255,255,0.15)',
        border: '1px solid rgba(255,255,255,0.25)',
        color: '#fff', fontSize: 20, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(8px)',
        transition: 'background 0.2s',
        zIndex: 210,
        pointerEvents: 'auto',
      }}>✕</button>

      {/* 标题 */}
      <div style={{
        textAlign: 'center', marginBottom: 16,
        fontFamily: "'Orbitron','Rajdhani',sans-serif",
      }}>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, letterSpacing: '0.2em', marginBottom: 6 }}>
          {galleryData[current].category.toUpperCase()}
        </div>
        <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, letterSpacing: '0.04em' }}>
          {galleryData[current].title}
        </div>
      </div>

      {/* 卡片轮播区 */}
      <div
        ref={containerRef}
        className="gallery-scroll"
        style={{
          position: 'relative',
          width: '100%',
          height: 1020,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
          overflow: 'visible',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {galleryData.map((item, idx) => {
          const offset = idx - current;
          const isCurrent = idx === current;
          const scale = isCurrent ? 1 : Math.abs(offset) === 1 ? 0.82 : 0.68;
          const opacity = isCurrent ? 1 : Math.abs(offset) === 1 ? 0.65 : 0.35;
          const translateX = offset * 780;
          const zIndex = 10 - Math.abs(offset);

          return (
            <div
              key={idx}
              onClick={() => setCurrent(idx)}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translateX(calc(-50% + ${translateX}px)) translateY(-50%) scale(${scale})`,
                opacity,
                zIndex,
                transition: 'all 0.45s cubic-bezier(0.23,1,0.32,1)',
                transformOrigin: 'center center',
                flexShrink: 0,
                cursor: isCurrent ? 'default' : 'pointer',
              }}
            >
              <CometCard>
                <div style={{
                  width: 720, borderRadius: 20, overflow: 'hidden',
                  background: '#1a1a1a',
                  boxShadow: isCurrent
                    ? '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)'
                    : '0 16px 40px rgba(0,0,0,0.4)',
                }}>
                  <div style={{ position: 'relative', aspectRatio: '3/4', overflow: 'hidden' }}>
                    <img
                      src={item.src}
                      alt={item.title}
                      style={{
                        width: '100%', height: '100%',
                        objectFit: 'cover',
                        filter: isCurrent ? 'contrast(1.05) saturate(1.1)' : 'contrast(0.8) saturate(0.8)',
                        transition: 'filter 0.4s ease',
                      }}
                      draggable={false}
                    />
                    {/* 渐变遮罩 */}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      height: '60%',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
                    }} />
                    <div style={{
                      position: 'absolute', bottom: 16, left: 16, right: 16,
                      color: 'rgba(255,255,255,0.9)',
                      fontFamily: "'Rajdhani','Inter',sans-serif",
                      fontSize: 13, letterSpacing: '0.06em',
                    }}>
                      {item.category}
                    </div>
                  </div>
                  {isCurrent && (
                    <div style={{
                      padding: '16px 16px 20px',
                      color: 'rgba(255,255,255,0.65)',
                      fontFamily: "'Rajdhani','Inter',sans-serif",
                      fontSize: 13, lineHeight: 1.6,
                    }}>
                      {item.desc}
                    </div>
                  )}
                </div>
              </CometCard>
            </div>
          );
        })}
      </div>

      {/* 底部指示点 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16, position: 'relative', zIndex: 20 }}>
        {galleryData.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            style={{
              width: idx === current ? 24 : 8,
              height: 8, borderRadius: 4,
              background: idx === current ? '#fff' : 'rgba(255,255,255,0.3)',
              border: 'none', cursor: 'pointer', padding: 0,
              transition: 'all 0.3s cubic-bezier(0.23,1,0.32,1)',
            }}
          />
        ))}
      </div>

    </div>
  );
}

