import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultInput = 'F:\\00外包\\00京东\\2025.11.24 mini立影\\工程\\mini1208\\12345_v1.0.0\\mainModel.glb';
const defaultOutputDir = path.join(root, 'media');
const cliPath = path.join(root, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith('--')) continue;
  const key = arg.slice(2);
  const next = process.argv[i + 1];
  if (!next || next.startsWith('--')) {
    args.set(key, 'true');
  } else {
    args.set(key, next);
    i += 1;
  }
}

const input = path.resolve(args.get('input') || defaultInput);
const outputDir = path.resolve(args.get('out-dir') || defaultOutputDir);
const force = args.get('force') === 'true';
const shouldInspect = force || args.get('inspect') === 'true';

const profiles = [
  {
    name: 'ios11',
    output: 'mainModel-ar-ios11.glb',
    textureSize: '1024',
    textureCompress: 'webp',
    compress: 'false',
    simplify: 'false',
  },
  {
    name: 'quality',
    output: 'mainModel-ar-quality.glb',
    textureSize: '2048',
    textureCompress: 'webp',
    compress: 'false',
    simplify: 'false',
  },
  {
    name: 'ios11-simplified',
    output: 'mainModel-ar-ios11-simplified.glb',
    textureSize: '1024',
    textureCompress: 'webp',
    compress: 'false',
    simplify: 'true',
    simplifyRatio: '0.6',
    simplifyError: '0.0002',
  },
];

function runCli(commandArgs, options = {}) {
  execFileSync(process.execPath, [cliPath, ...commandArgs], {
    cwd: root,
    stdio: options.stdio || 'inherit',
  });
}

function hasCommand(command) {
  const result = spawnSync('where.exe', [command], { stdio: 'ignore' });
  return result.status === 0;
}

function formatMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function optimizeProfile(profile) {
  const output = path.join(outputDir, profile.output);
  if (fs.existsSync(output) && !force) {
    console.log(`[optimize-ar-glb] keeping existing ${path.relative(root, output)} (${formatMB(fs.statSync(output).size)})`);
    return output;
  }

  const optimizeArgs = [
    'optimize',
    input,
    output,
    '--compress',
    profile.compress || 'false',
    '--texture-compress',
    profile.textureCompress,
    '--texture-size',
    profile.textureSize,
    '--simplify',
    profile.simplify,
  ];

  if (profile.simplify === 'true') {
    optimizeArgs.push('--simplify-ratio', profile.simplifyRatio, '--simplify-error', profile.simplifyError);
  }

  console.log(`[optimize-ar-glb] building ${profile.name}: ${path.relative(root, output)}`);
  runCli(optimizeArgs);
  console.log(`[optimize-ar-glb] wrote ${path.relative(root, output)} (${formatMB(fs.statSync(output).size)})`);
  return output;
}

function maybeOptimizeKtx2() {
  const output = path.join(outputDir, 'mainModel-ar-ios11.ktx2.glb');
  if (fs.existsSync(output) && !force) {
    console.log(`[optimize-ar-glb] keeping existing ${path.relative(root, output)} (${formatMB(fs.statSync(output).size)})`);
    return output;
  }

  if (!hasCommand('toktx')) {
    console.log('[optimize-ar-glb] skipped KTX2 profile because toktx is not installed');
    return null;
  }

  console.log(`[optimize-ar-glb] building ktx2: ${path.relative(root, output)}`);
  runCli([
    'optimize',
    input,
    output,
    '--compress',
    'meshopt',
    '--texture-compress',
    'ktx2',
    '--texture-size',
    '1024',
    '--simplify',
    'false',
  ]);
  console.log(`[optimize-ar-glb] wrote ${path.relative(root, output)} (${formatMB(fs.statSync(output).size)})`);
  return output;
}

function inspectOutput(file) {
  if (!file || !fs.existsSync(file)) return;
  console.log(`\n[optimize-ar-glb] inspect ${path.relative(root, file)}`);
  runCli(['inspect', file]);
}

if (!fs.existsSync(cliPath)) {
  throw new Error(`Missing glTF-Transform CLI at ${cliPath}. Run npm install first.`);
}

if (!fs.existsSync(input)) {
  const requiredOutput = path.join(outputDir, 'mainModel-ar-ios11.glb');
  if (fs.existsSync(requiredOutput)) {
    console.log(`[optimize-ar-glb] source missing, using existing ${path.relative(root, requiredOutput)}`);
    process.exit(0);
  }
  throw new Error(`Source GLB not found: ${input}`);
}

fs.mkdirSync(outputDir, { recursive: true });
console.log(`[optimize-ar-glb] source ${input} (${formatMB(fs.statSync(input).size)})`);
if (shouldInspect) {
  console.log('\n[optimize-ar-glb] inspect source');
  runCli(['inspect', input]);
}

const outputs = profiles.map(optimizeProfile);
outputs.push(maybeOptimizeKtx2());
if (shouldInspect) {
  for (const output of outputs) inspectOutput(output);
}
