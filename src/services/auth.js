import api from './api';

export async function login(email, senha) {
  const res = await api.post('/auth/login', { Email: email, Senha: senha });
  const { token } = res.data;
  localStorage.setItem('token', token);
  return token;
}

export function logout() {
  localStorage.removeItem('token');
}
