import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { getPerfilAtual, getSessao, logout } from "../services/auth";
import "./produtos.css";

export default function Produtos({ setLogado, sessao: sessaoInicial, setSessao }) {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [sessaoLocal, setSessaoLocal] = useState(sessaoInicial || getSessao());
  const [statusSessao, setStatusSessao] = useState(sessaoInicial ? "synced" : "loading");
  const [filtroTexto, setFiltroTexto] = useState("");
  const [ordenarPor, setOrdenarPor] = useState("nome");
  const [direcaoOrdem, setDirecaoOrdem] = useState("asc");
  const [admins, setAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [erroAdmins, setErroAdmins] = useState(null);
  const [existePrincipal, setExistePrincipal] = useState(null);
  const [loadingExistePrincipal, setLoadingExistePrincipal] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: "", senha: "" });

  // modal / form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    Id: null,
    Nome: "",
    Preco: "",
    Estoque: "",
    SecaoId: "",
    ImagemUrl: ""
  });

  // paginação cliente
  const [page, setPage] = useState(1);
  const pageSize = 10;

  function getCampo(obj, pascalCase, camelCase) {
    return obj?.[pascalCase] ?? obj?.[camelCase];
  }

  const sessao = sessaoInicial || sessaoLocal;
  const isPrincipal = !!sessao?.isPrincipal;
  const podeAssumirPrincipal = !isPrincipal
    && statusSessao === "synced"
    && !loadingExistePrincipal
    && existePrincipal === false;

  function formatarPreco(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(numero);
  }

  function formatarDataHora(valor) {
    if (!valor) return "-";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(data);
  }

  function comparar(valorA, valorB, tipo = "texto") {
    if (tipo === "numero") {
      const a = Number(valorA ?? 0);
      const b = Number(valorB ?? 0);
      return a - b;
    }

    if (tipo === "data") {
      const a = new Date(valorA || 0).getTime();
      const b = new Date(valorB || 0).getTime();
      return a - b;
    }

    const a = (valorA ?? "").toString().toLowerCase();
    const b = (valorB ?? "").toString().toLowerCase();
    return a.localeCompare(b, "pt-BR");
  }

  const termo = filtroTexto.trim().toLowerCase();

  const produtosFiltrados = produtos.filter(p => {
    if (!termo) return true;

    const nome = (getCampo(p, "Nome", "nome") ?? "").toString().toLowerCase();
    const secao = (getCampo(p, "SecaoId", "secaoId") ?? "").toString().toLowerCase();
    const criadoPor = (getCampo(p, "CriadoPor", "criadoPor") ?? "").toString().toLowerCase();
    const atualizadoPor = (getCampo(p, "AtualizadoPor", "atualizadoPor") ?? "").toString().toLowerCase();

    return nome.includes(termo)
      || secao.includes(termo)
      || criadoPor.includes(termo)
      || atualizadoPor.includes(termo);
  });

  const produtosOrdenados = [...produtosFiltrados].sort((a, b) => {
    let resultado = 0;

    switch (ordenarPor) {
      case "preco":
        resultado = comparar(getCampo(a, "Preco", "preco"), getCampo(b, "Preco", "preco"), "numero");
        break;
      case "estoque":
        resultado = comparar(getCampo(a, "Estoque", "estoque"), getCampo(b, "Estoque", "estoque"), "numero");
        break;
      case "secao":
        resultado = comparar(getCampo(a, "SecaoId", "secaoId"), getCampo(b, "SecaoId", "secaoId"), "numero");
        break;
      case "criadoEm":
        resultado = comparar(getCampo(a, "CriadoEm", "criadoEm"), getCampo(b, "CriadoEm", "criadoEm"), "data");
        break;
      case "atualizadoEm":
        resultado = comparar(getCampo(a, "AtualizadoEm", "atualizadoEm"), getCampo(b, "AtualizadoEm", "atualizadoEm"), "data");
        break;
      case "nome":
      default:
        resultado = comparar(getCampo(a, "Nome", "nome"), getCampo(b, "Nome", "nome"));
        break;
    }

    return direcaoOrdem === "asc" ? resultado : resultado * -1;
  });

  const totalPages = Math.max(1, Math.ceil(produtosOrdenados.length / pageSize));
  const paginated = produtosOrdenados.slice((page - 1) * pageSize, page * pageSize);

  const carregarSessaoAtual = useCallback(async () => {
    setStatusSessao("loading");

    try {
      const perfil = await getPerfilAtual();
      if (perfil) {
        setSessaoLocal(perfil);
        setSessao(perfil);
        setStatusSessao("synced");
        return;
      }
    } catch (err) {
      console.error("Erro ao carregar perfil atual:", err);
      setStatusSessao("error");
    }

    logout();
    setSessaoLocal(null);
    setSessao(null);
    setLogado(false);
  }, [setLogado, setSessao]);

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    carregarSessaoAtual();
  }, [carregarSessaoAtual]);

  useEffect(() => {
    if (sessaoInicial) {
      setSessaoLocal(sessaoInicial);
      setStatusSessao("synced");
    }
  }, [sessaoInicial]);

  useEffect(() => {
    if (statusSessao !== "synced") return;

    if (isPrincipal) {
      setExistePrincipal(true);
      carregarAdmins();
      return;
    }

    setAdmins([]);
    carregarDisponibilidadePrincipal();
  }, [isPrincipal, statusSessao]);

  useEffect(() => {
    setPage(1);
  }, [filtroTexto, ordenarPor, direcaoOrdem]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function extrairMensagemErroAdmin(err, fallback) {
    const status = err?.response?.status;
    const data = err?.response?.data;

    if (status === 401) return "Sessão expirada. Faça login novamente.";
    if (status === 403) return "Sem permissão para esta ação. Faça logout e login novamente para atualizar o perfil.";

    if (typeof data === "string" && data.trim()) return data;
    if (data?.message) return data.message;
    if (data?.detail) return data.detail;
    if (data?.title) return data.title;

    return fallback;
  }

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const res = await api.get("/produtos");
      setProdutos(res.data || []);
      setPage(1);
    } catch (err) {
      console.error(err);
      setErro("Erro ao carregar produtos.");
    } finally {
      setLoading(false);
    }
  }

  async function carregarAdmins() {
    setLoadingAdmins(true);
    setErroAdmins(null);
    try {
      const res = await api.get("/auth/admins");
      setAdmins(res.data || []);
    } catch (err) {
      console.error(err);
      setErroAdmins("Erro ao carregar admins.");
    } finally {
      setLoadingAdmins(false);
    }
  }

  async function carregarDisponibilidadePrincipal() {
    setLoadingExistePrincipal(true);
    setErroAdmins(null);
    try {
      const interpretarResposta = (data) => {
        if (typeof data === "boolean") return data;

        if (typeof data === "number") {
          if (data === 1) return true;
          if (data === 0) return false;
        }

        if (typeof data === "string") {
          const texto = data.trim().toLowerCase();
          if (texto === "true") return true;
          if (texto === "false") return false;
          return null;
        }

        if (data && typeof data === "object") {
          const bruto = data?.existePrincipal
            ?? data?.ExistePrincipal
            ?? data?.value
            ?? data?.Value
            ?? data?.resultado
            ?? data?.Resultado;

          if (typeof bruto === "boolean") return bruto;
          if (typeof bruto === "number") {
            if (bruto === 1) return true;
            if (bruto === 0) return false;
          }
          if (typeof bruto === "string") {
            const texto = bruto.trim().toLowerCase();
            if (texto === "true") return true;
            if (texto === "false") return false;
          }
        }

        return null;
      };

      const res = await api.get("/auth/admins/existe-principal");
      let valor = interpretarResposta(res.data);

      const pareceHtml = typeof res.data === "string"
        && /<!doctype html>|<html/i.test(res.data);

      // Se a resposta vier como HTML, o frontend caiu em uma rota errada e deve falhar de forma explícita.
      if (valor === null && pareceHtml) {
        throw new Error("A rota /api/auth/admins/existe-principal retornou HTML em vez de JSON.");
      }

      if (typeof valor !== "boolean") {
        throw new Error("Resposta inválida ao verificar principal.");
      }

      setExistePrincipal(valor);
    } catch (err) {
      console.error(err);
      setExistePrincipal(true);
      setErroAdmins("Nao foi possivel verificar o status do principal no momento.");
    } finally {
      setLoadingExistePrincipal(false);
    }
  }

  async function criarAdminSecundario(e) {
    e.preventDefault();
    setErroAdmins(null);

    if (!adminForm.email || !adminForm.senha) {
      setErroAdmins("Email e senha são obrigatórios para criar admin secundário.");
      return;
    }

    try {
      await api.post("/auth/admins/secundarios", {
        Email: adminForm.email.trim(),
        Senha: adminForm.senha
      });
      setAdminForm({ email: "", senha: "" });
      await carregarAdmins();
    } catch (err) {
      setErroAdmins(extrairMensagemErroAdmin(err, "Erro ao criar admin secundário."));
    }
  }

  async function removerAdminSecundario(id) {
    if (!window.confirm("Confirma remover este admin secundário?")) return;

    setErroAdmins(null);
    try {
      await api.delete(`/auth/admins/secundarios/${id}`);
      await carregarAdmins();
    } catch (err) {
      setErroAdmins(extrairMensagemErroAdmin(err, "Erro ao remover admin secundário."));
    }
  }

  async function assumirPrincipal() {
    if (!podeAssumirPrincipal) return;

    if (!window.confirm("Deseja assumir o cargo de admin principal?")) return;

    setErroAdmins(null);
    try {
      await api.post("/auth/admins/assumir-principal");
      setExistePrincipal(true);
      await carregarSessaoAtual();
      await carregarAdmins();
    } catch (err) {
      if (err?.response?.status === 403) {
        setExistePrincipal(true);
      }
      setErroAdmins(extrairMensagemErroAdmin(err, "Erro ao assumir admin principal."));
    }
  }

  async function transferirPrincipal(id) {
    if (!window.confirm("Confirma transferir o cargo de admin principal para este usuário?")) return;

    setErroAdmins(null);
    try {
      await api.post(`/auth/admins/transferir-principal/${id}`);

      // Após transferência o usuário atual deixa de ser principal; exige novo login.
      logout();
      setSessaoLocal(null);
      setSessao(null);
      setLogado(false);
    } catch (err) {
      setErroAdmins(extrairMensagemErroAdmin(err, "Erro ao transferir admin principal."));
    }
  }

  function abrirNovo() {
    setForm({ Id: null, Nome: "", Preco: "", Estoque: "", SecaoId: "", ImagemUrl: "" });
    setIsEditing(false);
    setIsModalOpen(true);
  }

  function abrirEditar(p) {
    setForm({
      Id: p.Id ?? p.id,
      Nome: p.Nome ?? p.nome ?? "",
      Preco: (p.Preco ?? p.preco ?? "").toString(),
      Estoque: (p.Estoque ?? p.estoque ?? "").toString(),
      SecaoId: (p.SecaoId ?? p.secaoId ?? "").toString(),
      ImagemUrl: p.ImagemUrl ?? p.imagemUrl ?? ""
    });
    setIsEditing(true);
    setIsModalOpen(true);
  }

  function fecharModal() {
    setIsModalOpen(false);
    setErro(null);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

      async function salvar(e) {
      e.preventDefault();
      setErro(null);

      // normaliza inputs numéricos (aceita vírgula como separador decimal)
      const precoRaw = (form.Preco ?? "").toString().replace(",", ".");
      const precoNum = Number(precoRaw);
      const estoqueNum = form.Estoque === "" ? 0 : Number(form.Estoque);
      const secaoNum = form.SecaoId === "" ? NaN : Number(form.SecaoId);

      if (!form.Nome || !isFinite(precoNum)) {
        setErro("Nome e Preço válidos são obrigatórios (use ponto para decimais).");
        return;
      }
      if (!Number.isInteger(estoqueNum) || estoqueNum < 0) {
        setErro("Estoque deve ser um número inteiro >= 0.");
        return;
      }
      if (!Number.isInteger(secaoNum) || secaoNum <= 0) {
        setErro("Seção (Id) deve ser um número inteiro > 0.");
        return;
      }

      const payload = {
        Nome: form.Nome,
        Preco: precoNum,
        Estoque: estoqueNum,
        SecaoId: secaoNum,
        ImagemUrl: form.ImagemUrl || ""
      };

      // debug: imprimir payload e token antes de enviar
      console.debug("[Produtos] payload ->", payload);
      const token = localStorage.getItem("token");
      console.debug("[Produtos] token ->", token);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      try {
        if (isEditing && form.Id) {
          await api.put(`/produtos/${form.Id}`, payload, { headers });
        } else {
          await api.post("/produtos", payload, { headers });
        }
        fecharModal();
        await carregar();
      } catch (err) {
        // log mais detalhado para diagnóstico
        console.error("Erro ao salvar produto:", err);
        console.error("Resposta do servidor:", err?.response?.data);

        let msg = "Erro ao salvar produto.";
        if (err?.response) {
          const r = err.response;
          if (r.status === 401 || r.status === 403) {
            msg = "Não autorizado. Faça login novamente para criar/editar produtos.";
            setErro(msg);
            return;
          }
          // prioriza campo `error` (novo no backend em Development), depois `message`/`title`
          if (r.data) {
            msg = r.data.error ?? r.data.title ?? r.data.message ?? JSON.stringify(r.data);
          } else {
            msg = `HTTP ${r.status} - ${r.statusText}`;
          }
        } else if (err?.message) {
          msg = err.message;
        }
        setErro(msg);
      }
    }

  async function excluir(id) {
      if (!isPrincipal) {
      setErro("Apenas admin principal pode excluir produtos.");
      return;
    }
      if (!window.confirm("Confirma exclusão do produto?")) return;
    try {
      await api.delete(`/produtos/${id}`);
      // ajustar página se necessário
      const next = Math.min(page, Math.max(1, Math.ceil((produtos.length - 1) / pageSize)));
      setPage(next);
      carregar();
    } catch (err) {
      console.error(err);
      setErro("Erro ao excluir produto.");
    }
  }

  function goToPage(n) {
    setPage(Math.max(1, Math.min(totalPages, n)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function sair() {
    logout();
    setLogado(false);
  }

  return (
    <div className="produtos-page">
      <div className="produtos-bg-shape produtos-bg-shape-a" />
      <div className="produtos-bg-shape produtos-bg-shape-b" />

      <section className="produtos-header-card">
        <div>
          <h2 className="produtos-title">Gestao de Produtos</h2>
          <p className="produtos-subtitle">Controle catalogo, estoque e auditoria de alteracoes em um unico painel.</p>
          <div className="perfil-badges">
            <span className={`perfil-badge ${isPrincipal ? "perfil-principal" : "perfil-secundario"}`}>
              {isPrincipal ? "Selo: Principal" : "Selo: Secundario"}
            </span>
            {sessao?.nome && <span className="perfil-usuario">Logado como: {sessao.nome}</span>}
            <span className={`sync-badge sync-${statusSessao}`}>
              {statusSessao === "loading" && "Validando sessao..."}
              {statusSessao === "synced" && "Sessao validada pelo servidor"}
              {statusSessao === "error" && "Falha ao validar sessao"}
            </span>
          </div>
        </div>

        <div className="produtos-actions">
          <button className="btn btn-primary" onClick={abrirNovo}>Novo Produto</button>
          <button className="btn btn-ghost" onClick={carregar}>Atualizar Lista</button>
          <button className="btn btn-ghost" onClick={() => window.print()}>Imprimir / PDF</button>
          <button className="btn btn-danger" onClick={sair}>Sair</button>
        </div>
      </section>

      {isPrincipal && (
        <section className="admins-card">
          <div className="admins-header">
            <h3>Admins Secundarios</h3>
            <p>Somente admin principal pode criar (maximo 2) e remover admins secundarios.</p>
          </div>

          <form className="admins-form" onSubmit={criarAdminSecundario}>
            <input
              className="input"
              placeholder="Email do admin secundario"
              value={adminForm.email}
              onChange={e => setAdminForm(prev => ({ ...prev, email: e.target.value }))}
            />
            <input
              className="input"
              type="password"
              placeholder="Senha"
              value={adminForm.senha}
              onChange={e => setAdminForm(prev => ({ ...prev, senha: e.target.value }))}
            />
            <button className="btn btn-primary" type="submit">Cadastrar Secundario</button>
            <button className="btn btn-ghost" type="button" onClick={carregarAdmins}>Atualizar Admins</button>
          </form>

          {erroAdmins && <div className="produtos-error-banner">{erroAdmins}</div>}
          {loadingAdmins ? (
            <div className="admins-loading">Carregando admins...</div>
          ) : (
            <div className="admins-lista">
              {(admins || []).map(admin => {
                const tipo = (admin.Tipo || admin.tipo || "").toString().toUpperCase();
                const isAdminPrincipal = tipo === "PRINCIPAL";

                return (
                  <div className="admin-item" key={admin.Id ?? admin.id}>
                    <div>
                      <div className="admin-email">{admin.Email ?? admin.email}</div>
                      <div className="admin-meta">
                        <span className={`perfil-badge ${isAdminPrincipal ? "perfil-principal" : "perfil-secundario"}`}>
                          {isAdminPrincipal ? "principal" : "secundario"}
                        </span>
                        <span>Criado em: {formatarDataHora(admin.CriadoEm ?? admin.criadoEm)}</span>
                      </div>
                    </div>

                    {!isAdminPrincipal && (
                      <div className="admin-actions">
                        <button className="btn btn-small btn-primary" onClick={() => transferirPrincipal(admin.Id ?? admin.id)}>
                          Tornar Principal
                        </button>
                        <button className="btn btn-small btn-danger" onClick={() => removerAdminSecundario(admin.Id ?? admin.id)}>
                          Remover
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {!isPrincipal && (
        <section className="admins-card">
          <div className="admins-header">
            <h3>Recuperar Admin Principal</h3>
            <p>Use esta opção apenas quando não existir nenhum admin principal cadastrado.</p>
          </div>

          {erroAdmins && <div className="produtos-error-banner">{erroAdmins}</div>}

          <p className="admin-disponibilidade">
            {loadingExistePrincipal && "Verificando disponibilidade..."}
            {!loadingExistePrincipal && existePrincipal === true && "Indisponivel: ja existe um admin principal ativo."}
            {!loadingExistePrincipal && existePrincipal === false && "Disponivel: nenhum principal ativo encontrado."}
            {!loadingExistePrincipal && existePrincipal === null && "Nao foi possivel validar a disponibilidade."}
          </p>

          <button
            className={`btn btn-primary ${podeAssumirPrincipal ? "" : "btn-disabled-indisponivel"}`}
            type="button"
            onClick={assumirPrincipal}
            disabled={!podeAssumirPrincipal}
            title={podeAssumirPrincipal ? "Assumir admin principal" : "Indisponivel enquanto houver principal ativo"}
          >
            Assumir como Principal
          </button>
        </section>
      )}

      <section className="produtos-filtros-card">
        <div className="filtro-busca-wrap">
          <label className="filtro-label" htmlFor="filtro-busca">Busca</label>
          <input
            id="filtro-busca"
            className="input"
            value={filtroTexto}
            onChange={e => setFiltroTexto(e.target.value)}
            placeholder="Buscar por nome, secao, criado por ou atualizado por"
          />
        </div>

        <div className="filtro-select-wrap">
          <label className="filtro-label" htmlFor="ordenar-por">Ordenar por</label>
          <select
            id="ordenar-por"
            className="input input-select"
            value={ordenarPor}
            onChange={e => setOrdenarPor(e.target.value)}
          >
            <option value="nome">Nome</option>
            <option value="preco">Preco</option>
            <option value="estoque">Estoque</option>
            <option value="secao">Secao</option>
            <option value="criadoEm">Criado em</option>
            <option value="atualizadoEm">Atualizado em</option>
          </select>
        </div>

        <div className="filtro-select-wrap filtro-direcao-wrap">
          <label className="filtro-label" htmlFor="direcao-ordem">Direcao</label>
          <select
            id="direcao-ordem"
            className="input input-select"
            value={direcaoOrdem}
            onChange={e => setDirecaoOrdem(e.target.value)}
          >
            <option value="asc">Crescente</option>
            <option value="desc">Decrescente</option>
          </select>
        </div>
      </section>

      {loading ? (
        <div className="produtos-loading">Carregando produtos...</div>
      ) : (
        <>
          {erro && <div className="produtos-error-banner">{erro}</div>}

          <div className="produtos-table-wrapper">
            <table className="produtos-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Preco</th>
                  <th>Estoque</th>
                  <th>Secao</th>
                  <th>Criado Por</th>
                  <th>Criado Em</th>
                  <th>Atualizado Por</th>
                  <th>Atualizado Em</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="produtos-empty">Nenhum produto encontrado.</td>
                  </tr>
                ) : (
                  paginated.map(p => {
                    const id = getCampo(p, "Id", "id");
                    const nome = getCampo(p, "Nome", "nome");
                    const preco = getCampo(p, "Preco", "preco");
                    const estoque = getCampo(p, "Estoque", "estoque");
                    const secao = getCampo(p, "SecaoId", "secaoId");
                    const criadoPor = getCampo(p, "CriadoPor", "criadoPor") || "-";
                    const criadoEm = formatarDataHora(getCampo(p, "CriadoEm", "criadoEm"));
                    const atualizadoPor = getCampo(p, "AtualizadoPor", "atualizadoPor") || "-";
                    const atualizadoEm = formatarDataHora(getCampo(p, "AtualizadoEm", "atualizadoEm"));

                    return (
                      <tr key={id}>
                        <td className="td-strong">{nome}</td>
                        <td>{formatarPreco(preco)}</td>
                        <td>{estoque}</td>
                        <td>{secao}</td>
                        <td>{criadoPor}</td>
                        <td>{criadoEm}</td>
                        <td>{atualizadoPor}</td>
                        <td>{atualizadoEm}</td>
                        <td>
                          <div className="acoes-cell">
                            <button className="btn btn-small btn-ghost" onClick={() => abrirEditar(p)}>Editar</button>
                            <button className="btn btn-small btn-danger" onClick={() => excluir(id)} disabled={!isPrincipal}>
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="paginacao">
            <button className="btn btn-ghost" onClick={() => goToPage(page - 1)} disabled={page <= 1}>Anterior</button>
            <div className="paginacao-info">Pagina {page} de {totalPages}</div>
            <div className="paginacao-info">Total filtrado: {produtosOrdenados.length}</div>
            <button className="btn btn-ghost" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>Proxima</button>

            <div className="paginacao-numeros">
              {Array.from({ length: totalPages }).slice(0, 20).map((_, i) => {
                const n = i + 1;
                return (
                  <button
                    key={n}
                    onClick={() => goToPage(n)}
                    className={`btn btn-page ${n === page ? "btn-page-active" : ""}`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="modal-title">{isEditing ? "Editar Produto" : "Novo Produto"}</h3>
            <p className="modal-subtitle">Preencha os dados basicos. Os campos de auditoria sao preenchidos automaticamente pelo usuario logado.</p>

            {erro && <div className="produtos-error-banner">{erro}</div>}

            <form onSubmit={salvar} className="modal-form">
              <div className="form-row form-row-3">
                <input name="Nome" placeholder="Nome" value={form.Nome} onChange={handleChange} className="input" />
                <input name="Preco" placeholder="Preco" value={form.Preco} onChange={handleChange} className="input" />
                <input name="Estoque" placeholder="Estoque" value={form.Estoque} onChange={handleChange} className="input" />
              </div>

              <div className="form-row form-row-2">
                <input name="SecaoId" placeholder="Secao (Id)" value={form.SecaoId} onChange={handleChange} className="input" />
                <input name="ImagemUrl" placeholder="URL da imagem (opcional)" value={form.ImagemUrl} onChange={handleChange} className="input" />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={fecharModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{isEditing ? "Atualizar" : "Cadastrar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}