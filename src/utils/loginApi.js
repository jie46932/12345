export async function loginWithPassword(fetchImpl, username, password) {
  const response = await fetchImpl('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const result = await response.json();
  if (!response.ok || !result?.success) return { success: false, message: result?.message || '账号或密码错误' };
  return result;
}
