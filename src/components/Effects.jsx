/**
 * Effects — @react-three/postprocessing 后处理特效
 *
 * Outline 从 store 读取参数，映射到真实 OutlineEffect API：
 *   edgeThickness → resolutionScale（反比）+ edgeStrength（正比，已合并描边强度）
 *   edgeGlow       → kernelSize + blur（越大=核越大=发光越散）
 *   pulsePeriod    → pulseSpeed（周期秒→速度 Hz）
 *
 * OutlineEffect 真实参数（无 edgeThickness/edgeGlow）：
 *   blendFunction, patternTexture, patternScale, edgeStrength,
 *   pulseSpeed, visibleEdgeColor, hiddenEdgeColor, kernelSize,
 *   blur, xRay, multisampling, resolutionScale
 */
import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import {
  EffectComposer,
  Outline,
  Bloom,
} from '@react-three/postprocessing';
import useStore from '../store/useStore';
import { BlendFunction, KernelSize } from 'postprocessing';

/** edgeThickness(1-20) → resolutionScale(1.0-0.2) 反比映射 */
function thicknessToResScale(t) {
  const v = Math.max(1, Math.min(20, t ?? 13));
  return +(1.0 - (v - 1) / 19 * 0.8).toFixed(3);
}

/** edgeThickness(1-20) → edgeStrength(1-10) 线性映射（粗细决定强度） */
function thicknessToStrength(t) {
  const v = Math.max(1, Math.min(20, t ?? 13));
  return +(1 + (v - 1) * 9 / 19).toFixed(1);
}

/** edgeGlow(0-5) → { kernelSize, blur } */
function glowToKernel(g) {
  const v = Math.max(0, Math.min(5, g ?? 2));
  if (v <= 0.3) return { kernelSize: KernelSize.VERY_SMALL, blur: false };
  if (v <= 1.2) return { kernelSize: KernelSize.SMALL, blur: true };
  if (v <= 2.2) return { kernelSize: KernelSize.MEDIUM, blur: true };
  if (v <= 3.5) return { kernelSize: KernelSize.LARGE, blur: true };
  return { kernelSize: KernelSize.HUGE, blur: true };
}

/** pulsePeriod(秒) → pulseSpeed */
function periodToSpeed(p) {
  if (!p || p <= 0) return 0;
  return +(0.6283 / p).toFixed(4); // 2π/10 ≈ 0.6283
}

export default function Effects() {
  const outline = useStore((s) => s.outline);
  const lightOn = useStore((s) => s.lightOn);
  const selectedObjectName = useStore((s) => s.selectedObject);
  const scene = useThree((s) => s.scene);

  const selection = useMemo(() => {
    if (!selectedObjectName) return undefined;
    const obj = scene?.getObjectByName(selectedObjectName);
    return obj ? [obj] : undefined;
  }, [selectedObjectName, scene]);

  const resScale = thicknessToResScale(outline.edgeThickness);
  const edgeStrength = thicknessToStrength(outline.edgeThickness);
  const { kernelSize, blur } = glowToKernel(outline.edgeGlow);
  const pulseSpeed = periodToSpeed(outline.pulsePeriod);

  return (
    <EffectComposer autoClear={false} multisampling={4} resolutionScale={1}>
      {outline.enabled !== false && (
        <Outline
          selection={selection}
          selectionLayer={10}
          edgeStrength={edgeStrength}
          pulseSpeed={pulseSpeed}
          visibleEdgeColor={outline.visibleEdgeColor || '#ffffff'}
          hiddenEdgeColor={outline.visibleEdgeColor || '#ffffff'}
          blendFunction={BlendFunction.SCREEN}
          blur={blur}
          kernelSize={kernelSize}
          multisampling={4}
          resolutionScale={resScale}
        />
      )}
      <Bloom
        intensity={lightOn ? 0.45 : 0}
        luminanceThreshold={lightOn ? 0.95 : 0.999}
        luminanceSmoothing={0.95}
        mipmapBlur
      />
    </EffectComposer>
  );
}
