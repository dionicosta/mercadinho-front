import api from './api';

export async function login(email, senha) {
  const res = await api.post('/auth/login', { Email: email, Senha: senha });
  const token = res.data?.token || res.data?.Token;
  if (!token) {
    throw new Error('Resposta de login sem token.');
  }
  localStorage.setItem('token', token);
  return token;
}

export function logout() {
  localStorage.removeItem('token');
}
