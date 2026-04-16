export const SLOTS = {
  viewport: { name: '3D视口', required: true },
  topBar: { name: '顶部栏', required: false },
  rightPanel: { name: '右侧面板', required: false },
  bottomBar: { name: '底部栏', required: false },
  floatingUI: { name: '悬浮UI', required: false }
};

export const DEFAULT_LAYOUT = {
  viewport: { component: 'V3DCanvas', props: {} },
  rightPanel: { component: 'ControlPanel', props: {} }
};
