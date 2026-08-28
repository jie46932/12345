import test from 'node:test';
import assert from 'node:assert/strict';

function browser(protocol = 'https:') {
  const cookies = new Map();
  globalThis.localStorage = { removed: [], removeItem(key) { this.removed.push(key); } };
  globalThis.sessionStorage = { removed: [], removeItem(key) { this.removed.push(key); } };
  globalThis.window = { location: { protocol } };
  globalThis.document = {
    get cookie() { return [...cookies].map(([k,v]) => `${k}=${v}`).join('; '); },
    set cookie(value) {
      const [pair, ...attrs] = value.split(';').map((part) => part.trim());
      const [key, val] = pair.split('=');
      if (attrs.some((attr) => attr.toLowerCase() === 'max-age=0')) cookies.delete(key); else cookies.set(key, val);
    },
  };
}

test('persistent auth survives module memory through cookie and clears legacy storage', async () => {
  browser();
  const auth = await import(`../src/utils/authStorage.js?test=${Date.now()}`);
  auth.storePersistentAuthToken('auth-key', 'token-value');
  assert.equal(auth.getStoredAuthToken('auth-key'), 'token-value');
  assert.deepEqual(localStorage.removed, ['auth-key']);
  assert.match(document.cookie, /auth-key=token-value/);
  auth.clearStoredAuthToken('auth-key');
  assert.equal(auth.getStoredAuthToken('auth-key'), '');
});
