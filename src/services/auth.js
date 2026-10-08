import api from "./api";

// Aceita tanto a resposta de /auth/me quanto a sessao ja normalizada guardada no navegador.
function normalizarUsuario(usuario) {
  if (!usuario) return null;

  const tipoUpper = (usuario.Tipo || usuario.tipo || "").toString().toUpperCase();
  const seloMap = {
    SUPER_ADMIN: "super_admin",
    PRINCIPAL: "principal",
    SECUNDARIO: "secundario",
    ESTOQUISTA: "estoquista",
    AUXILIAR_ESTOQUE: "auxiliar_estoque",
  };

  // As permissoes vem do servidor. Aqui elas so decidem o que a tela mostra:
  // quem autoriza cada acao e sempre a API.
  const permissoes = usuario.permissoes ?? usuario.Permissoes ?? {};
  const isSuperAdmin = tipoUpper === "SUPER_ADMIN";
  const adminLoja = !!(permissoes.adminLoja ?? (isSuperAdmin || tipoUpper === "PRINCIPAL"));

  return {
    id: usuario.Id ?? usuario.id,
    nome: usuario.Nome ?? usuario.nome ?? "",
    email: usuario.Email ?? usuario.email ?? "",
    tipo: tipoUpper,
    selo: usuario.Selo ?? usuario.selo ?? seloMap[tipoUpper] ?? "usuario",
    criadoEm: usuario.CriadoEm ?? usuario.criadoEm ?? null,
    rede: usuario.rede ?? usuario.Rede ?? null,
    loja: usuario.loja ?? usuario.Loja ?? null,
    lojaBaseId: usuario.lojaBaseId ?? usuario.LojaBaseId ?? null,
    permissoes,
    isSuperAdmin,
    // Administra a loja atual (admins, colaboradores): principal da loja ou super admin da rede.
    isPrincipal: adminLoja,
    // E de fato o admin principal desta loja (unico que pode transferir o cargo).
    isPrincipalDaLoja: tipoUpper === "PRINCIPAL",
    isSecundario: tipoUpper === "SECUNDARIO",
    isEstoquista: tipoUpper === "ESTOQUISTA",
    isAuxiliarEstoque: tipoUpper === "AUXILIAR_ESTOQUE",
    podeCatalogo: !!permissoes.catalogoRede,
    podeGerirRede: !!permissoes.gestaoRede
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

// Super admin: passa a operar em outra loja da rede. O servidor devolve um token valido so para ela.
export async function trocarLoja(lojaId) {
  const res = await api.post(`/auth/trocar-loja/${lojaId}`);
  const token = res.data?.token;
  if (!token) throw new Error("Resposta não retornou token");
  localStorage.setItem("token", token);

  return await getPerfilAtual();
}

export async function alterarSenha(senhaAtual, novaSenha) {
  const res = await api.post("/auth/alterar-senha", { senhaAtual, novaSenha });
  // A troca encerra as outras sessoes; esta continua com o novo token.
  if (res.data?.token) localStorage.setItem("token", res.data.token);
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
}
