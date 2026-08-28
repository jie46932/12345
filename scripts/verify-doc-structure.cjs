const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const companyNodeRoot = 'F:\\company-knowledge-base\\web3d-nodes';
const expectedProjectId = '12345';
const requiredProjectFiles = [
  'PROJECT.md',
  '.agent-rules.md',
  'DOC/README.md',
  'DOC/project-context.md',
  'DOC/node-overrides.json',
];
const requiredCompanyFiles = [
  'router.md',
  'workflow-map.md',
  'skill-router.json',
  'node-index.json',
  'spec-driven-development.md',
  '00-grill-me-project-start.md',
  '00-project-brief.md',
  '01-pm-product.md',
  '02-3dsmax-modeling.md',
  '03-material-texture.md',
  '04-gltf-export.md',
  '05-asset-optimization.md',
  '06-gltf-quality-check.md',
  '07-r3f-scenegraph.md',
  '08-camera-animation-interaction.md',
  '09-frontend-uiux.md',
  '10-zustand-postmessage.md',
  '11-backend-database-api.md',
  '12-admin-cms.md',
  '13-electron-offline-package.md',
  '14-deployment-nginx-ecs.md',
  '15-qa-visual-regression.md',
  '16-performance-monitoring.md',
  '17-bugfix-debugging.md',
  '18-ops-data-maintenance.md',
  '19-market-seo-conversion.md',
];

function exists(base, relativePath) {
  return fs.existsSync(path.join(base, relativePath));
}

const problems = [];
for (const file of requiredProjectFiles) {
  if (!exists(root, file)) problems.push(`missing project file: ${file}`);
}
if (fs.existsSync(companyNodeRoot)) {
  for (const file of requiredCompanyFiles) {
    if (!exists(companyNodeRoot, file)) problems.push(`missing company Web3D DOC file: ${file}`);
  }
} else if (!process.env.CI) {
  problems.push(`company Web3D DOC root is unavailable: ${companyNodeRoot}`);
} else {
  console.warn('[verify-doc-structure] CI: company DOC root is external; validating project index only');
}

let overrides;
try {
  overrides = JSON.parse(fs.readFileSync(path.join(root, 'DOC/node-overrides.json'), 'utf8'));
} catch (error) {
  problems.push(`DOC/node-overrides.json is not valid JSON: ${error.message}`);
}

if (overrides) {
  if (overrides.projectId !== expectedProjectId) problems.push(`node-overrides projectId must be ${expectedProjectId}`);
  if (overrides.runtime !== 'r3f') problems.push('node-overrides runtime must be r3f');
  if (overrides.companyDocRoot !== companyNodeRoot) problems.push(`node-overrides companyDocRoot must be ${companyNodeRoot}`);
}

let skillRouter;
if (fs.existsSync(companyNodeRoot)) {
  try {
    skillRouter = JSON.parse(fs.readFileSync(path.join(companyNodeRoot, 'skill-router.json'), 'utf8'));
  } catch (error) {
    problems.push(`company skill-router.json is not valid JSON: ${error.message}`);
  }
}
if (skillRouter && !Array.isArray(skillRouter.routes)) problems.push('company skill-router.json must contain routes array');

if (problems.length) {
  console.error('[verify-doc-structure] Problems found:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(`[verify-doc-structure] OK: ${expectedProjectId} uses centralized company Web3D DOC at ${companyNodeRoot}`);
