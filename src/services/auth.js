import api from "./api";

export async function login(email, senha) {
  const res = await api.post("/auth/login", { Email: (email || "").trim(), Senha: senha });
  const token = res.data?.token;
  if (!token) throw new Error("Resposta de login não retornou token");
  localStorage.setItem("token", token);
  return token;
}

export function logout() {
  localStorage.removeItem("token");
}