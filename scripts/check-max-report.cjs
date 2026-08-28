const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'max-quality.config.json'), 'utf8'));
const reportPath = path.join(root, 'reports', 'max-scene-scan.json');
if (!fs.existsSync(reportPath)) {
  console.error('[check:max] missing reports/max-scene-scan.json; run npm run scan:max in 3ds Max first');
  process.exit(1);
}
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const errors = [];
if (report.frameRate !== config.expectedFrameRate) errors.push(`frameRate ${report.frameRate} != ${config.expectedFrameRate}`);
if (JSON.stringify(report.animationRange) !== JSON.stringify(config.expectedAnimationRange)) errors.push(`animationRange ${report.animationRange} != ${config.expectedAnimationRange}`);
for (const node of report.nodes || []) {
  if (node.negativeScale) errors.push(`${node.name}: negative scale`);
  if (node.faces > 0 && !node.hasNormals) errors.push(`${node.name}: invalid/missing normals`);
  const groups = [node.positionKeys, node.rotationKeys, node.scaleKeys].flatMap((v) => Array.isArray(v) ? v : []);
  for (const group of groups) for (const key of group.keys || []) if (key.frame < config.expectedAnimationRange[0] || key.frame > config.expectedAnimationRange[1]) errors.push(`${node.name}: key ${key.frame} outside timeline`);
}
console.log(`[check:max] ${config.projectId}: nodes=${report.nodes?.length || 0}, errors=${errors.length}`);
for (const error of errors) console.error(`  - ${error}`);
if (errors.length) process.exitCode = 1;
