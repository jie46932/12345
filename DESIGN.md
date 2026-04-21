# DESIGN.md — HE FURNITURE 智能升降桌 3D 配置器

> **用途**：Google Stitch AI 设计系统源文件。本文件定义项目的颜色 Token、字体排版、间距比例、组件规格与交互状态，供 Stitch 生成高保真 UI 时直接引用。

---

## 1. Product Overview（产品概述）

**产品名称**：HE FURNITURE 智能升降桌 3D 配置器  
**产品类型**：B2B + B2C 电商配置器（嵌入官网 / 展会演示）  
**视觉基调**：暗色豪华 × Neumorphism × 毛玻璃  
**核心体验**：采用无滚动界面所有交互均通过按钮驱动的面板和上下文叠加层进行 用户通过 3D 实时渲染直观配置桌面高度（68–120cm）、材质（3种）、配件，所见即所买  
**参考竞品**：Oakywood 配置器（木质家具 3D 选配）

---

## 2. Color Tokens（颜色 Token）

### 2.1 基础色板

| Token 名称 | 色值 | 用途 |
|-----------|------|------|
| `--color-panel-base` | `#ccd0d4` | 控制面板 Neumorphism 基底色 |
| `--color-panel-glass` | `rgba(204, 208, 212, 0.36)` | 毛玻璃背景（控制栏 / 顶栏） |
| `--color-highlight` | `rgba(255, 255, 255, 0.8)` | Neumorphism 凸起高光 |
| `--color-shadow-dark` | `rgba(0, 0, 0, 0.4)` | Neumorphism 凹陷阴影 |
| `--color-border` | `rgba(255, 255, 255, 0.45)` | 毛玻璃边框描边 |
| `--color-inset-top` | `rgba(255, 255, 255, 0.6)` | 玻璃面板顶部内发光 |
| `--color-bg-shadow` | `rgba(0, 0, 0, 0.12)` | 面板整体投影 |

### 2.2 文字颜色

| Token 名称 | 色值 | 用途 |
|-----------|------|------|
| `--color-text-primary` | `rgba(0, 0, 0, 0.72)` | 主要文字（标签、数值） |
| `--color-text-secondary` | `rgba(0, 0, 0, 0.55)` | 辅助文字（单位、说明） |
| `--color-text-tertiary` | `rgba(0, 0, 0, 0.38)` | 禁用 / 占位文字 |
| `--color-text-active` | `rgba(0, 0, 0, 0.85)` | 激活状态文字 |

### 2.3 材质色板（桌面选色）

| Token 名称 | 色值 | 材质 ID | 溢价 |
|-----------|------|---------|------|
| `--material-light` | `#e8d5b0`（浅橡木参考色） | `Wood03_PBR` | ¥0 |
| `--material-oak` | `#c8a878`（中橡木参考色） | `Wood06_PBR` | +¥200 |
| `--material-dark` | `#5c3d2e`（深胡桃参考色） | `Wood07_PBR` | +¥500 |

### 2.4 功能色

| Token 名称 | 色值 | 用途 |
|-----------|------|------|
| `--color-active-ring` | `rgba(0, 0, 0, 0.25)` | 选中按钮光圈（内嵌） |
| `--color-price-gold` | 金属渐变（见字体规范） | 价格数字 Orbitron |
| `--color-danger` | `#d32f2f` | 错误 / 危险操作 |
| `--color-success` | `#388e3c` | 成功反馈 |

---

## 3. Typography（字体排版）

### 3.1 字体家族

```css
--font-brand:   'Orbitron', 'Rajdhani', sans-serif;   /* 品牌名 / 数字 */
--font-ui:      'Rajdhani', 'Inter', sans-serif;       /* 所有 UI 文字 */
--font-fallback: system-ui, -apple-system, sans-serif;
```

> **Google Fonts 引入**：`Orbitron:wght@800` + `Rajdhani:wght@400;600`

### 3.2 字型比例

| 角色 Token | 字体 | 字重 | 字号 | 行高 | 字间距 | 用途 |
|-----------|------|------|------|------|--------|------|
| `--type-brand` | Orbitron | 800 | 44px | 1.0 | 0.08em | 品牌名 HE FURNITURE |
| `--type-subtitle` | Rajdhani | 600 | 21.6px | 1.0 | 0.25em | 副标题 智能升降桌 |
| `--type-price` | Orbitron | 800 | 44px | 1.0 | 0 | 总价数字 |
| `--type-price-unit` | Rajdhani | 400 | 18px | 1.0 | 0 | 价格单位 ¥ / cm |
| `--type-label` | Rajdhani | 600 | 14px | 1.2 | 0.05em | 按钮标签 / 分组标题 |
| `--type-caption` | Rajdhani | 400 | 13px | 1.4 | 0 | 辅助说明文字 |
| `--type-badge` | Rajdhani | 600 | 12px | 1.0 | 0.03em | 价差标签（+¥200） |

### 3.3 品牌字特效

品牌名使用**金属拉丝渐变 + 3D 厚度阴影**：

```css
/* 拉丝钢正面渐变 */
background: linear-gradient(
  175deg,
  #ffffff 0%, #ffffff 8%, #f2f2f2 18%,
  #cacaca 30%, #f9f9f9 42%, #dedede 54%,
  #b8b8b8 68%, #ebebeb 80%, #a3a3a3 100%
);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;

/* 3D 厚度（斜切面感） */
filter:
  drop-shadow(-1px -1px 0 rgba(255,255,255,0.9))
  drop-shadow(1px 1px 0 #2a2a2a)
  drop-shadow(2px 2px 0 #1e1e1e)
  drop-shadow(3px 3px 0 #181818);
```

---

## 4. Spacing Scale（间距比例）

基于 **8pt 网格**，单位 px：

| Token | 值 | 用途 |
|-------|----|------|
| `--space-1` | 4px | 图标内边距 |
| `--space-2` | 8px | 按钮间距 / 组件间距 |
| `--space-3` | 12px | 按钮组内间距 |
| `--space-4` | 16px | 卡片内边距 |
| `--space-5` | 24px | 页面边距（顶/左/右） |
| `--space-6` | 32px | 分组间距 |
| `--space-8` | 40px | 大间距（区块分割） |

### 4.1 圆角

| Token | 值 | 用途 |
|-------|----|------|
| `--radius-btn` | 20px | 按钮 / 控制栏圆角 |
| `--radius-modal` | 20px | 弹窗圆角 |
| `--radius-swatch` | 50% | 材质色板（圆形） |
| `--radius-tag` | 8px | 价差标签圆角 |

---

## 5. Effects（效果系统）

### 5.1 毛玻璃背景（Glass Panel）

```css
background: rgba(204, 208, 212, 0.36);
backdrop-filter: blur(18px) saturate(1.4);
-webkit-backdrop-filter: blur(18px) saturate(1.4);
border: 1px solid rgba(255, 255, 255, 0.45);
box-shadow:
  inset 0 1px 0 rgba(255, 255, 255, 0.6),
  0 4px 24px rgba(0, 0, 0, 0.12);
border-radius: var(--radius-btn);
```

### 5.2 Neumorphism 按钮（凸起状态）

```css
/* 凸起圆形（默认） */
box-shadow:
  4px 4px 10px rgba(0, 0, 0, 0.3),
  -3px -3px 8px rgba(255, 255, 255, 0.7);
background: #ccd0d4;
filter: blur(1px);  /* 柔化边缘 */
```

```css
/* 凹陷（激活 / 选中状态） */
box-shadow:
  inset 3px 3px 8px rgba(0, 0, 0, 0.3),
  inset -2px -2px 6px rgba(255, 255, 255, 0.7);
background: #c0c4c8;
```

### 5.3 阴影层级

| 层级 | box-shadow | 用途 |
|------|-----------|------|
| L1（面板） | `0 4px 24px rgba(0,0,0,0.12)` | 控制栏整体浮起 |
| L2（弹窗） | `0 8px 40px rgba(0,0,0,0.2)` | CartModal / GalleryModal |
| L3（激活按钮） | inset 凹陷（见上） | 按钮按压反馈 |

---

## 6. Components（组件规格）

### 6.1 Layout（页面布局）

```
┌──────────────────────────────────────────────┐
│  Header（fixed top-0，透明背景，高240px）      │
│  左：HE FURNITURE 品牌字 + 智能升降桌副标题    │
│  右：导航按钮组（hover展开灯光/语言，全屏常显）│
├──────────────────────────────────────────────┤
│                                              │
│          3D Viewport（全屏 WebGL Canvas）     │
│          v3d-container + reflection canvas   │
│                                              │
│  左下角：ViewSlider 视角圆盘（fixed）         │
│  叠加层：DimensionAnnotation SVG 尺寸标注    │
│                                              │
├──────────────────────────────────────────────┤
│  ControlBar（fixed bottom，毛玻璃，fit-width） │
│  左组：↑↓高度 | 📐标注 | 分享（AR/QR/画廊）   │
│  右组：材质色板 | 配件 | 🛒购物车 + 价格      │
└──────────────────────────────────────────────┘
```

### 6.2 Header 组件

| 属性 | 值 |
|------|-----|
| 位置 | `fixed top-0 left-0 right-0 z-50` |
| 高度 | 240px（内容在顶部，其余透明） |
| 背景 | 完全透明 |
| 左侧内容 | 品牌名（44px Orbitron 800 金属渐变） + 副标题（21.6px Rajdhani 600） |
| 右侧内容 | 毛玻璃按钮组（灯光开关 + 语言切换 + 全屏），hover 展开前两个 |
| 品牌字动画 | 16s 循环逐字弹出（letterUp keyframes），带金属光扫过效果 |

### 6.3 ControlBar 底部控制栏

| 属性 | 值 |
|------|-----|
| 位置 | `fixed bottom-0`，水平居中，`width: fit-content` |
| 背景 | 毛玻璃（Glass Panel 规格） |
| 圆角 | 20px（顶部两角） |
| 内边距 | 8px 12px |
| 内容排列 | 两组（左 / 右），`gap: 8–12px` |
| 展开方式 | `grid-template-columns: 0fr → 1fr`，400ms cubic-bezier(0.23,1,0.32,1) |
| 价格显示 | Orbitron 800 44px，右侧常驻显示 |

**NeuBtn 按钮结构**（三层）：
```
.nb-outer（凹槽底座，transparent，67×67px 触控区）
  └── .nb-circle（凸起圆形，46px，blur(1px) + inset shadow）
  └── .nb-icon（SVG 图标，absolute 叠加，不受 blur 影响）
  └── .nb-label（文字标签，7px below circle）
```

| 尺寸属性 | 值 |
|---------|-----|
| 触控区（nb-outer） | 67×67px |
| 凸起圆形（nb-circle） | 约 46px（size × 0.68） |
| 图标（SVG） | 30×30px（cart: 32×32px） |
| 标签字号 | 13px Rajdhani 600 |
| 最小触控满足 | ✅ 67px ≥ 44px（Apple HIG） |

**按钮交互状态**：

| 状态 | 变化 |
|------|------|
| 默认 | 凸起 box-shadow |
| hover | `transform: translateY(-1px)` + 加深凸起 |
| active / 按压 | 凹陷 box-shadow + `transform: translateY(1px)` |
| 选中（active） | 凹陷持续 + 可选高亮标签 |
| 过渡时长 | 300ms `cubic-bezier(0.23, 1, 0.32, 1)` |

### 6.4 材质色板（Material Swatch）

```
○ 圆形色板（46×46px）
├── 圆角：50%（完整圆形）
├── 默认：Neumorphism 凸起
├── 选中：凹陷 + 内环描边 2px rgba(0,0,0,0.4)
└── 待升级：纯色 → 木纹纹理图（P0 任务）
```

### 6.5 ViewSlider 视角圆盘

```
圆形导航盘（固定左下角，scale: 0.637）
├── 5 个方向按钮：前 / 后 / 左 / 右 / 俯视
├── 按钮形态：Neumorphism NeuBtn
├── 激活状态：凹陷（当前视角高亮）
└── 切换动画：相机 tween 0.6s（Verge3D 内置）
```

### 6.6 DimensionAnnotation SVG 标注

```
SVG overlay（full-viewport，pointer-events:none）
├── 3 条尺寸线：桌宽 / 桌深 / 当前桌高
├── 实时投影：每帧 v.project(camera) → NDC → 屏幕坐标
├── 显隐控制：showAnnotations state（标注按钮切换）
├── 背面检测：ndc.z > 1 时 opacity: 0
└── 边界 clamp：Math.max(MARGIN, Math.min(w-MARGIN, x))
```

### 6.7 LoadingScreen 加载屏

```
全屏覆盖层（fixed, z-index: 9999）
├── 背景：深色（待设计产品背景图 1920×1080）
├── Spinner：Neumorphism 圆形旋转 + 进度数字
├── 最短展示：2.5s
├── 控制方式：CSS class ls-show/ls-hide（非条件渲染）
└── 品牌字：与 Header 同款 Orbitron 金属效果
```

### 6.8 CartModal 购物车弹窗

```
弹窗（fixed，居中，宽 420px，z: 200）
├── 背景：Glass Panel（毛玻璃）
├── 圆角：20px
├── 内容：材质选择 + 配件清单 + 价格明细
├── 基础价：¥899
├── 配件加价：显示架 +¥89 / 水杯架 +¥0 / 挂钩 +¥0
├── 总价：Orbitron 800 44px
└── 待优化：「加入购物车」按钮 alert() → Toast 通知
```

### 6.9 GalleryModal 画廊弹窗

```
全屏弹窗（Apple Carousel 风格）
├── 背景：半透明深色 overlay
├── 图片：产品场景渲染图（横向滑动）
├── 导航：左右箭头 NeuBtn
└── 关闭：右上角 × 按钮
```

---

## 7. Animation Tokens（动效 Token）

| Token | 值 | 用途 |
|-------|----|------|
| `--duration-micro` | 150ms | 图标缩放、颜色变化 |
| `--duration-btn` | 300ms | 按钮状态变换（box-shadow / transform） |
| `--duration-expand` | 400ms | 展开区 grid-template-columns |
| `--duration-camera` | 600ms | 视角切换 tween |
| `--duration-brand` | 16s 循环 | 品牌字逐字弹出 |
| `--easing-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | 弹出类动画（主要） |
| `--easing-standard` | `ease` | opacity 渐变 |

**高度动画规格**：
- 预设切换：`playToFrame(targetCm)`，速度 1.5 t/s，约 667ms 全程
- 连续箭头：`renderCallback` 驱动，速度 0.3 t/s，切换模式（再点停止）
- 3 档映射：68cm = t:0，94cm = t:0.5，120cm = t:1

---

## 8. Interaction Patterns（交互模式）

### 8.1 展开式按钮组（Hover Expand）

```
触发：mouseEnter → 展开，mouseLeave → 150ms 延迟后折叠
动画：grid-template-columns: 0fr → 1fr，400ms ease-out
方向：水平展开（向左）
适用组件：Header 导航栏、高度控制展开区、材质展开区、分享展开区、配件展开区
```

### 8.2 高度控制（切换模式箭头）

```
第一次点击：启动连续移动（up / down）
再次点击同方向：停止移动
点击另一方向：切换方向继续移动
预设按钮：点击直接 playToFrame 至目标档位
```

### 8.3 材质选择

```
点击材质色板 → 3D 场景 PBR 材质实时更新（Rectangle005 / Rectangle006）
选中视觉：凹陷 Neumorphism + 边框描边
价格联动：ControlBar 右侧价格即时更新
```

### 8.4 配件切换

```
初始状态：全部隐藏（onSceneReady 统一执行，对齐 React state）
点击配件按钮：toggle 3D 对象 visible 属性
对象映射：水杯架→对象010，挂钩→对象011，台灯→组007
价格联动：仅显示架 +¥89 计入总价
```

---

## 9. Responsive（响应式规格）

| 断点 | --ui-scale | 说明 |
|------|-----------|------|
| ≥ 1440px | 1.0 | 标准桌面 |
| 1024–1439px | 0.75 | 小屏桌面 |
| 768–1023px | 0.637 | 平板 |
| < 768px | 0.5 | 移动端（基础支持） |

```css
--ui-scale: 1;  /* 由 JS applyUIScale() 动态设置 */
/* 所有 NeuBtn 尺寸通过 --ui-scale 缩放 */
/* 最小触控保证：67px × 0.637 ≈ 42px（临界值，需验证） */
```

---

## 10. Google Stitch Prompts（生成提示词）

以下是推荐给 Google Stitch 的**分屏提示词**，用于逐步生成各界面区域：

### Prompt 1 — 整体布局

```
A dark luxury 3D product configurator web app for a smart height-adjustable desk brand "HE FURNITURE".
Full-screen WebGL 3D viewport as background. Transparent header top-left with metallic gradient brand name.
Bottom-center frosted glass control bar (neumorphism style). No solid background color — 3D canvas fills the frame.
Dark aesthetic, high-tech feel, premium furniture brand.
```

### Prompt 2 — 顶部 Header

```
Top-left brand header: "HE FURNITURE" in Orbitron 800 44px with brushed steel metallic gradient text effect and 3D drop-shadow depth.
Below it: "智能升降桌" subtitle in Rajdhani 600 21.6px same metallic style.
Top-right: frosted glass pill button group (blur 18px, white border 0.45 opacity), containing fullscreen icon button always visible, hover to reveal lighting toggle and language switch.
Background fully transparent.
```

### Prompt 3 — 底部控制栏

```
Bottom control bar: frosted glass panel (rgba 204,208,212 at 36% opacity, blur 18px, white border), centered horizontally, fit-content width, 20px border-radius top corners.
Left section: height up/down neumorphic circle buttons, annotation toggle, share group (AR/QR/Gallery expand on hover).
Right section: 3 material color swatches (circle, 46px, wood tones — light oak, medium oak, dark walnut), accessories toggle group, cart button.
Far right: large price display "¥899" in Orbitron 800 44px.
All buttons: neumorphism convex circles on transparent concave base, 67×67px touch area, 30px SVG icons.
```

### Prompt 4 — 购物车弹窗

```
Shopping cart modal: frosted glass panel 420px wide, centered, 20px radius, blur backdrop.
Header: "配置清单" title with close X button.
Content rows: material selection (3 wood swatches with name and price delta), accessories list (monitor stand +¥89, cup holder free, hook free).
Footer: total price "¥899" in Orbitron 44px gold gradient, "加入购物车" primary CTA button full width.
Neumorphism style throughout.
```

### Prompt 5 — 加载屏

```
Full-screen loading overlay for 3D product configurator.
Dark background with product hero image. Center: neumorphism spinner circle with rotating arc animation.
Below spinner: progress percentage in Orbitron 800 font.
Brand name "HE FURNITURE" metallic text at top. Smooth fade-out transition when 3D scene is ready.
```

---

## 11. Feature Status（功能状态）

| 功能 | 状态 | 设计优先级 |
|------|------|-----------|
| 桌面材质切换（3色） | ✅ 已实现 | — |
| 桌高预设切换（68/94/120cm） | ✅ 已实现 | — |
| 桌高连续箭头调节 | ✅ 已实现 | — |
| 配件开关（水杯/挂钩/台灯） | ✅ 已实现 | — |
| 视角切换（5方向） | ✅ 已实现 | — |
| SVG 实时尺寸标注 | ✅ 已实现 | — |
| 分享 QR 码 | ✅ 已实现 | — |
| 购物车价格明细 | ✅ 已实现 | — |
| 中/英双语切换 | ✅ 已实现 | — |
| 全屏切换 | ✅ 已实现 | — |
| **材质色板升级为木纹纹理图** | ❌ 待实现 | **P0** |
| **主界面价格常驻显示验证** | ⚠️ 待验证 | **P0** |
| **自动演示模式** | ❌ 待实现 | P1 |
| **AR 预览** | ⚠️ UI 有，功能无 | P1 |
| **加载屏背景产品图** | ❌ 待设计 | P1 |
| `prefers-reduced-motion` 支持 | ❌ 未实现 | P1 |
| 购物车 alert() → Toast | ❌ 未实现 | P1 |

---

## 12. Accessibility（无障碍规格）

| 规则 | 要求 | 当前状态 |
|------|------|---------|
| 触控目标尺寸 | ≥ 44×44px | ✅ nb-outer 67×67px |
| 触控间距 | ≥ 8px | ✅ gap: 8–12px |
| 图标按钮 aria-label | title 属性 | ✅ 所有 NeuBtn 有 title |
| 颜色对比度 | ≥ 4.5:1 | ⚠️ 毛玻璃下需验证 |
| 焦点环 | 可见焦点指示器 | ⚠️ 已移除，需补 keyboard nav |
| 动效偏好 | prefers-reduced-motion | ❌ 未实现 |
| 加载反馈 | >300ms 有进度提示 | ✅ 全屏加载屏 + 进度 |

---

## 13. File Structure Reference（文件结构参考）

```
F:\verge3d app manager\12345\
├── DESIGN.md                   ← 本文件（Google Stitch 设计系统）
├── src/
│   ├── App.jsx                 # 主容器，状态管理
│   ├── components/
│   │   ├── Header.jsx          # 品牌字 + 右上角按钮组
│   │   ├── ControlBar.jsx      # 底部控制栏（主 UI）
│   │   ├── LoadingScreen.jsx   # 加载屏
│   │   ├── DimensionAnnotation.jsx  # SVG 尺寸标注
│   │   ├── ViewSlider.jsx      # 视角圆盘
│   │   ├── GalleryModal.jsx    # 画廊弹窗
│   │   └── CartModal.jsx       # 购物车弹窗
│   └── LangContext.js          # zh/en 国际化
├── 12345.gltf / .bin           # 3D 模型
└── vercel.json                 # 部署配置
```

---

*DESIGN.md v1.0 | 生成日期：2026-04-16 | 项目：HE FURNITURE 智能升降桌 3D 配置器*  
*适用工具：Google Stitch AI（stitch.withgoogle.com）*
