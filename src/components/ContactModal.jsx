import { useEffect } from 'react';
import { useLang, T } from '../LangContext';
import useStore from '../store/useStore';
import { mediaUrl } from '../utils/assetUrl';

const CONTACT_INFO = {
  qrSrc: mediaUrl('wechat-qr.jpg'),
  name: '沈杰',
  phone: '18684747357',
  wechat: 'SaveSimply',
  zh: { title: '产品顾问', address: '广东省广州市南沙区' },
  en: { title: 'Product Consultant', address: 'Nansha District, Guangzhou, Guangdong' },
};

const QR_IMAGE_RATIO = '592 / 754';

function resolveAssetUrl(asset) {
  if (typeof asset === 'string') return mediaUrl(asset);
  return mediaUrl(asset?.url || asset?.path || CONTACT_INFO.qrSrc);
}

export default function ContactModal({ open, onClose }) {
  const configuredContact = useStore((s) => s.projectConfig.consultation);
  const lang = useLang();
  const t = T[lang];

  // 合并配置（仅非空值覆盖），语言相关字段从 zh/en 子对象取值
  const langDefaults = CONTACT_INFO[lang] || CONTACT_INFO.zh;
  const contactInfo = {
    name: CONTACT_INFO.name,
    phone: CONTACT_INFO.phone,
    wechat: CONTACT_INFO.wechat,
    title: langDefaults.title,
    address: langDefaults.address,
  };
  if (configuredContact) {
    for (const [k, v] of Object.entries(configuredContact)) {
      if (v !== '' && v !== null && v !== undefined && k !== 'zh' && k !== 'en') {
        contactInfo[k] = v;
      }
    }
  }
  const qrSrc = resolveAssetUrl(CONTACT_INFO.qrSrc);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const rows = [
    [t.contactName, contactInfo.name],
    [t.contactTitle, contactInfo.title],
    [t.contactPhone, contactInfo.phone],
    [t.contactWechat, contactInfo.wechat],
    [t.contactAddress, contactInfo.address],
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 320,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        pointerEvents: 'auto',
        background: 'rgba(0,0,0,0.12)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="contact-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, calc(100vw - 48px))',
          display: 'grid',
          gridTemplateColumns: '240px minmax(0, 1fr)',
          alignItems: 'stretch',
          gap: 26,
          padding: 28,
          borderRadius: 24,
          background: 'rgba(204,208,212,0.58)',
          backdropFilter: 'blur(24px) saturate(1.45)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.45)',
          border: '1px solid rgba(255,255,255,0.52)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.68), 0 18px 48px rgba(0,0,0,0.18)',
          fontFamily: "'Rajdhani','Inter','PingFang SC',sans-serif",
          color: 'rgba(0,0,0,0.72)',
          animation: 'contact-modal-in 0.28s cubic-bezier(0.23,1,0.32,1)',
        }}
      >
        <style>{`
          @keyframes contact-modal-in {
            from { opacity: 0; transform: translateY(12px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @media (max-width: 640px) {
            .contact-modal-card {
              grid-template-columns: 1fr !important;
              width: min(360px, calc(100vw - 32px)) !important;
              padding: 22px !important;
            }
            .contact-qr-panel {
              min-height: 0 !important;
            }
            .contact-qr-image-wrap {
              width: min(180px, 100%) !important;
            }
          }
        `}</style>

        <div className="contact-qr-panel" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 18,
          minHeight: '100%',
          borderRadius: 18,
          background: 'rgba(255,255,255,0.32)',
          border: '1px solid rgba(255,255,255,0.46)',
          WebkitTouchCallout: 'default',
          userSelect: 'auto',
        }}>
          <div
            className="contact-qr-image-wrap"
            style={{
              width: 'min(176px, 100%)',
              aspectRatio: QR_IMAGE_RATIO,
              borderRadius: 12,
              overflow: 'hidden',
              background: '#fff',
              boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
              WebkitTouchCallout: 'default',
              userSelect: 'auto',
            }}
          >
            <img
              src={qrSrc}
              alt={t.contactQrCaption || '二维码'}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                WebkitTouchCallout: 'default',
                userSelect: 'auto',
                pointerEvents: 'auto',
              }}
            />
          </div>
          <div style={{
            fontSize: 13,
            color: 'rgba(0,0,0,0.58)',
            letterSpacing: '0.04em',
            textAlign: 'center',
          }}>
            {lang === 'en' ? 'Long press to identify WeChat QR code' : '长按识别二维码添加微信'}
          </div>
        </div>

        <div style={{
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          <div style={{
            display: 'grid',
            gap: 10,
          }}>
            {rows.map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '64px minmax(0, 1fr)',
                  gap: 14,
                  alignItems: 'start',
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.24)',
                  border: '1px solid rgba(255,255,255,0.36)',
                }}
              >
                <span style={{
                  fontSize: 13,
                  color: 'rgba(0,0,0,0.42)',
                  letterSpacing: '0.08em',
                  whiteSpace: 'nowrap',
                }}>{label}</span>
                <span style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'rgba(0,0,0,0.7)',
                  wordBreak: 'break-word',
                  lineHeight: 1.45,
                }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


