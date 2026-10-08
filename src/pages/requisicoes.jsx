import { useEffect, useState, useCallback } from "react";
import api, { extrairErro } from "../services/api";
import {
  exportarRequisicaoDetalhePdf,
  exportarRequisicoesPdf,
  imprimirRequisicaoDetalhePdf,
  imprimirRequisicoesPdf
} from "../services/pdf-export";
import "./requisicoes.css";

const ITEM_VAZIO = { produtoId: "", quantidadeSolicitada: 1 };

function statusLabel(s) {
  if (s === "PENDENTE" || s === 1) return { label: "Pendente", cls: "badge-pendente" };
  if (s === "APROVADA" || s === 2) return { label: "Aprovada", cls: "badge-aprovada" };
  if (s === "CANCELADA" || s === 3) return { label: "Cancelada", cls: "badge-cancelada" };
  return { label: s, cls: "" };
}

function Requisicoes({ sessao }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({
    solicitanteId: "",
    solicitante: "",
    tipoSolicitante: "AUXILIAR_ESTOQUE",
    observacoes: "",
  });
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }]);
  const [produtos, setProdutos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState(null);
  const [aprovando, setAprovando] = useState(null); // id da req sendo aprovada
  const [qtdsAprovadas, setQtdsAprovadas] = useState({}); // { itemId: qtd }
  const [erroAprovar, setErroAprovar] = useState(null);
  const [colaboradoresEstoque, setColaboradoresEstoque] = useState([]);
  const [filtroSolicitante, setFiltroSolicitante] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  const isAdmin = sessao?.isPrincipal || sessao?.isSecundario;

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [respReq, respProd] = await Promise.all([
        api.get("/requisicoes"),
        api.get("/produtos"),
      ]);
      setLista(respReq.data);
      setProdutos(respProd.data);

      if (isAdmin) {
        const respColab = await api.get("/auth/usuarios-estoque");
        setColaboradoresEstoque(respColab.data || []);
      }
    } catch {
      setErro("Falha ao carregar requisições.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function tipoSolicitanteLabel(tipo) {
    if (tipo === "ESTOQUISTA") return "Estoquista";
    if (tipo === "AUXILIAR_ESTOQUE") return "Auxiliar de Estoque";
    return tipo || "Nao informado";
  }

  function normalizarStatus(status) {
    if (status === 1 || status === "PENDENTE") return "PENDENTE";
    if (status === 2 || status === "APROVADA") return "APROVADA";
    if (status === 3 || status === "CANCELADA") return "CANCELADA";
    return (status || "").toString().toUpperCase();
  }

  function filtrarPorPeriodo(dataValor) {
    if (!filtroDataInicio && !filtroDataFim) return true;
    const data = new Date(dataValor);
    if (Number.isNaN(data.getTime())) return false;

    if (filtroDataInicio) {
      const inicio = new Date(`${filtroDataInicio}T00:00:00`);
      if (data < inicio) return false;
    }
    if (filtroDataFim) {
      const fim = new Date(`${filtroDataFim}T23:59:59`);
      if (data > fim) return false;
    }

    return true;
  }

  const listaFiltrada = lista.filter((r) => {
    const status = normalizarStatus(r.status);
    const solicitante = (r.solicitante || "").toString().toLowerCase();
    const termoSolicitante = filtroSolicitante.trim().toLowerCase();

    const okStatus = filtroStatus === "TODOS" || status === filtroStatus;
    const okSolicitante = !termoSolicitante || solicitante.includes(termoSolicitante);
    const okData = filtrarPorPeriodo(r.data);

    return okStatus && okSolicitante && okData;
  });

  function limparFiltros() {
    setFiltroSolicitante("");
    setFiltroStatus("TODOS");
    setFiltroDataInicio("");
    setFiltroDataFim("");
  }

  function abrirNovo() {
    const tipoSessao = sessao?.isEstoquista
      ? "ESTOQUISTA"
      : sessao?.isAuxiliarEstoque
        ? "AUXILIAR_ESTOQUE"
        : "AUXILIAR_ESTOQUE";

    setForm({
      solicitanteId: "",
      solicitante: isAdmin ? "" : (sessao?.nome ?? ""),
      tipoSolicitante: isAdmin ? "ESTOQUISTA" : tipoSessao,
      observacoes: "",
    });
    setItens([{ ...ITEM_VAZIO }]);
    setErroForm(null);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setErroForm(null);
  }

  function handleForm(e) {
    const { name, value } = e.target;

    if (name === "solicitanteId") {
      const selecionado = colaboradoresEstoque.find((c) => String(c.id ?? c.Id) === value);
      setForm((prev) => ({
        ...prev,
        solicitanteId: value,
        solicitante: selecionado?.nome ?? selecionado?.Nome ?? "",
        tipoSolicitante: selecionado?.tipo ?? selecionado?.Tipo ?? prev.tipoSolicitante,
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleItem(index, field, value) {
    setItens((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  function adicionarItem() {
    setItens((prev) => [...prev, { ...ITEM_VAZIO }]);
  }

  function removerItem(index) {
    if (itens.length === 1) return;
    setItens((prev) => prev.filter((_, i) => i !== index));
  }

  async function salvar(e) {
    e.preventDefault();
    if (!form.solicitante.trim()) {
      setErroForm("Solicitante é obrigatório e deve ser um colaborador de estoque.");
      return;
    }
    if (isAdmin && !form.solicitanteId) {
      setErroForm("Selecione um colaborador de estoque válido para a solicitação.");
      return;
    }
    if (isAdmin && !["ESTOQUISTA", "AUXILIAR_ESTOQUE"].includes((form.tipoSolicitante || "").toUpperCase())) {
      setErroForm("Selecione um colaborador de estoque válido para a solicitação.");
      return;
    }
    const itensValidos = itens.filter((it) => it.produtoId && it.quantidadeSolicitada > 0);
    if (itensValidos.length === 0) {
      setErroForm("Adicione ao menos um item.");
      return;
    }
    setSalvando(true);
    setErroForm(null);
    try {
      await api.post("/requisicoes", {
        solicitante: form.solicitante,
        tipoSolicitante: form.tipoSolicitante,
        observacoes: form.observacoes,
        itens: itensValidos.map((it) => ({
          produtoId: parseInt(it.produtoId),
          quantidadeSolicitada: parseInt(it.quantidadeSolicitada),
        })),
      });
      fecharModal();
      carregar();
    } catch (err) {
      setErroForm(extrairErro(err, "Erro ao criar requisição."));
    } finally {
      setSalvando(false);
    }
  }

  async function verDetalhe(id) {
    try {
      const resp = await api.get(`/requisicoes/${id}`);
      setDetalhe(resp.data);
    } catch {
      alert("Erro ao carregar detalhes da requisição.");
    }
  }

  function abrirAprovar(req) {
    const qtds = {};
    (req.itens ?? []).forEach((it) => {
      qtds[it.id] = it.quantidadeSolicitada;
    });
    setQtdsAprovadas(qtds);
    setErroAprovar(null);
    setAprovando(req);
  }

  async function confirmarAprovar() {
    if (!aprovando) return;
    setErroAprovar(null);
    try {
      await api.post(`/requisicoes/${aprovando.id}/aprovar`, {
        itens: Object.entries(qtdsAprovadas).map(([itemId, qtd]) => ({
          itemId: parseInt(itemId),
          quantidadeAtendida: parseInt(qtd),
        })),
      });
      setAprovando(null);
      setDetalhe(null);
      carregar();
    } catch (err) {
      setErroAprovar(extrairErro(err, "Erro ao aprovar requisição."));
    }
  }

  async function cancelar(id) {
    if (!window.confirm("Cancelar esta requisição?")) return;
    try {
      await api.post(`/requisicoes/${id}/cancelar`);
      setDetalhe(null);
      carregar();
    } catch (err) {
      alert(extrairErro(err, "Erro ao cancelar."));
    }
  }

  return (
    <div className="req-container">
      <div className="req-header">
        <h2 className="req-titulo">Requisições de Estoque</h2>
        <div className="req-header-acoes">
          <button className="btn-print" onClick={() => exportarRequisicoesPdf(listaFiltrada, sessao?.nome)}>
            Exportar PDF
          </button>
          <button className="btn-print" onClick={() => imprimirRequisicoesPdf(listaFiltrada, sessao?.nome)}>
            Imprimir dados
          </button>
          <button className="btn-novo" onClick={abrirNovo}>
            + Nova Requisição
          </button>
        </div>
      </div>

      <div className="req-filtros">
        <input
          type="text"
          className="req-filtro-input"
          placeholder="Filtrar por solicitante"
          value={filtroSolicitante}
          onChange={(e) => setFiltroSolicitante(e.target.value)}
        />
        <select
          className="req-filtro-input"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
        >
          <option value="TODOS">Todos os status</option>
          <option value="PENDENTE">Pendente</option>
          <option value="APROVADA">Aprovada</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        <input
          type="date"
          className="req-filtro-input"
          value={filtroDataInicio}
          onChange={(e) => setFiltroDataInicio(e.target.value)}
        />
        <input
          type="date"
          className="req-filtro-input"
          value={filtroDataFim}
          onChange={(e) => setFiltroDataFim(e.target.value)}
        />
        <button type="button" className="btn-print" onClick={limparFiltros}>
          Limpar filtros
        </button>
      </div>

      {loading && <p className="req-loading">Carregando...</p>}
      {erro && <p className="req-erro">{erro}</p>}

      {!loading && !erro && listaFiltrada.length === 0 && (
        <p className="req-vazio">Nenhuma requisição encontrada para os filtros aplicados.</p>
      )}

      {!loading && listaFiltrada.length > 0 && (
        <table className="req-tabela">
          <thead>
            <tr>
              <th>#</th>
              <th>Solicitante</th>
              <th>Tipo</th>
              <th>Data</th>
              <th>Status</th>
              <th>Assinado por</th>
              <th>Liberado por</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.map((r) => {
              const st = statusLabel(r.status);
              return (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.solicitante}</td>
                  <td>{tipoSolicitanteLabel(r.tipoSolicitante)}</td>
                  <td>{new Date(r.data).toLocaleDateString("pt-BR")}</td>
                  <td>
                    <span className={`req-badge ${st.cls}`}>{st.label}</span>
                  </td>
                  <td>{r.criadoPor ?? "-"}</td>
                  <td>{r.aprovadoPor ?? "-"}</td>
                  <td className="req-acoes">
                    <button className="btn-detalhe" onClick={() => verDetalhe(r.id)}>
                      Detalhes
                    </button>
                    {isAdmin && (r.status === "PENDENTE" || r.status === 1) && (
                      <>
                        <button className="btn-aprovar" onClick={() => { verDetalhe(r.id).then(() => {}); abrirAprovar(r); }}>
                          Aprovar
                        </button>
                        <button className="btn-cancelar-req" onClick={() => cancelar(r.id)}>
                          Cancelar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Modal detalhe */}
      {detalhe && !aprovando && (
        <div className="modal-overlay">
          <div className="modal-box modal-lg">
            <h3>Requisição #{detalhe.id}</h3>
            <p className="req-detalhe-info">
              Solicitante: <strong>{detalhe.solicitante}</strong> &nbsp;|&nbsp;
              Tipo: <strong>{tipoSolicitanteLabel(detalhe.tipoSolicitante)}</strong> &nbsp;|&nbsp;
              Data: <strong>{new Date(detalhe.data).toLocaleDateString("pt-BR")}</strong> &nbsp;|&nbsp;
              Status: <strong>{statusLabel(detalhe.status).label}</strong>
            </p>
            <p className="req-detalhe-info">
              Liberado por: <strong>{detalhe.aprovadoPor ?? "-"}</strong>
            </p>
            <p className="req-detalhe-info">
              Assinado por: <strong>{detalhe.criadoPor ?? "-"}</strong>
            </p>
            {detalhe.observacoes && <p className="req-obs">Obs: {detalhe.observacoes}</p>}
            <table className="req-tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Qtd Solicitada</th>
                  <th>Qtd Atendida</th>
                </tr>
              </thead>
              <tbody>
                {(detalhe.itens ?? []).map((it) => (
                  <tr key={it.id}>
                    <td>{it.produtoNome ?? it.produto?.nome ?? it.produtoId}</td>
                    <td>{it.quantidadeSolicitada}</td>
                    <td>{it.quantidadeAtendida ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="modal-acoes">
              {isAdmin && (detalhe.status === "PENDENTE" || detalhe.status === 1) && (
                <>
                  <button className="btn-aprovar" onClick={() => abrirAprovar(detalhe)}>
                    Aprovar
                  </button>
                  <button className="btn-cancelar-req" onClick={() => cancelar(detalhe.id)}>
                    Cancelar
                  </button>
                </>
              )}
              <button
                className="btn-print"
                type="button"
                onClick={() => exportarRequisicaoDetalhePdf(detalhe, sessao?.nome)}
              >
                Exportar PDF
              </button>
              <button
                className="btn-print"
                type="button"
                onClick={() => imprimirRequisicaoDetalhePdf(detalhe, sessao?.nome)}
              >
                Imprimir dados
              </button>
              <button className="btn-cancelar" onClick={() => setDetalhe(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal aprovação */}
      {aprovando && (
        <div className="modal-overlay">
          <div className="modal-box modal-lg">
            <h3>Aprovar Requisição #{aprovando.id}</h3>
            <p className="req-detalhe-info">Informe as quantidades a atender:</p>
            <table className="req-tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Solicitado</th>
                  <th>Atender</th>
                </tr>
              </thead>
              <tbody>
                {(aprovando.itens ?? []).map((it) => (
                  <tr key={it.id}>
                    <td>{it.produtoNome ?? it.produto?.nome ?? it.produtoId}</td>
                    <td>{it.quantidadeSolicitada}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max={it.quantidadeSolicitada}
                        value={qtdsAprovadas[it.id] ?? it.quantidadeSolicitada}
                        onChange={(e) =>
                          setQtdsAprovadas((prev) => ({ ...prev, [it.id]: e.target.value }))
                        }
                        className="input-qtd-aprovar"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {erroAprovar && <p className="req-erro-form">{erroAprovar}</p>}
            <div className="modal-acoes">
              <button className="btn-aprovar" onClick={confirmarAprovar}>
                Confirmar Aprovação
              </button>
              <button className="btn-cancelar" onClick={() => setAprovando(null)}>
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nova requisição */}
      {modalAberto && (
        <div className="modal-overlay">
          <div className="modal-box modal-lg">
            <h3>Nova Requisição</h3>
            <form onSubmit={salvar} className="req-form">
              {isAdmin ? (
                <>
                  <label>
                    Solicitante (colaborador de estoque) *
                    <select
                      name="solicitanteId"
                      value={form.solicitanteId}
                      onChange={handleForm}
                      required
                    >
                      <option value="">Selecione...</option>
                      {colaboradoresEstoque.map((c) => {
                        const id = c.id ?? c.Id;
                        const nome = c.nome ?? c.Nome;
                        const tipo = c.tipo ?? c.Tipo;
                        return (
                          <option key={id} value={id}>
                            {nome} ({tipoSolicitanteLabel(tipo)})
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label>
                    Assinatura do admin
                    <input type="text" value={sessao?.nome ?? "Admin"} disabled />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Solicitante *
                    <input type="text" name="solicitante" value={form.solicitante} onChange={handleForm} required />
                  </label>
                  <label>
                    Perfil do Solicitante *
                    <select
                      name="tipoSolicitante"
                      value={form.tipoSolicitante}
                      onChange={handleForm}
                      required
                    >
                      <option value="AUXILIAR_ESTOQUE">Auxiliar de Estoque</option>
                      <option value="ESTOQUISTA">Estoquista</option>
                    </select>
                  </label>
                </>
              )}
              <label>
                Observações
                <input type="text" name="observacoes" value={form.observacoes} onChange={handleForm} />
              </label>

              <div className="req-itens-header">
                <span>Itens</span>
                <button type="button" className="btn-add-item" onClick={adicionarItem}>
                  + Item
                </button>
              </div>

              {itens.map((it, i) => (
                <div key={i} className="req-item-row">
                  <select
                    value={it.produtoId}
                    onChange={(e) => handleItem(i, "produtoId", e.target.value)}
                  >
                    <option value="">Produto...</option>
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} (Estoque: {p.estoque})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    placeholder="Qtd"
                    value={it.quantidadeSolicitada}
                    onChange={(e) => handleItem(i, "quantidadeSolicitada", e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-remover-item"
                    onClick={() => removerItem(i)}
                    disabled={itens.length === 1}
                  >
                    ✕
                  </button>
                </div>
              ))}

              {erroForm && <p className="req-erro-form">{erroForm}</p>}
              <div className="modal-acoes">
                <button type="submit" className="btn-salvar" disabled={salvando}>
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
                <button type="button" className="btn-cancelar" onClick={fecharModal}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Requisicoes;
