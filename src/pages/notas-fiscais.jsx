import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import api, { extrairErro } from "../services/api";
import {
  exportarNotaFiscalDetalhePdf,
  exportarNotasFiscaisPdf,
  imprimirNotaFiscalDetalhePdf,
  imprimirNotasFiscaisPdf
} from "../services/pdf-export";
import "./notas-fiscais.css";
import "./rede.css";

const ITEM_VAZIO = { produtoId: "", quantidade: 1, precoUnitario: "" };
const FORM_VAZIO = { numero: "", serie: "", chaveAcesso: "", dataEmissao: "", fornecedorId: "", observacoes: "", valorFrete: "", valorDesconto: "", valorOutrasDespesas: "" };
const NOVO = "novo";

const STATUS = {
  PENDENTE_CONFERENCIA: { rotulo: "Aguardando conferência", classe: "rd-badge-amarelo" },
  LANCADA: { rotulo: "Lançada", classe: "rd-badge-verde" },
  CANCELADA: { rotulo: "Cancelada", classe: "rd-badge-vermelho" },
};

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function numero(valor, casas = 4) {
  return Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: casas });
}

function formatarChave(chave) {
  return (chave || "").replace(/(\d{4})(?=\d)/g, "$1 ");
}

function NotasFiscais({ sessao }) {
  const [parametros, setParametros] = useSearchParams();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [fornecedores, setFornecedores] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [filtroNumero, setFiltroNumero] = useState("");
  const [filtroFornecedor, setFiltroFornecedor] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  // lancamento manual
  const [modalManual, setModalManual] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }]);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState(null);

  // importacao de XML
  const arquivoRef = useRef(null);
  const [previa, setPrevia] = useState(null);
  const [origem, setOrigem] = useState(null); // { xml } ou { documentoId }
  const [vinculos, setVinculos] = useState({});
  const [erroImportacao, setErroImportacao] = useState(null);
  const [importando, setImportando] = useState(false);

  // detalhe / conferencia / devolucao
  const [detalhe, setDetalhe] = useState(null);
  const [conferidas, setConferidas] = useState({});
  const [erroDetalhe, setErroDetalhe] = useState(null);
  const [devolucao, setDevolucao] = useState(null); // { motivo, numeroNotaDevolucao, quantidades }

  const podeCancelar = !!sessao?.isPrincipal;

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
    } catch (err) {
      setErro(extrairErro(err, "Falha ao carregar notas fiscais."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Chegando da tela da SEFAZ com um documento escolhido: abre a previa dele.
  const documentoParam = parametros.get("documento");
  useEffect(() => {
    if (!documentoParam) return;
    abrirPrevia({ documentoId: Number(documentoParam) });
    setParametros({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentoParam]);

  // ---------------- importacao ----------------

  async function abrirPrevia(novaOrigem) {
    setErro(null);
    setErroImportacao(null);
    try {
      const resp = await api.post("/notas-fiscais/importar/previa", novaOrigem);
      const iniciais = {};
      resp.data.itens.forEach((it) => {
        iniciais[it.numeroItem] = {
          produtoId: it.sugestao?.produtoId ? String(it.sugestao.produtoId) : "",
          fator: String(it.sugestao?.fator ?? 1),
          nome: it.descricao,
          secao: "",
          preco: "",
        };
      });
      setVinculos(iniciais);
      setOrigem(novaOrigem);
      setPrevia(resp.data);
    } catch (err) {
      setErro(extrairErro(err, "Não foi possível ler a nota fiscal."));
    }
  }

  async function aoEscolherArquivo(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    if (arquivo.size > 3_000_000) {
      setErro("Arquivo muito grande para ser uma NF-e.");
      return;
    }
    await abrirPrevia({ xml: await arquivo.text() });
  }

  function alterarVinculo(numeroItem, campo, valor) {
    setVinculos((prev) => ({ ...prev, [numeroItem]: { ...prev[numeroItem], [campo]: valor } }));
  }

  function unidadesDoItem(item) {
    const fator = Number(String(vinculos[item.numeroItem]?.fator ?? "1").replace(",", "."));
    return item.quantidade * (Number.isFinite(fator) ? fator : 0);
  }

  async function confirmarImportacao(lancarAgora) {
    setErroImportacao(null);
    const itensEnvio = [];
    for (const item of previa.itens) {
      const v = vinculos[item.numeroItem] || {};
      const fator = Number(String(v.fator || "1").replace(",", "."));
      const unidades = item.quantidade * fator;
      if (!v.produtoId) {
        setErroImportacao(`Item ${item.numeroItem}: escolha o produto do catálogo.`);
        return;
      }
      if (!(fator > 0) || Math.abs(unidades - Math.round(unidades)) > 0.0001 || unidades < 1) {
        setErroImportacao(`Item ${item.numeroItem}: ${numero(item.quantidade)} ${item.unidade} × fator ${v.fator} precisa resultar em um número inteiro de unidades.`);
        return;
      }
      if (v.produtoId === NOVO) {
        if (!v.nome?.trim() || !(Number(v.secao) > 0)) {
          setErroImportacao(`Item ${item.numeroItem}: informe o nome e a seção do novo produto.`);
          return;
        }
        itensEnvio.push({
          numeroItem: item.numeroItem,
          fatorConversao: fator,
          criarProduto: true,
          nomeNovoProduto: v.nome.trim(),
          secaoIdNovoProduto: Number(v.secao),
          precoVendaNovoProduto: Number(String(v.preco || "0").replace(",", ".")) || 0,
        });
      } else {
        itensEnvio.push({ numeroItem: item.numeroItem, produtoId: Number(v.produtoId), fatorConversao: fator });
      }
    }

    setImportando(true);
    try {
      const resp = await api.post("/notas-fiscais/importar", { ...origem, lancarAgora, itens: itensEnvio });
      setPrevia(null);
      setOrigem(null);
      await carregar();
      if (!lancarAgora) verDetalhe(resp.data.id);
    } catch (err) {
      setErroImportacao(extrairErro(err, "Erro ao importar a nota fiscal."));
    } finally {
      setImportando(false);
    }
  }

  // ---------------- lancamento manual ----------------

  function abrirManual() {
    setForm({ ...FORM_VAZIO, dataEmissao: new Date().toISOString().slice(0, 10) });
    setItens([{ ...ITEM_VAZIO }]);
    setErroForm(null);
    setModalManual(true);
  }

  function handleForm(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleItem(index, field, value) {
    setItens((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  async function salvarManual(e) {
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
        serie: form.serie,
        chaveAcesso: form.chaveAcesso,
        dataEmissao: form.dataEmissao,
        fornecedorId: parseInt(form.fornecedorId),
        observacoes: form.observacoes,
        valorFrete: parseFloat(form.valorFrete) || 0,
        valorDesconto: parseFloat(form.valorDesconto) || 0,
        valorOutrasDespesas: parseFloat(form.valorOutrasDespesas) || 0,
        itens: itensValidos.map((it) => ({
          produtoId: parseInt(it.produtoId),
          quantidade: parseInt(it.quantidade),
          precoUnitario: parseFloat(it.precoUnitario) || 0,
        })),
      });
      setModalManual(false);
      carregar();
    } catch (err) {
      setErroForm(extrairErro(err, "Erro ao criar nota fiscal."));
    } finally {
      setSalvando(false);
    }
  }

  // ---------------- detalhe ----------------

  async function verDetalhe(id) {
    setErroDetalhe(null);
    setDevolucao(null);
    try {
      const resp = await api.get(`/notas-fiscais/${id}`);
      const iniciais = {};
      resp.data.itens.forEach((it) => {
        iniciais[it.id] = String(it.quantidadeConferida ?? it.quantidade);
      });
      setConferidas(iniciais);
      setDetalhe(resp.data);
    } catch (err) {
      setErro(extrairErro(err, "Erro ao carregar detalhes da nota fiscal."));
    }
  }

  async function lancar() {
    setErroDetalhe(null);
    try {
      await api.post(`/notas-fiscais/${detalhe.id}/lancar`, {
        itens: detalhe.itens.map((it) => ({ itemId: it.id, quantidadeConferida: parseInt(conferidas[it.id]) || 0 })),
      });
      await carregar();
      await verDetalhe(detalhe.id);
    } catch (err) {
      setErroDetalhe(extrairErro(err, "Erro ao lançar a nota."));
    }
  }

  async function cancelar() {
    const aviso = detalhe.status === "LANCADA"
      ? "Motivo do cancelamento (a entrada no estoque será desfeita):"
      : "Motivo do cancelamento:";
    const motivo = window.prompt(aviso);
    if (!motivo) return;
    setErroDetalhe(null);
    try {
      await api.post(`/notas-fiscais/${detalhe.id}/cancelar`, { motivo });
      await carregar();
      await verDetalhe(detalhe.id);
    } catch (err) {
      setErroDetalhe(extrairErro(err, "Erro ao cancelar a nota."));
    }
  }

  async function confirmarDevolucao(e) {
    e.preventDefault();
    setErroDetalhe(null);
    const itensDevolucao = Object.entries(devolucao.quantidades)
      .map(([itemId, qtd]) => ({ itemId: Number(itemId), quantidade: parseInt(qtd) || 0 }))
      .filter((i) => i.quantidade > 0);
    if (itensDevolucao.length === 0) {
      setErroDetalhe("Informe a quantidade a devolver em ao menos um item.");
      return;
    }
    try {
      await api.post(`/notas-fiscais/${detalhe.id}/devolucoes`, {
        motivo: devolucao.motivo,
        numeroNotaDevolucao: devolucao.numeroNotaDevolucao,
        itens: itensDevolucao,
      });
      await carregar();
      await verDetalhe(detalhe.id);
    } catch (err) {
      setErroDetalhe(extrairErro(err, "Erro ao registrar a devolução."));
    }
  }

  async function baixarXml() {
    try {
      const resp = await api.get(`/notas-fiscais/${detalhe.id}/xml`, { responseType: "blob" });
      const url = URL.createObjectURL(resp.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `NFe${detalhe.chaveAcesso || detalhe.numero}.xml`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErroDetalhe(extrairErro(err, "Erro ao baixar o XML."));
    }
  }

  // ---------------- lista ----------------

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
    const num = (nf.numero || "").toString().toLowerCase();
    const fornecedor = (nf.fornecedor?.razaoSocial || "").toString().toLowerCase();

    const okNumero = !filtroNumero.trim() || num.includes(filtroNumero.trim().toLowerCase());
    const okFornecedor = !filtroFornecedor.trim() || fornecedor.includes(filtroFornecedor.trim().toLowerCase());
    const okStatus = filtroStatus === "TODOS" || nf.status === filtroStatus;
    const okData = filtrarPorPeriodo(nf.dataEmissao);

    return okNumero && okFornecedor && okStatus && okData;
  });

  function limparFiltros() {
    setFiltroNumero("");
    setFiltroFornecedor("");
    setFiltroStatus("TODOS");
    setFiltroDataInicio("");
    setFiltroDataFim("");
  }

  const pendentes = lista.filter((nf) => nf.status === "PENDENTE_CONFERENCIA").length;

  return (
    <div className="nf-container">
      <div className="nf-header">
        <h2 className="nf-titulo">Notas Fiscais de Entrada</h2>
        <div className="nf-header-acoes">
          <button className="btn-print" onClick={() => exportarNotasFiscaisPdf(listaFiltrada, sessao?.nome)}>
            Exportar PDF
          </button>
          <button className="btn-print" onClick={() => imprimirNotasFiscaisPdf(listaFiltrada, sessao?.nome)}>
            Imprimir dados
          </button>
          <button className="btn-print" onClick={abrirManual}>
            + Nota manual
          </button>
          <button className="btn-novo" onClick={() => arquivoRef.current?.click()}>
            Importar XML da NF-e
          </button>
          <input ref={arquivoRef} type="file" accept=".xml,text/xml,application/xml" style={{ display: "none" }} onChange={aoEscolherArquivo} />
        </div>
      </div>

      {pendentes > 0 && (
        <p className="rd-ajuda" style={{ marginBottom: 12 }}>
          ⚠ {pendentes} nota(s) aguardando conferência: a mercadoria só entra no estoque depois de conferida.
        </p>
      )}

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
        <select className="nf-filtro-input" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="TODOS">Todos os status</option>
          {Object.entries(STATUS).map(([chave, st]) => (
            <option key={chave} value={chave}>{st.rotulo}</option>
          ))}
        </select>
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
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.map((nf) => {
              const st = STATUS[nf.status] ?? { rotulo: nf.status, classe: "" };
              return (
                <tr key={nf.id}>
                  <td>
                    {nf.numero}{nf.serie ? ` / ${nf.serie}` : ""}
                    {nf.origem !== "MANUAL" && <span className="rd-ajuda"> · NF-e</span>}
                  </td>
                  <td>{new Date(nf.dataEmissao).toLocaleDateString("pt-BR")}</td>
                  <td>{nf.fornecedor?.razaoSocial ?? nf.fornecedorId}</td>
                  <td>{moeda(nf.valorTotal)}</td>
                  <td>
                    <span className={`rd-badge ${st.classe}`}>{st.rotulo}</span>
                    {nf.temDivergencia && <span className="rd-badge rd-badge-amarelo" style={{ marginLeft: 6 }}>divergência</span>}
                  </td>
                  <td>
                    <button className="btn-detalhe" onClick={() => verDetalhe(nf.id)}>
                      {nf.status === "PENDENTE_CONFERENCIA" ? "Conferir" : "Ver Itens"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Previa da importacao */}
      {previa && (
        <div className="rd-modal-fundo">
          <div className="rd-modal" style={{ maxWidth: 1040 }}>
            <h3>Importar NF-e {previa.numero} / {previa.serie}</h3>
            <p className="rd-ajuda">
              Emitente: <strong>{previa.emitente.nome}</strong> ({previa.emitente.documento}) ·
              Emissão: <strong>{new Date(previa.dataEmissao).toLocaleDateString("pt-BR")}</strong> ·
              Total: <strong>{moeda(previa.totais.valorTotal)}</strong>
            </p>
            <p className="rd-ajuda" style={{ wordBreak: "break-all" }}>Chave: {formatarChave(previa.chave)}</p>
            {!previa.fornecedor && <p className="rd-ajuda">Este fornecedor ainda não está cadastrado: será criado na importação.</p>}
            {previa.avisos.map((aviso) => (
              <p key={aviso} className="rd-erro">⚠ {aviso}</p>
            ))}
            {previa.bloqueio && <p className="rd-erro"><strong>{previa.bloqueio}</strong></p>}

            <div className="rd-tabela-wrap" style={{ marginTop: 12 }}>
              <table className="rd-tabela">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item na nota</th>
                    <th className="rd-num">Qtd.</th>
                    <th className="rd-num">Custo total</th>
                    <th>Produto do catálogo</th>
                    <th>Fator</th>
                    <th className="rd-num">Entra no estoque</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.itens.map((it) => {
                    const v = vinculos[it.numeroItem] || {};
                    const unidades = unidadesDoItem(it);
                    return (
                      <tr key={it.numeroItem}>
                        <td>{it.numeroItem}</td>
                        <td>
                          {it.descricao}
                          <div className="rd-ajuda">
                            cód. {it.codigo}{it.codigoBarras ? ` · EAN ${it.codigoBarras}` : ""}{it.ncm ? ` · NCM ${it.ncm}` : ""}
                          </div>
                        </td>
                        <td className="rd-num">{numero(it.quantidade)} {it.unidade}</td>
                        <td className="rd-num">{moeda(it.custoTotal)}</td>
                        <td>
                          <select className="rd-input" style={{ maxWidth: 240 }} value={v.produtoId ?? ""} onChange={(e) => alterarVinculo(it.numeroItem, "produtoId", e.target.value)}>
                            <option value="">Escolher...</option>
                            {previa.podeCriarProduto && <option value={NOVO}>+ Cadastrar como produto novo</option>}
                            {produtos.map((p) => (
                              <option key={p.id} value={p.id}>{p.nome}</option>
                            ))}
                          </select>
                          {it.sugestao?.produtoId && String(it.sugestao.produtoId) === v.produtoId && (
                            <div className="rd-ajuda">sugerido por {it.sugestao.origem}</div>
                          )}
                          {v.produtoId === NOVO && (
                            <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                              <input className="rd-input" placeholder="Nome do produto" maxLength={200} value={v.nome ?? ""} onChange={(e) => alterarVinculo(it.numeroItem, "nome", e.target.value)} />
                              <div style={{ display: "flex", gap: 6 }}>
                                <input className="rd-input" style={{ width: 90 }} placeholder="Seção (Id)" value={v.secao ?? ""} onChange={(e) => alterarVinculo(it.numeroItem, "secao", e.target.value)} />
                                <input className="rd-input" style={{ width: 130 }} placeholder="Preço de venda" value={v.preco ?? ""} onChange={(e) => alterarVinculo(it.numeroItem, "preco", e.target.value)} />
                              </div>
                            </div>
                          )}
                        </td>
                        <td>
                          <input className="rd-input" style={{ width: 70 }} value={v.fator ?? "1"} onChange={(e) => alterarVinculo(it.numeroItem, "fator", e.target.value)} title={`Quantas unidades de estoque há em 1 ${it.unidade}`} />
                        </td>
                        <td className="rd-num">
                          {numero(unidades)} un
                          {unidades > 0 && <div className="rd-ajuda">{moeda(it.custoTotal / unidades)} / un</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="rd-ajuda" style={{ marginTop: 8 }}>
              Fator: quantas unidades de estoque há em uma unidade da nota (ex.: caixa com 12 = fator 12). O custo inclui frete, IPI e ICMS-ST e abate descontos.
              O vínculo fica memorizado para as próximas notas deste fornecedor.
            </p>

            {erroImportacao && <p className="rd-erro">{erroImportacao}</p>}
            <div className="rd-modal-acoes">
              <button className="rd-btn rd-btn-primario" disabled={importando || !!previa.bloqueio} onClick={() => confirmarImportacao(false)}>
                Importar e conferir depois
              </button>
              <button className="rd-btn rd-btn-sucesso" disabled={importando || !!previa.bloqueio} onClick={() => confirmarImportacao(true)}>
                Importar e dar entrada agora
              </button>
              <button className="rd-btn" onClick={() => { setPrevia(null); setOrigem(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Detalhe / conferencia */}
      {detalhe && (
        <div className="rd-modal-fundo">
          <div className="rd-modal" style={{ maxWidth: 1000 }}>
            <h3>
              Nota Fiscal #{detalhe.numero}{detalhe.serie ? ` / ${detalhe.serie}` : ""}{" "}
              <span className={`rd-badge ${(STATUS[detalhe.status] ?? {}).classe ?? ""}`}>{(STATUS[detalhe.status] ?? {}).rotulo ?? detalhe.status}</span>
            </h3>
            <p className="nf-detalhe-info">
              Fornecedor: <strong>{detalhe.fornecedor?.razaoSocial}</strong>{detalhe.fornecedor?.cnpj ? ` (${detalhe.fornecedor.cnpj})` : ""} &nbsp;|&nbsp;
              Emissão: <strong>{new Date(detalhe.dataEmissao).toLocaleDateString("pt-BR")}</strong>
            </p>
            {detalhe.chaveAcesso && (
              <p className="rd-ajuda" style={{ wordBreak: "break-all" }}>
                Chave: {formatarChave(detalhe.chaveAcesso)}{detalhe.protocoloAutorizacao ? ` · Protocolo ${detalhe.protocoloAutorizacao}` : ""}
              </p>
            )}
            {detalhe.observacoes && <p className="nf-detalhe-obs">Obs: {detalhe.observacoes}</p>}
            {detalhe.status === "CANCELADA" && (
              <p className="rd-erro">Cancelada por {detalhe.canceladaPor} em {new Date(detalhe.canceladaEm).toLocaleString("pt-BR")}: {detalhe.motivoCancelamento}</p>
            )}
            {detalhe.status === "PENDENTE_CONFERENCIA" && (
              <p className="rd-ajuda">Confira a mercadoria e ajuste a coluna "Chegou" se algo veio diferente da nota. O estoque só muda ao dar entrada.</p>
            )}

            <div className="rd-tabela-wrap">
              <table className="rd-tabela">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="rd-num">Na nota</th>
                    <th className="rd-num">Unid. estoque</th>
                    <th className="rd-num">Chegou</th>
                    <th className="rd-num">Devolvido</th>
                    <th className="rd-num">Custo unit.</th>
                    <th className="rd-num">Total</th>
                    {devolucao && <th>Devolver</th>}
                  </tr>
                </thead>
                <tbody>
                  {(detalhe.itens ?? []).map((it) => {
                    const divergente = it.quantidadeConferida != null && it.quantidadeConferida !== it.quantidade;
                    const disponivel = (it.quantidadeConferida ?? it.quantidade) - it.quantidadeDevolvida;
                    return (
                      <tr key={it.id}>
                        <td>
                          {it.produto?.nome ?? it.produtoId}
                          {it.descricaoFornecedor && <div className="rd-ajuda">{it.descricaoFornecedor}</div>}
                        </td>
                        <td className="rd-num">{numero(it.quantidadeComercial)} {it.unidadeComercial}</td>
                        <td className="rd-num">{it.quantidade}</td>
                        <td className={`rd-num ${divergente ? "rd-alerta" : ""}`}>
                          {detalhe.status === "PENDENTE_CONFERENCIA" ? (
                            <input
                              className="rd-input"
                              type="number"
                              min="0"
                              style={{ width: 90 }}
                              value={conferidas[it.id] ?? ""}
                              onChange={(e) => setConferidas((prev) => ({ ...prev, [it.id]: e.target.value }))}
                            />
                          ) : (it.quantidadeConferida ?? "—")}
                        </td>
                        <td className="rd-num">{it.quantidadeDevolvida || "—"}</td>
                        <td className="rd-num">{moeda(it.custoUnitario)}</td>
                        <td className="rd-num">{moeda(it.valorTotalItem)}</td>
                        {devolucao && (
                          <td>
                            <input
                              className="rd-input"
                              type="number"
                              min="0"
                              max={disponivel}
                              style={{ width: 80 }}
                              value={devolucao.quantidades[it.id] ?? ""}
                              onChange={(e) => setDevolucao((prev) => ({ ...prev, quantidades: { ...prev.quantidades, [it.id]: e.target.value } }))}
                              title={`Até ${disponivel}`}
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="nf-total-detalhe">
              <span className="rd-ajuda">
                Produtos {moeda(detalhe.valorProdutos)}
                {detalhe.valorFrete > 0 && ` · Frete ${moeda(detalhe.valorFrete)}`}
                {detalhe.valorDesconto > 0 && ` · Desconto ${moeda(detalhe.valorDesconto)}`}
                {detalhe.valorIpi > 0 && ` · IPI ${moeda(detalhe.valorIpi)}`}
                {detalhe.valorIcmsSt > 0 && ` · ICMS-ST ${moeda(detalhe.valorIcmsSt)}`}
                {detalhe.valorOutrasDespesas > 0 && ` · Outras ${moeda(detalhe.valorOutrasDespesas)}`}
                {" · "}
              </span>
              Total: <strong>{moeda(detalhe.valorTotal)}</strong>
            </div>

            {(detalhe.devolucoes ?? []).length > 0 && (
              <div className="rd-ajuda" style={{ marginTop: 8 }}>
                <strong>Devoluções:</strong>
                {detalhe.devolucoes.map((d) => (
                  <div key={d.id}>
                    {new Date(d.criadoEm).toLocaleDateString("pt-BR")} · {d.itens.reduce((soma, i) => soma + i.quantidade, 0)} unidade(s) · {d.motivo}
                    {d.numeroNotaDevolucao ? ` · NF de devolução ${d.numeroNotaDevolucao}` : ""} · por {d.criadoPor}
                  </div>
                ))}
              </div>
            )}

            {devolucao && (
              <form className="rd-form" style={{ marginTop: 12 }} onSubmit={confirmarDevolucao}>
                <div className="rd-form-linha">
                  <label>
                    Motivo da devolução *
                    <input required minLength={5} maxLength={300} value={devolucao.motivo} onChange={(e) => setDevolucao((prev) => ({ ...prev, motivo: e.target.value }))} />
                  </label>
                  <label>
                    Nº da NF-e de devolução (emitida fora do sistema)
                    <input maxLength={60} value={devolucao.numeroNotaDevolucao} onChange={(e) => setDevolucao((prev) => ({ ...prev, numeroNotaDevolucao: e.target.value }))} />
                  </label>
                </div>
                <div className="rd-acoes">
                  <button type="submit" className="rd-btn rd-btn-primario">Confirmar devolução</button>
                  <button type="button" className="rd-btn" onClick={() => setDevolucao(null)}>Desistir</button>
                </div>
              </form>
            )}

            {erroDetalhe && <p className="rd-erro">{erroDetalhe}</p>}

            <div className="rd-modal-acoes" style={{ flexWrap: "wrap" }}>
              {detalhe.status === "PENDENTE_CONFERENCIA" && (
                <button className="rd-btn rd-btn-sucesso" onClick={lancar}>Dar entrada no estoque</button>
              )}
              {detalhe.status === "LANCADA" && !devolucao && (
                <button className="rd-btn" onClick={() => setDevolucao({ motivo: "", numeroNotaDevolucao: "", quantidades: {} })}>
                  Devolver ao fornecedor
                </button>
              )}
              {detalhe.status !== "CANCELADA" && podeCancelar && (
                <button className="rd-btn rd-btn-perigo" onClick={cancelar}>Cancelar nota</button>
              )}
              {detalhe.temXml && <button className="rd-btn" onClick={baixarXml}>Baixar XML</button>}
              <button className="rd-btn" type="button" onClick={() => exportarNotaFiscalDetalhePdf(detalhe, sessao?.nome)}>
                Exportar PDF
              </button>
              <button className="rd-btn" type="button" onClick={() => imprimirNotaFiscalDetalhePdf(detalhe, sessao?.nome)}>
                Imprimir
              </button>
              <button className="rd-btn" onClick={() => setDetalhe(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Lancamento manual */}
      {modalManual && (
        <div className="modal-overlay">
          <div className="modal-box modal-lg">
            <h3>Nova Nota Fiscal (manual)</h3>
            <p className="rd-ajuda" style={{ marginBottom: 10 }}>Se tiver o XML da NF-e, prefira "Importar XML": preenche tudo sozinho e evita lançar a mesma nota duas vezes.</p>
            <form onSubmit={salvarManual} className="nf-form">
              <div className="nf-form-row">
                <label>
                  Número *
                  <input type="text" name="numero" value={form.numero} onChange={handleForm} required />
                </label>
                <label>
                  Série
                  <input type="text" name="serie" maxLength={3} value={form.serie} onChange={handleForm} />
                </label>
                <label>
                  Data de Emissão
                  <input type="date" name="dataEmissao" value={form.dataEmissao} onChange={handleForm} />
                </label>
              </div>
              <label>
                Chave de acesso (44 dígitos, opcional)
                <input type="text" name="chaveAcesso" maxLength={60} value={form.chaveAcesso} onChange={handleForm} />
              </label>
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
              <div className="nf-form-row">
                <label>
                  Frete
                  <input type="number" min="0" step="0.01" name="valorFrete" value={form.valorFrete} onChange={handleForm} />
                </label>
                <label>
                  Outras despesas
                  <input type="number" min="0" step="0.01" name="valorOutrasDespesas" value={form.valorOutrasDespesas} onChange={handleForm} />
                </label>
                <label>
                  Desconto
                  <input type="number" min="0" step="0.01" name="valorDesconto" value={form.valorDesconto} onChange={handleForm} />
                </label>
              </div>
              <label>
                Observações
                <input type="text" name="observacoes" value={form.observacoes} onChange={handleForm} />
              </label>

              <div className="nf-itens-header">
                <span>Itens</span>
                <button type="button" className="btn-add-item" onClick={() => setItens((prev) => [...prev, { ...ITEM_VAZIO }])}>
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
                    onClick={() => setItens((prev) => prev.filter((_, idx) => idx !== i))}
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
                <button type="button" className="btn-cancelar" onClick={() => setModalManual(false)}>
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
