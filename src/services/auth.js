import api from "./api";

function normalizarUsuario(usuario) {
  if (!usuario) return null;

  const tipoUpper = (usuario.Tipo || usuario.tipo || "").toString().toUpperCase();
  const seloMap = {
    PRINCIPAL: "principal",
    SECUNDARIO: "secundario",
    ESTOQUISTA: "estoquista",
    AUXILIAR_ESTOQUE: "auxiliar_estoque",
  };

  return {
    id: usuario.Id ?? usuario.id,
    nome: usuario.Nome ?? usuario.nome ?? "",
    email: usuario.Email ?? usuario.email ?? "",
    tipo: tipoUpper,
    selo: usuario.Selo ?? usuario.selo ?? seloMap[tipoUpper] ?? "usuario",
    criadoEm: usuario.CriadoEm ?? usuario.criadoEm ?? null,
    isPrincipal: tipoUpper === "PRINCIPAL",
    isSecundario: tipoUpper === "SECUNDARIO",
    isEstoquista: tipoUpper === "ESTOQUISTA",
    isAuxiliarEstoque: tipoUpper === "AUXILIAR_ESTOQUE"
  };
}

function salvarUsuarioLocal(usuario) {
  if (!usuario) {
    localStorage.removeItem("usuario");
    return;
  }

  localStorage.setItem("usuario", JSON.stringify(usuario));
}

export function getSessao() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  const usuarioLocal = (() => {
    try {
      const bruto = localStorage.getItem("usuario");
      return bruto ? JSON.parse(bruto) : null;
    } catch {
      return null;
    }
  })();

  if (usuarioLocal) {
    return {
      token,
      ...normalizarUsuario(usuarioLocal)
    };
  }

  return {
    token
  };
}

export async function getPerfilAtual() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  const res = await api.get("/auth/me");
  const usuario = normalizarUsuario(res.data);
  salvarUsuarioLocal(usuario);

  return {
    token,
    ...usuario
  };
}

export async function login(email, senha) {
  const res = await api.post("/auth/login", { Email: (email || "").trim(), Senha: senha });
  const token = res.data?.token;
  if (!token) throw new Error("Resposta de login não retornou token");
  localStorage.setItem("token", token);

  return await getPerfilAtual();
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
}