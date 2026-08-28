import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Electron renderer keeps isolation and sandbox enabled', () => {
  const source = fs.readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
  assert.match(source, /contextIsolation:\s*true/);
  assert.match(source, /nodeIntegration:\s*false/);
  assert.match(source, /sandbox:\s*true/);
});

test('runtime exposes read-only acceptance globals', () => {
  const source = fs.readFileSync(new URL('../src/components/SceneContent.jsx', import.meta.url), 'utf8');
  assert.match(source, /__threeScene/);
  assert.match(source, /__threeRenderer/);
  assert.match(source, /viewerSceneReady/);
});
