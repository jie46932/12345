const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'max-quality.config.json'), 'utf8'));
const scanPath = path.join(root, 'reports', 'max-scene-scan.json');
const gltfPath = path.resolve(root, process.argv[2] || config.sourceGltf);
if (!fs.existsSync(scanPath)) { console.error('[compare:gltf] missing Max scan; run npm run scan:max and execute the generated script'); process.exit(1); }
if (!fs.existsSync(gltfPath)) { console.error(`[compare:gltf] missing ${gltfPath}`); process.exit(1); }
const scan = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
const gltf = JSON.parse(fs.readFileSync(gltfPath, 'utf8'));
const errors = [];
const warnings = [];
const maxNames = new Set((scan.nodes || []).map((n) => n.name));
const gltfNames = new Set((gltf.nodes || []).map((n) => n.name).filter(Boolean));
for (const node of scan.nodes || []) if (node.negativeScale) errors.push(`${node.name}: negative scale in Max`);
for (const name of maxNames) if (!gltfNames.has(name)) warnings.push(`${name}: Max node not found by name in glTF`);
for (const camera of scan.cameras || []) if (!(gltf.cameras || []).some((item) => item.name === camera.name)) errors.push(`${camera.name}: camera missing in glTF`);
const targets = new Map();
for (const clip of gltf.animations || []) for (const channel of clip.channels || []) {
  const name = gltf.nodes?.[channel.target?.node]?.name;
  const sampler = clip.samplers?.[channel.sampler];
  const input = gltf.accessors?.[sampler?.input];
  if (!name || !input) continue;
  const row = targets.get(name) || [];
  row.push({ clip: clip.name || '(unnamed)', path: channel.target.path, start: input.min?.[0], end: input.max?.[0], duration: input.max?.[0] - input.min?.[0] });
  targets.set(name, row);
}
const expectedDuration = (config.expectedAnimationRange[1] - config.expectedAnimationRange[0]) / config.expectedFrameRate;
for (const [name, rows] of targets) for (const row of rows) {
  if (!['translation','rotation','scale','weights'].includes(row.path)) errors.push(`${name}: invalid animation path ${row.path}`);
  if (row.start < -config.durationToleranceSeconds || row.end > expectedDuration + config.durationToleranceSeconds) errors.push(`${name}.${row.path}: ${row.start}-${row.end}s outside 0-${expectedDuration}s`);
}
const report = { generatedAt: new Date().toISOString(), max: { sourceFile: scan.sourceFile, frameRate: scan.frameRate, animationRange: scan.animationRange }, gltf: path.relative(root,gltfPath), expectedDuration, animationTargets: Object.fromEntries(targets), warnings, errors };
fs.mkdirSync(path.join(root,'reports'), { recursive: true });
fs.writeFileSync(path.join(root,'reports','max-gltf-compare.json'), JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if (errors.length) process.exitCode = 1;
