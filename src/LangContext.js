import { createContext, useContext } from 'react';

export const LangContext = createContext('zh');

export function useLang() {
  return useContext(LangContext);
}

// 所有 UI 文本的中英文翻译
export const T = {
  zh: {
    height: '高度',
    annotation: '尺寸',
    share: '分享',
    qr: '二维码',
    gallery: '画廊',
    material: '材质',
    accessory: '配件',
    cart: '购物车',
    rise: '上升',
    descend: '下降',
    expand: '展开高度',
    clickStop: '点击停止',
    rank1: '一档',
    rank2: '二档',
    rank3: '三档',
    mat_light: '浅胡桃色',
    mat_oak: '白橡原木',
    mat_dark: '深胡桃色',
    acc_cup: '杯架',
    acc_hook: '挂钩',
    acc_lamp: '台灯',
    scanQr: '扫码查看',
    brand: 'HE FURNITURE',
    sub: '智能升降桌',
  },
  en: {
    height: 'HEIGHT',
    annotation: 'INFO',
    share: 'SHARE',
    qr: 'QR',
    gallery: 'GALLERY',
    material: 'MATERIAL',
    accessory: 'ADD-ON',
    cart: 'CART',
    rise: 'RISE',
    descend: 'LOWER',
    expand: 'ADJUST',
    clickStop: 'STOP',
    rank1: 'LOW',
    rank2: 'MID',
    rank3: 'HIGH',
    mat_light: 'LIGHT WALNUT',
    mat_oak: 'WHITE OAK',
    mat_dark: 'DARK WALNUT',
    acc_cup: 'CUP',
    acc_hook: 'HOOK',
    acc_lamp: 'LAMP',
    scanQr: 'Scan to view',
    brand: 'HE FURNITURE',
    sub: 'HEIGHT-ADJ DESK',
  },
};
