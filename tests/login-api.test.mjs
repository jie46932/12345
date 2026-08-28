import test from 'node:test';
import assert from 'node:assert/strict';
import { loginWithPassword } from '../src/utils/loginApi.js';

test('login API handles success', async () => {
  const result = await loginWithPassword(async () => ({ ok: true, json: async () => ({ success: true, token: 'test-token' }) }), 'user', 'pass');
  assert.deepEqual(result, { success: true, token: 'test-token' });
});

test('login API normalizes invalid credentials', async () => {
  const result = await loginWithPassword(async () => ({ ok: false, json: async () => ({ success: false }) }), 'user', 'bad');
  assert.deepEqual(result, { success: false, message: '账号或密码错误' });
});

test('login API propagates network errors to the UI catch boundary', async () => {
  await assert.rejects(() => loginWithPassword(async () => { throw new Error('offline'); }, 'user', 'pass'), /offline/);
});
