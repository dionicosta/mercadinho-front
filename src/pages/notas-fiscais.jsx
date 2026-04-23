import { useEffect, useState, useCallback } from "react";
import api from "../services/api";
import { exportarNotaFiscalDetalhePdf, exportarNotasFiscaisPdf } from "../services/pdf-export";
import "./notas-fiscais.css";

const ITEM_VAZIO = { produtoId: "", quantidade: 1, precoUnitario: "" };

function NotasFiscais({ sessao }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [detalhe, setDetalhe] = useState(null); // NF selecionada para ver detalhes
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({ numero: "", dataEmissao: "", fornecedorId: "", observacoes: "" });
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }]);
  const [fornecedores, setFornecedores] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState(null);
  const [filtroNumero, setFiltroNumero] = useState("");
  const [filtroFornecedor, setFiltroFornecedor] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [respNF, respForn, respProd] = await Promise.all([
        api.get("/notas-fiscais"),
        api.get("/fornecedores"),
        api.get("/produtos"),
      ]);
      setLista(respNF.data);
      setFornecedores(respForn.data.filter((f) => f.ativo));
      setProdutos(respProd.data);
    } catch {
      setErro("Falha ao carregar notas fiscais.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirNovo() {
    setForm({ numero: "", dataEmissao: new Date().toISOString().slice(0, 10), fornecedorId: "", observacoes: "" });
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
    if (!form.numero.trim() || !form.fornecedorId) {
      setErroForm("Número e Fornecedor são obrigatórios.");
      return;
    }
    const itensValidos = itens.filter((it) => it.produtoId && it.quantidade > 0);
    if (itensValidos.length === 0) {
      setErroForm("Adicione ao menos um item com produto e quantidade.");
      return;
    }
    setSalvando(true);
    setErroForm(null);
    try {
      await api.post("/notas-fiscais", {
        numero: form.numero,
        dataEmissao: form.dataEmissao,
        fornecedorId: parseInt(form.fornecedorId),
        observacoes: form.observacoes,
        itens: itensValidos.map((it) => ({
          produtoId: parseInt(it.produtoId),
          quantidade: parseInt(it.quantidade),
          precoUnitario: parseFloat(it.precoUnitario) || 0,
        })),
      });
      fecharModal();
      carregar();
    } catch (err) {
      setErroForm(
        err?.response?.data?.message || err?.response?.data || "Erro ao criar nota fiscal."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function verDetalhe(id) {
    try {
      const resp = await api.get(`/notas-fiscais/${id}`);
      setDetalhe(resp.data);
    } catch {
      alert("Erro ao carregar detalhes da nota fiscal.");
    }
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

  const listaFiltrada = lista.filter((nf) => {
    const numero = (nf.numero || "").toString().toLowerCase();
    const fornecedor = (nf.fornecedor?.razaoSocial || "").toString().toLowerCase();

    const okNumero = !filtroNumero.trim() || numero.includes(filtroNumero.trim().toLowerCase());
    const okFornecedor = !filtroFornecedor.trim() || fornecedor.includes(filtroFornecedor.trim().toLowerCase());
    const okData = filtrarPorPeriodo(nf.dataEmissao);

    return okNumero && okFornecedor && okData;
  });

  function limparFiltros() {
    setFiltroNumero("");
    setFiltroFornecedor("");
    setFiltroDataInicio("");
    setFiltroDataFim("");
  }

  return (
    <div className="nf-container">
      <div className="nf-header">
        <h2 className="nf-titulo">Notas Fiscais</h2>
        <div className="nf-header-acoes">
          <button className="btn-print" onClick={() => exportarNotasFiscaisPdf(listaFiltrada, sessao?.nome)}>
            Exportar PDF
          </button>
          <button className="btn-novo" onClick={abrirNovo}>
            + Nova Nota Fiscal
          </button>
        </div>
      </div>

      <div className="nf-filtros">
        <input
          type="text"
          className="nf-filtro-input"
          placeholder="Filtrar por número"
          value={filtroNumero}
          onChange={(e) => setFiltroNumero(e.target.value)}
        />
        <input
          type="text"
          className="nf-filtro-input"
          placeholder="Filtrar por fornecedor"
          value={filtroFornecedor}
          onChange={(e) => setFiltroFornecedor(e.target.value)}
        />
        <input
          type="date"
          className="nf-filtro-input"
          value={filtroDataInicio}
          onChange={(e) => setFiltroDataInicio(e.target.value)}
        />
        <input
          type="date"
          className="nf-filtro-input"
          value={filtroDataFim}
          onChange={(e) => setFiltroDataFim(e.target.value)}
        />
        <button type="button" className="btn-print" onClick={limparFiltros}>
          Limpar filtros
        </button>
      </div>

      {loading && <p className="nf-loading">Carregando...</p>}
      {erro && <p className="nf-erro">{erro}</p>}

      {!loading && !erro && listaFiltrada.length === 0 && (
        <p className="nf-vazio">Nenhuma nota fiscal encontrada para os filtros aplicados.</p>
      )}

      {!loading && listaFiltrada.length > 0 && (
        <table className="nf-tabela">
          <thead>
            <tr>
              <th>Número</th>
              <th>Data Emissão</th>
              <th>Fornecedor</th>
              <th>Valor Total</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.map((nf) => (
              <tr key={nf.id}>
                <td>{nf.numero}</td>
                <td>{new Date(nf.dataEmissao).toLocaleDateString("pt-BR")}</td>
                <td>{nf.fornecedor?.razaoSocial ?? nf.fornecedorId}</td>
                <td>
                  {(nf.valorTotal ?? 0).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </td>
                <td>
                  <button className="btn-detalhe" onClick={() => verDetalhe(nf.id)}>
                    Ver Itens
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal detalhe NF */}
      {detalhe && (
        <div className="modal-overlay">
          <div className="modal-box modal-lg">
            <h3>Nota Fiscal #{detalhe.numero}</h3>
            <p className="nf-detalhe-info">
              Fornecedor: <strong>{detalhe.fornecedor?.razaoSocial}</strong> &nbsp;|&nbsp;
              Emissão: <strong>{new Date(detalhe.dataEmissao).toLocaleDateString("pt-BR")}</strong>
            </p>
            {detalhe.observacoes && <p className="nf-detalhe-obs">Obs: {detalhe.observacoes}</p>}
            <table className="nf-tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Quantidade</th>
                  <th>Preço Unit.</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(detalhe.itens ?? []).map((it) => (
                  <tr key={it.id}>
                    <td>{it.produto?.nome ?? it.produtoId}</td>
                    <td>{it.quantidade}</td>
                    <td>
                      {(it.precoUnitario ?? 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td>
                      {((it.precoUnitario ?? 0) * it.quantidade).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="nf-total-detalhe">
              Total:{" "}
              <strong>
                {(detalhe.valorTotal ?? 0).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </strong>
            </div>
            <div className="modal-acoes">
              <button
                className="btn-print"
                type="button"
                onClick={() => exportarNotaFiscalDetalhePdf(detalhe, sessao?.nome)}
              >
                Exportar PDF
              </button>
              <button className="btn-cancelar" onClick={() => setDetalhe(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nova NF */}
      {modalAberto && (
        <div className="modal-overlay">
          <div className="modal-box modal-lg">
            <h3>Nova Nota Fiscal</h3>
            <form onSubmit={salvar} className="nf-form">
              <div className="nf-form-row">
                <label>
                  Número *
                  <input type="text" name="numero" value={form.numero} onChange={handleForm} required />
                </label>
                <label>
                  Data de Emissão
                  <input type="date" name="dataEmissao" value={form.dataEmissao} onChange={handleForm} />
                </label>
              </div>
              <label>
                Fornecedor *
                <select name="fornecedorId" value={form.fornecedorId} onChange={handleForm} required>
                  <option value="">Selecione...</option>
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.razaoSocial}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Observações
                <input type="text" name="observacoes" value={form.observacoes} onChange={handleForm} />
              </label>

              <div className="nf-itens-header">
                <span>Itens</span>
                <button type="button" className="btn-add-item" onClick={adicionarItem}>
                  + Item
                </button>
              </div>

              {itens.map((it, i) => (
                <div key={i} className="nf-item-row">
                  <select
                    value={it.produtoId}
                    onChange={(e) => handleItem(i, "produtoId", e.target.value)}
                  >
                    <option value="">Produto...</option>
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    placeholder="Qtd"
                    value={it.quantidade}
                    onChange={(e) => handleItem(i, "quantidade", e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Preço unit."
                    value={it.precoUnitario}
                    onChange={(e) => handleItem(i, "precoUnitario", e.target.value)}
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

              {erroForm && <p className="nf-erro-form">{erroForm}</p>}
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

export default NotasFiscais;
