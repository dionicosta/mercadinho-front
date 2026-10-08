import { useCallback, useEffect, useState } from "react";
import api, { extrairErro } from "../services/api";
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
  const [adminForm, setAdminForm] = useState({ nome: "", email: "", senha: "" });

  // modal / form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    Id: null,
    Nome: "",
    Preco: "",
    Estoque: "",
    EstoqueMinimo: "",
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
  // isPrincipal: administra a loja atual (principal da loja ou super admin da rede).
  const isPrincipal = !!sessao?.isPrincipal;
  const isPrincipalDaLoja = !!sessao?.isPrincipalDaLoja;
  // O catalogo (nome, secao, imagem) e da rede: so a matriz ou o super admin alteram.
  const podeCatalogo = !!sessao?.podeCatalogo;
  const podeGerirRede = !!sessao?.podeGerirRede;

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
      carregarAdmins();
      return;
    }

    setAdmins([]);
  }, [isPrincipal, statusSessao]);

  useEffect(() => {
    setPage(1);
  }, [filtroTexto, ordenarPor, direcaoOrdem]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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

  async function criarAdminSecundario(e) {
    e.preventDefault();
    setErroAdmins(null);

    if (!adminForm.email || !adminForm.senha) {
      setErroAdmins("Email e senha são obrigatórios para criar admin secundário.");
      return;
    }

    try {
      await api.post("/auth/admins/secundarios", {
        Nome: adminForm.nome.trim(),
        Email: adminForm.email.trim(),
        Senha: adminForm.senha
      });
      setAdminForm({ nome: "", email: "", senha: "" });
      await carregarAdmins();
    } catch (err) {
      setErroAdmins(extrairErro(err, "Erro ao criar admin secundário."));
    }
  }

  async function removerAdminSecundario(id) {
    if (!window.confirm("Confirma remover este admin secundário?")) return;

    setErroAdmins(null);
    try {
      await api.delete(`/auth/admins/secundarios/${id}`);
      await carregarAdmins();
    } catch (err) {
      setErroAdmins(extrairErro(err, "Erro ao remover admin secundário."));
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
      setErroAdmins(extrairErro(err, "Erro ao transferir admin principal."));
    }
  }

  function abrirNovo() {
    setForm({ Id: null, Nome: "", Preco: "", Estoque: "", EstoqueMinimo: "", SecaoId: "", ImagemUrl: "" });
    setIsEditing(false);
    setIsModalOpen(true);
  }

  function abrirEditar(p) {
    setForm({
      Id: p.Id ?? p.id,
      Nome: p.Nome ?? p.nome ?? "",
      Preco: (p.Preco ?? p.preco ?? "").toString(),
      Estoque: (p.Estoque ?? p.estoque ?? "").toString(),
      EstoqueMinimo: (p.EstoqueMinimo ?? p.estoqueMinimo ?? "").toString(),
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
      const minimoNum = form.EstoqueMinimo === "" ? 0 : Number(form.EstoqueMinimo);
      const secaoNum = form.SecaoId === "" ? NaN : Number(form.SecaoId);

      if (!form.Nome || !isFinite(precoNum)) {
        setErro("Nome e Preço válidos são obrigatórios (use ponto para decimais).");
        return;
      }
      if (!Number.isInteger(estoqueNum) || estoqueNum < 0) {
        setErro("Estoque deve ser um número inteiro >= 0.");
        return;
      }
      if (!Number.isInteger(minimoNum) || minimoNum < 0) {
        setErro("Estoque mínimo deve ser um número inteiro >= 0.");
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
        EstoqueMinimo: minimoNum,
        SecaoId: secaoNum,
        ImagemUrl: form.ImagemUrl || ""
      };

      try {
        if (isEditing && form.Id) {
          await api.put(`/produtos/${form.Id}`, payload);
        } else {
          await api.post("/produtos", payload);
        }
        fecharModal();
        await carregar();
      } catch (err) {
        setErro(extrairErro(err, "Erro ao salvar produto."));
      }
    }

  async function excluir(id) {
      if (!podeGerirRede) {
      setErro("Somente a matriz pode excluir produtos do catálogo da rede.");
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
      setErro(extrairErro(err, "Erro ao excluir produto."));
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
              {sessao?.isSuperAdmin ? "Selo: Super Admin" : isPrincipal ? "Selo: Principal" : "Selo: Secundario"}
            </span>
            {sessao?.loja?.nome && <span className="perfil-usuario">Loja: {sessao.loja.nome}</span>}
            {sessao?.nome && <span className="perfil-usuario">Logado como: {sessao.nome}</span>}
            <span className={`sync-badge sync-${statusSessao}`}>
              {statusSessao === "loading" && "Validando sessao..."}
              {statusSessao === "synced" && "Sessao validada pelo servidor"}
              {statusSessao === "error" && "Falha ao validar sessao"}
            </span>
          </div>
        </div>

        <div className="produtos-actions">
          {podeCatalogo && <button className="btn btn-primary" onClick={abrirNovo}>Novo Produto</button>}
          <button className="btn btn-ghost" onClick={carregar}>Atualizar Lista</button>
          <button className="btn btn-ghost" onClick={() => window.print()}>Imprimir / PDF</button>
          <button className="btn btn-danger" onClick={sair}>Sair</button>
        </div>
      </section>

      {isPrincipal && (
        <section className="admins-card">
          <div className="admins-header">
            <h3>Admins Secundarios</h3>
            <p>Admins desta loja. O limite de admins secundarios e definido pelo plano da rede.</p>
          </div>

          <form className="admins-form" onSubmit={criarAdminSecundario}>
            <input
              className="input"
              placeholder="Nome"
              value={adminForm.nome}
              onChange={e => setAdminForm(prev => ({ ...prev, nome: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Email do admin secundario"
              value={adminForm.email}
              onChange={e => setAdminForm(prev => ({ ...prev, email: e.target.value }))}
            />
            <input
              className="input"
              type="password"
              placeholder="Senha (8+ caracteres, letra e numero)"
              autoComplete="new-password"
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
                const isAdminSuper = tipo === "SUPER_ADMIN";

                return (
                  <div className="admin-item" key={admin.Id ?? admin.id}>
                    <div>
                      <div className="admin-email">{admin.Email ?? admin.email}</div>
                      <div className="admin-meta">
                        <span className={`perfil-badge ${isAdminPrincipal || isAdminSuper ? "perfil-principal" : "perfil-secundario"}`}>
                          {isAdminSuper ? "super admin" : isAdminPrincipal ? "principal" : "secundario"}
                        </span>
                        <span>Criado em: {formatarDataHora(admin.CriadoEm ?? admin.criadoEm)}</span>
                      </div>
                    </div>

                    {!isAdminPrincipal && !isAdminSuper && (
                      <div className="admin-actions">
                        {isPrincipalDaLoja && (
                          <button className="btn btn-small btn-primary" onClick={() => transferirPrincipal(admin.Id ?? admin.id)}>
                            Tornar Principal
                          </button>
                        )}
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
                  <th>Minimo</th>
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
                    <td colSpan={10} className="produtos-empty">Nenhum produto encontrado.</td>
                  </tr>
                ) : (
                  paginated.map(p => {
                    const id = getCampo(p, "Id", "id");
                    const nome = getCampo(p, "Nome", "nome");
                    const preco = getCampo(p, "Preco", "preco");
                    const estoque = getCampo(p, "Estoque", "estoque");
                    const minimo = getCampo(p, "EstoqueMinimo", "estoqueMinimo") ?? 0;
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
                        <td>{minimo}</td>
                        <td>{secao}</td>
                        <td>{criadoPor}</td>
                        <td>{criadoEm}</td>
                        <td>{atualizadoPor}</td>
                        <td>{atualizadoEm}</td>
                        <td>
                          <div className="acoes-cell">
                            <button className="btn btn-small btn-ghost" onClick={() => abrirEditar(p)}>Editar</button>
                            <button className="btn btn-small btn-danger" onClick={() => excluir(id)} disabled={!podeGerirRede}>
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
            <p className="modal-subtitle">
              {podeCatalogo
                ? "Nome, secao e imagem valem para toda a rede. Preco, estoque e estoque minimo sao desta loja."
                : "Nome, secao e imagem pertencem ao catalogo da rede e so a matriz altera. Aqui voce ajusta preco, estoque e estoque minimo desta loja."}
            </p>

            {erro && <div className="produtos-error-banner">{erro}</div>}

            <form onSubmit={salvar} className="modal-form">
              <div className="form-row form-row-3">
                <input name="Nome" placeholder="Nome" value={form.Nome} onChange={handleChange} className="input" disabled={!podeCatalogo} />
                <input name="Preco" placeholder="Preco" value={form.Preco} onChange={handleChange} className="input" />
                <input name="Estoque" placeholder="Estoque" value={form.Estoque} onChange={handleChange} className="input" />
              </div>

              <div className="form-row form-row-2">
                <input name="EstoqueMinimo" placeholder="Estoque minimo" value={form.EstoqueMinimo} onChange={handleChange} className="input" />
                <input name="SecaoId" placeholder="Secao (Id)" value={form.SecaoId} onChange={handleChange} className="input" disabled={!podeCatalogo} />
              </div>

              <div className="form-row">
                <input name="ImagemUrl" placeholder="URL da imagem (opcional)" value={form.ImagemUrl} onChange={handleChange} className="input" disabled={!podeCatalogo} />
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