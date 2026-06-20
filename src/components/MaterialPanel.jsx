/**
 * MaterialPanel — 场景材质实时调控面板
 *
 * 从 Three.js scene 遍历所有 MeshStandardMaterial，
 * 提供粗糙度/金属度/颜色/透明度等参数的实时调节。
 * 仅通过 ?devPanels=1 显示。
 *
 * DEFAULTS — 由 /api/write-material-defaults 写入，
 * SceneContent 加载后应用覆盖。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import useStore from '../store/useStore';
import DEFAULTS from '../data/materialDefaults';

const ACCENT = '#f59e0b'; // amber, different from other panels

const S = {
  label: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 11, color: '#9aa', marginBottom: 2,
  },
  slider: { width: '100%', accentColor: ACCENT, cursor: 'pointer' },
  row: { marginBottom: 8 },
  val: { color: ACCENT, fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right', fontSize: 10 },
  matHeader: {
    color: '#ddd', fontSize: 11, fontWeight: 600, marginBottom: 4,
    paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', justifyContent: 'space-between',
  },
  swatch: {
    width: 14, height: 14, borderRadius: 3, border: '1px solid rgba(255,255,255,0.2)',
    flexShrink: 0,
  },
};

/** 收集场景中所有独立 MeshStandardMaterial */
function collectMaterials(scene) {
  if (!scene) return [];
  const map = new Map();
  scene.traverse((obj) => {
    if (!obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => {
      if (!mat || !mat.isMeshStandardMaterial) return;
      if (map.has(mat.uuid)) return;
      // 收集使用该材质的对象名
      map.set(mat.uuid, { material: mat, objects: [obj.name || '?'] });
    });
  });
  // 补全 objects 列表
  scene.traverse((obj) => {
    if (!obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => {
      if (!mat || !mat.isMeshStandardMaterial) return;
      const entry = map.get(mat.uuid);
      if (entry && !entry.objects.includes(obj.name || '?')) {
        entry.objects.push(obj.name || '?');
      }
    });
  });
  return Array.from(map.values());
}

/** 材质分组：同名材质合并显示 */
function groupByName(entries) {
  const groups = new Map();
  entries.forEach(({ material, objects }) => {
    const name = material.name || '(unnamed)';
    if (!groups.has(name)) {
      groups.set(name, { material, objects: [] });
    }
    const g = groups.get(name);
    objects.forEach((o) => { if (!g.objects.includes(o)) g.objects.push(o); });
  });
  return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

export default function MaterialPanel() {
  const [open, setOpen] = useState(false);
  const [expandedMats, setExpandedMats] = useState(new Set());
  const materialsRef = useRef([]); // grouped materials
  const originalsRef = useRef({}); // uuid → { roughness, metalness, color, opacity, emissive, emissiveIntensity }
  const [version, setVersion] = useState(0);
  const posRef = useRef({ x: 420, y: 380 });
  const [pos, setPos] = useState({ x: 420, y: 380 });
  const threeScene = useStore((s) => s.threeScene);
  const sceneReady = useStore((s) => s.sceneReady);
  const lightOn = useStore((s) => s.lightOn);

  // ── Env 状态 ────────────────────────────────────────────────
  const [envIntensity, setEnvIntensity] = useState(1.0);
  const [envRotX, setEnvRotX] = useState(0);    // 水平旋转 (度)
  const [envRotY, setEnvRotY] = useState(0);    // 纵向旋转 (度)

  // 从 __envCtrl 读取初始值
  useEffect(() => {
    if (!sceneReady) return;
    const ctrl = window.__envCtrl;
    if (ctrl) {
      setEnvIntensity(ctrl.intensity ?? 1.0);
      setEnvRotX((ctrl.rotationX ?? 0) * (180 / Math.PI));
      setEnvRotY((ctrl.rotationY ?? 0) * (180 / Math.PI));
    }
  }, [sceneReady]);

  // 扫描材质
  const scanMaterials = useCallback(() => {
    // 优先从 store，fallback 到 window 全局
    const scene = threeScene || window.__threeScene;
    if (!scene) return;
    const entries = collectMaterials(scene);
    const grouped = groupByName(entries);
    materialsRef.current = grouped;

    // 保存原始值（仅首次）
    grouped.forEach(([, { material }]) => {
      if (!originalsRef.current[material.uuid]) {
        originalsRef.current[material.uuid] = {
          roughness: material.roughness,
          metalness: material.metalness,
          color: '#' + material.color.getHexString(),
          opacity: material.opacity,
          emissive: '#' + material.emissive.getHexString(),
          emissiveIntensity: material.emissiveIntensity,
        };
      }
    });
    setVersion((v) => v + 1);
  }, [threeScene]);

  useEffect(() => {
    if (sceneReady) scanMaterials();
  }, [sceneReady, scanMaterials]);

  // 定期轮询（场景可能动态变化）
  useEffect(() => {
    if (!sceneReady || !open) return;
    const timer = setInterval(scanMaterials, 2000);
    return () => clearInterval(timer);
  }, [sceneReady, open, scanMaterials]);

  const toggleExpand = (name) => {
    setExpandedMats((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const resetMaterial = (material) => {
    const orig = originalsRef.current[material.uuid];
    if (!orig) return;
    material.roughness = orig.roughness;
    material.metalness = orig.metalness;
    material.color.set(orig.color);
    material.opacity = orig.opacity;
    material.emissive.set(orig.emissive);
    material.emissiveIntensity = orig.emissiveIntensity;
    material.needsUpdate = true;
    setVersion((v) => v + 1);
  };

  const resetAll = () => {
    materialsRef.current.forEach(([, { material }]) => resetMaterial(material));
  };

  // 拖拽
  const onMouseDown = (e) => {
    e.stopPropagation();
    const sx = e.clientX - posRef.current.x;
    const sy = e.clientY - posRef.current.y;
    const onMove = (ev) => {
      posRef.current = { x: ev.clientX - sx, y: ev.clientY - sy };
      setPos({ ...posRef.current });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const groups = open ? materialsRef.current : [];

  return (
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y, zIndex: 9990,
      background: 'rgba(10,12,20,0.95)', border: `1px solid ${ACCENT}44`,
      borderRadius: 10, backdropFilter: 'blur(14px)',
      boxShadow: `0 4px 28px rgba(0,0,0,0.7), 0 0 12px ${ACCENT}22`,
      minWidth: 280, maxWidth: 340, maxHeight: '80vh',
      userSelect: 'none', fontFamily: 'monospace',
      transform: 'scale(var(--ui-scale, 1))',
      transformOrigin: 'top left',
      display: 'flex', flexDirection: 'column',
    }} data-version={version}>
      {/* 标题栏 */}
      <div
        onMouseDown={onMouseDown}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '9px 14px', cursor: 'grab', flexShrink: 0,
          borderBottom: open ? `1px solid ${ACCENT}28` : 'none',
          color: ACCENT, fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
        }}
      >
        <span>◈ MATERIALS ({groups.length})</span>
        <span style={{ fontSize: 10, opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <>
          {/* 刷新 + 全部重置 */}
          <div style={{
            display: 'flex', gap: 6, padding: '8px 14px',
            borderBottom: `1px solid ${ACCENT}18`, flexShrink: 0,
          }}>
            <button onClick={scanMaterials} style={{
              flex: 1, padding: '4px 0', fontSize: 9,
              background: `${ACCENT}18`, border: `1px solid ${ACCENT}44`,
              borderRadius: 4, color: ACCENT, cursor: 'pointer',
              fontFamily: 'monospace', letterSpacing: 1,
            }}>↻ SCAN</button>
            <button onClick={resetAll} style={{
              flex: 1, padding: '4px 0', fontSize: 9,
              background: '#ff444418', border: '1px solid #ff444444',
              borderRadius: 4, color: '#ff6666', cursor: 'pointer',
              fontFamily: 'monospace', letterSpacing: 1,
            }}>RESET ALL</button>
          </div>

          {/* ── 环境贴图 ──────────────────────────────────────── */}
          <div style={{
            margin: '4px 14px', padding: '8px 10px',
            background: 'rgba(100,200,255,0.06)',
            borderRadius: 6,
            border: '1px solid rgba(100,200,255,0.2)',
          }}>
            <div style={{ ...S.matHeader, color: '#8cf', marginBottom: 6, borderBottom: '1px solid rgba(100,200,255,0.15)' }}>
              <span>🌐 环境贴图 Environment</span>
            </div>
            {/* Env Intensity */}
            <div style={S.row}>
              <div style={S.label}>
                <span>强度 Intensity</span>
                <span style={{...S.val, color: '#8cf'}}>{envIntensity.toFixed(2)}</span>
              </div>
              <input type="range" min={0} max={3} step={0.01}
                value={envIntensity}
                onChange={(e) => {
                  const v = +e.target.value;
                  setEnvIntensity(v);
                  const ctrl = window.__envCtrl;
                  if (ctrl) { ctrl.intensity = v; ctrl.updateIntensity(); }
                }}
                style={{ ...S.slider, accentColor: '#8cf' }} />
            </div>
            {/* 水平旋转 */}
            <div style={S.row}>
              <div style={S.label}>
                <span>水平旋转 H-Rot</span>
                <span style={{...S.val, color: '#8cf'}}>{envRotX.toFixed(0)}°</span>
              </div>
              <input type="range" min={0} max={360} step={1}
                value={envRotX}
                onChange={(e) => {
                  const deg = +e.target.value;
                  setEnvRotX(deg);
                  const ctrl = window.__envCtrl;
                  if (ctrl) {
                    ctrl.rotationX = deg * (Math.PI / 180);
                    ctrl.update();
                  }
                }}
                style={{ ...S.slider, accentColor: '#8cf' }} />
            </div>
            {/* 纵向旋转 */}
            <div style={S.row}>
              <div style={S.label}>
                <span>纵向旋转 V-Rot</span>
                <span style={{...S.val, color: '#8cf'}}>{envRotY.toFixed(0)}°</span>
              </div>
              <input type="range" min={-90} max={90} step={1}
                value={envRotY}
                onChange={(e) => {
                  const deg = +e.target.value;
                  setEnvRotY(deg);
                  const ctrl = window.__envCtrl;
                  if (ctrl) {
                    ctrl.rotationY = deg * (Math.PI / 180);
                    ctrl.update();
                  }
                }}
                style={{ ...S.slider, accentColor: '#8cf' }} />
            </div>
          </div>

          {/* 材质列表 */}
          <div style={{
            overflowY: 'auto', overflowX: 'hidden',
            padding: '8px 14px', flexShrink: 1,
            minHeight: 0,
          }}>
            {groups.length === 0 && (
              <div style={{ color: '#555', fontSize: 10, textAlign: 'center', padding: 20 }}>
                No materials found. Click SCAN to detect.
              </div>
            )}
            {groups.map(([name, { material, objects }]) => {
              const isExpanded = expandedMats.has(name);
              const orig = originalsRef.current[material.uuid];
              const isDirty = orig && (
                material.roughness !== orig.roughness ||
                material.metalness !== orig.metalness ||
                '#' + material.color.getHexString() !== orig.color ||
                material.opacity !== orig.opacity
              );

              return (
                <div key={name} style={{
                  marginBottom: 6, padding: '6px 8px',
                  background: isExpanded ? 'rgba(255,255,255,0.04)' : 'transparent',
                  borderRadius: 6,
                  border: isDirty ? `1px solid ${ACCENT}44` : '1px solid transparent',
                }}>
                  {/* 材质名称行 */}
                  <div
                    onClick={() => toggleExpand(name)}
                    style={{
                      ...S.matHeader, cursor: 'pointer',
                      color: isDirty ? ACCENT : '#ddd',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, overflow: 'hidden' }}>
                      <div style={{
                        ...S.swatch,
                        background: '#' + material.color.getHexString(),
                      }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {name}
                        {isDirty ? ' *' : ''}
                      </span>
                    </div>
                    <span style={{ fontSize: 9, color: '#666', flexShrink: 0 }}>
                      {objects.length} obj{isExpanded ? ' ▲' : ' ▼'}
                    </span>
                  </div>

                  {/* 展开后的控制 */}
                  {isExpanded && (
                    <div style={{ marginTop: 6 }}>
                      {/* Roughness */}
                      <div style={S.row}>
                        <div style={S.label}>
                          <span>粗糙度 Roughness</span>
                          <span style={S.val}>{material.roughness.toFixed(3)}</span>
                        </div>
                        <input type="range" min={0} max={1} step={0.001}
                          value={material.roughness}
                          onChange={(e) => {
                            material.roughness = +e.target.value;
                            material.needsUpdate = true;
                            setVersion((v) => v + 1);
                          }}
                          style={S.slider} />
                      </div>

                      {/* Metalness */}
                      <div style={S.row}>
                        <div style={S.label}>
                          <span>金属度 Metalness</span>
                          <span style={S.val}>{material.metalness.toFixed(3)}</span>
                        </div>
                        <input type="range" min={0} max={1} step={0.001}
                          value={material.metalness}
                          onChange={(e) => {
                            material.metalness = +e.target.value;
                            material.needsUpdate = true;
                            setVersion((v) => v + 1);
                          }}
                          style={S.slider} />
                      </div>

                      {/* Base Color R/G/B */}
                      {['r', 'g', 'b'].map((ch) => (
                        <div style={S.row} key={ch}>
                          <div style={S.label}>
                            <span>颜色 Color.{ch.toUpperCase()}</span>
                            <span style={S.val}>
                              {material.color[ch].toFixed(3)}
                            </span>
                          </div>
                          <input type="range" min={0} max={1} step={0.001}
                            value={material.color[ch]}
                            onChange={(e) => {
                              material.color[ch] = +e.target.value;
                              material.needsUpdate = true;
                              setVersion((v) => v + 1);
                            }}
                            style={S.slider} />
                        </div>
                      ))}

                      {/* Emissive Intensity */}
                      <div style={S.row}>
                        <div style={S.label}>
                          <span>自发光强度 Emissive</span>
                          <span style={S.val}>{material.emissiveIntensity.toFixed(3)}</span>
                        </div>
                        <input type="range" min={0} max={5} step={0.01}
                          value={material.emissiveIntensity}
                          onChange={(e) => {
                            material.emissiveIntensity = +e.target.value;
                            material.needsUpdate = true;
                            setVersion((v) => v + 1);
                          }}
                          style={S.slider} />
                      </div>

                      {/* Emissive Color */}
                      {['r', 'g', 'b'].map((ch) => (
                        <div style={S.row} key={'e' + ch}>
                          <div style={S.label}>
                            <span>自发光色 Emissive.{ch.toUpperCase()}</span>
                            <span style={S.val}>
                              {material.emissive[ch].toFixed(3)}
                            </span>
                          </div>
                          <input type="range" min={0} max={1} step={0.001}
                            value={material.emissive[ch]}
                            onChange={(e) => {
                              material.emissive[ch] = +e.target.value;
                              material.needsUpdate = true;
                              setVersion((v) => v + 1);
                            }}
                            style={S.slider} />
                        </div>
                      ))}

                      {/* Opacity */}
                      <div style={S.row}>
                        <div style={S.label}>
                          <span>透明度 Opacity</span>
                          <span style={S.val}>{material.opacity.toFixed(3)}</span>
                        </div>
                        <input type="range" min={0} max={1} step={0.001}
                          value={material.opacity}
                          onChange={(e) => {
                            material.opacity = +e.target.value;
                            material.transparent = material.opacity < 1;
                            material.needsUpdate = true;
                            setVersion((v) => v + 1);
                          }}
                          style={S.slider} />
                      </div>

                      {/* Material #186 灯光开关 */}
                      {name === 'Material #186' && (
                        <div style={{
                          marginTop: 8, padding: '6px 8px',
                          background: 'rgba(255,200,50,0.08)',
                          borderRadius: 4,
                          border: `1px solid ${lightOn ? '#f59e0b88' : 'rgba(255,255,255,0.1)'}`,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                          <span style={{ fontSize: 10, color: lightOn ? ACCENT : '#888' }}>
                            💡 灯光 {lightOn ? 'ON' : 'OFF'}
                          </span>
                          <button onClick={() => {
                            const api = useStore.getState().sceneAPI;
                            if (api) api.toggleLight(!lightOn);
                          }} style={{
                            padding: '3px 10px', fontSize: 9,
                            background: lightOn ? `${ACCENT}30` : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${lightOn ? ACCENT : '#555'}`,
                            borderRadius: 3,
                            color: lightOn ? ACCENT : '#888',
                            cursor: 'pointer', fontFamily: 'monospace',
                          }}>
                            {lightOn ? '关灯' : '开灯'}
                          </button>
                        </div>
                      )}

                      {/* 关联对象 */}
                      <div style={{ fontSize: 9, color: '#555', marginTop: 6, lineHeight: 1.4 }}>
                        Objects: {objects.slice(0, 6).join(', ')}
                        {objects.length > 6 ? ` +${objects.length - 6} more` : ''}
                      </div>

                      {/* 重置按钮 */}
                      {isDirty && (
                        <button onClick={() => resetMaterial(material)} style={{
                          marginTop: 6, width: '100%', padding: '3px 0', fontSize: 9,
                          background: '#ff444418', border: '1px solid #ff444444',
                          borderRadius: 4, color: '#ff6666', cursor: 'pointer',
                          fontFamily: 'monospace',
                        }}>RESET</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 写入代码按钮 */}
          <div style={{
            padding: '8px 14px', borderTop: `1px solid ${ACCENT}18`, flexShrink: 0,
          }}>
            <button
              onClick={async () => {
                // 收集所有当前材质值
                const overrides = { _env: {}, _lightOn: lightOn };
                // env 参数
                overrides._env = {
                  intensity: +envIntensity.toFixed(2),
                  rotationX: +envRotX.toFixed(0),
                  rotationY: +envRotY.toFixed(0),
                };
                materialsRef.current.forEach(([name, { material }]) => {
                  overrides[name] = {
                    roughness: +material.roughness.toFixed(4),
                    metalness: +material.metalness.toFixed(4),
                    color: '#' + material.color.getHexString(),
                    opacity: +material.opacity.toFixed(4),
                    emissive: '#' + material.emissive.getHexString(),
                    emissiveIntensity: +material.emissiveIntensity.toFixed(4),
                  };
                });
                try {
                  const res = await fetch('/api/write-material-defaults', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ overrides }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    alert('✅ 参数已写入 materialDefaults.js');
                  } else {
                    alert('❌ 写入失败: ' + data.message);
                  }
                } catch (e) {
                  alert('❌ 请求失败: ' + e.message);
                }
              }}
              style={{
                width: '100%', padding: '5px 0',
                background: `${ACCENT}30`, border: `1px solid ${ACCENT}88`,
                borderRadius: 5, color: ACCENT, fontSize: 10,
                cursor: 'pointer', letterSpacing: 1.5, fontFamily: 'monospace',
                fontWeight: 700,
              }}
            >✎ 确认写入代码</button>
          </div>
        </>
      )}
    </div>
  );
}

export { DEFAULTS };
