import api from './api';

export async function login(email, senha) {
  try {
    const payload = { Email: (email || '').trim(), Senha: (senha || '') };
    const res = await api.post('/auth/login', payload);
    const { token } = res.data || {};
    if (!token) throw new Error('Resposta sem token');
    localStorage.setItem('token', token);
    return token;
  } catch (err) {
    console.error('auth.login error:', err);
    if (err.response) {
      // mostra a resposta da API, se houver
      const status = err.response.status;
      const body = err.response.data;
      throw new Error(body?.title || body?.message || JSON.stringify(body) || `HTTP ${status}`);
    }
    throw err;
  }
}

export function logout() {
  localStorage.removeItem('token');
}