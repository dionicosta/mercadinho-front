import { useCallback, useEffect, useState } from "react";
import api, { extrairErro } from "../services/api";
import "./rede.css";

const ITEM_VAZIO = { produtoId: "", quantidade: 1 };

const STATUS = {
  SOLICITADA: { rotulo: "Solicitada", classe: "rd-badge-amarelo" },
  ENVIADA: { rotulo: "Em trânsito", classe: "rd-badge-azul" },
  RECEBIDA: { rotulo: "Recebida", classe: "rd-badge-verde" },
  CANCELADA: { rotulo: "Cancelada", classe: "rd-badge-vermelho" },
};

function formatarData(valor) {
  if (!valor) return "—";
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function Transferencias({ sessao }) {
  const lojaAtualId = sessao?.loja?.id;

  const [lista, setLista] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState("TODOS");

  const [modalNova, setModalNova] = useState(false);
  const [form, setForm] = useState({ direcao: "ENVIAR", outraLojaId: "", observacoes: "" });
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }]);
  const [erroForm, setErroForm] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const [detalhe, setDetalhe] = useState(null);
  const [enviando, setEnviando] = useState(null);
  const [qtdsEnvio, setQtdsEnvio] = useState({});
  const [erroEnvio, setErroEnvio] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [respT, respL, respP] = await Promise.all([
        api.get("/transferencias"),
        api.get("/lojas"),
        api.get("/produtos"),
      ]);
      setLista(respT.data || []);
      setLojas(respL.data || []);
      setProdutos(respP.data || []);
    } catch (err) {
      setErro(extrairErro(err, "Falha ao carregar transferências."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const outrasLojas = lojas.filter((l) => l.id !== lojaAtualId && l.ativa);
  const listaFiltrada = lista.filter((t) => filtroStatus === "TODOS" || t.status === filtroStatus);

  function abrirNova() {
    setForm({ direcao: "ENVIAR", outraLojaId: "", observacoes: "" });
    setItens([{ ...ITEM_VAZIO }]);
    setErroForm(null);
    setModalNova(true);
  }

  function alterarItem(indice, campo, valor) {
    setItens((prev) => prev.map((it, i) => (i === indice ? { ...it, [campo]: valor } : it)));
  }

  async function salvar(e) {
    e.preventDefault();
    if (!form.outraLojaId) {
      setErroForm("Selecione a outra loja.");
      return;
    }
    const itensValidos = itens.filter((it) => it.produtoId && Number(it.quantidade) > 0);
    if (itensValidos.length === 0) {
      setErroForm("Adicione ao menos um item com produto e quantidade.");
      return;
    }
    const enviar = form.direcao === "ENVIAR";
    setSalvando(true);
    setErroForm(null);
    try {
      await api.post("/transferencias", {
        lojaOrigemId: enviar ? lojaAtualId : Number(form.outraLojaId),
        lojaDestinoId: enviar ? Number(form.outraLojaId) : lojaAtualId,
        observacoes: form.observacoes,
        itens: itensValidos.map((it) => ({ produtoId: Number(it.produtoId), quantidade: Number(it.quantidade) })),
      });
      setModalNova(false);
      carregar();
    } catch (err) {
      setErroForm(extrairErro(err, "Erro ao criar transferência."));
    } finally {
      setSalvando(false);
    }
  }

  function abrirEnvio(t) {
    const qtds = {};
    t.itens.forEach((it) => {
      qtds[it.id] = it.quantidadeSolicitada;
    });
    setQtdsEnvio(qtds);
    setErroEnvio(null);
    setEnviando(t);
  }

  async function confirmarEnvio() {
    setErroEnvio(null);
    try {
      await api.post(`/transferencias/${enviando.id}/enviar`, {
        itens: Object.entries(qtdsEnvio).map(([itemId, qtd]) => ({
          itemId: Number(itemId),
          quantidadeEnviada: Number(qtd) || 0,
        })),
      });
      setEnviando(null);
      setDetalhe(null);
      carregar();
    } catch (err) {
      setErroEnvio(extrairErro(err, "Erro ao enviar transferência."));
    }
  }

  async function executar(t, acao, pergunta) {
    if (!window.confirm(pergunta)) return;
    setErro(null);
    try {
      await api.post(`/transferencias/${t.id}/${acao}`);
      setDetalhe(null);
      carregar();
    } catch (err) {
      setErro(extrairErro(err, "Não foi possível concluir a ação."));
    }
  }

  function estoqueDe(produtoId) {
    return produtos.find((p) => p.id === produtoId)?.estoque ?? 0;
  }

  function botoes(t) {
    return (
      <>
        {t.podeEnviar && (
          <button className="rd-btn rd-btn-pequeno rd-btn-primario" onClick={() => abrirEnvio(t)}>Enviar</button>
        )}
        {t.podeReceber && (
          <button
            className="rd-btn rd-btn-pequeno rd-btn-sucesso"
            onClick={() => executar(t, "receber", "Confirmar o recebimento? As quantidades enviadas entram no estoque desta loja.")}
          >
            Receber
          </button>
        )}
        {t.podeCancelar && (
          <button
            className="rd-btn rd-btn-pequeno rd-btn-perigo"
            onClick={() => executar(t, "cancelar", t.status === "ENVIADA"
              ? "Cancelar a transferência? O saldo enviado volta para a loja de origem."
              : "Cancelar o pedido de transferência?")}
          >
            Cancelar
          </button>
        )}
      </>
    );
  }

  return (
    <div className="rd-container">
      <div className="rd-header">
        <div>
          <h2 className="rd-titulo">Transferências entre Lojas</h2>
          <p className="rd-subtitulo">Envios e pedidos em que {sessao?.loja?.nome || "esta loja"} é origem ou destino.</p>
        </div>
        <button
          className="rd-btn rd-btn-primario"
          onClick={abrirNova}
          disabled={outrasLojas.length === 0}
          title={outrasLojas.length === 0 ? "A rede não tem outra loja ativa" : ""}
        >
          + Nova Transferência
        </button>
      </div>

      <div className="rd-filtros">
        <select className="rd-input" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="TODOS">Todos os status</option>
          {Object.entries(STATUS).map(([chave, s]) => (
            <option key={chave} value={chave}>{s.rotulo}</option>
          ))}
        </select>
        <button className="rd-btn" onClick={carregar}>Atualizar</button>
      </div>

      {loading && <p className="rd-vazio">Carregando...</p>}
      {erro && <p className="rd-erro">{erro}</p>}
      {!loading && !erro && listaFiltrada.length === 0 && <p className="rd-vazio">Nenhuma transferência encontrada.</p>}

      {!loading && listaFiltrada.length > 0 && (
        <div className="rd-tabela-wrap">
          <table className="rd-tabela">
            <thead>
              <tr>
                <th>#</th>
                <th>Origem</th>
                <th>Destino</th>
                <th>Status</th>
                <th>Solicitada em</th>
                <th>Itens</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map((t) => {
                const st = STATUS[t.status] ?? { rotulo: t.status, classe: "" };
                return (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>{t.lojaOrigem?.nome}</td>
                    <td>{t.lojaDestino?.nome}</td>
                    <td><span className={`rd-badge ${st.classe}`}>{st.rotulo}</span></td>
                    <td>{formatarData(t.solicitadoEm)}</td>
                    <td>{t.itens.length}</td>
                    <td>
                      <div className="rd-acoes">
                        <button className="rd-btn rd-btn-pequeno" onClick={() => setDetalhe(t)}>Detalhes</button>
                        {botoes(t)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detalhe && !enviando && (
        <div className="rd-modal-fundo">
          <div className="rd-modal rd-modal-largo">
            <h3>Transferência #{detalhe.id}</h3>
            <p className="rd-ajuda">
              {detalhe.lojaOrigem?.nome} → {detalhe.lojaDestino?.nome} · {(STATUS[detalhe.status] ?? {}).rotulo ?? detalhe.status}
            </p>
            <p className="rd-ajuda">
              Solicitada por {detalhe.solicitadoPor} em {formatarData(detalhe.solicitadoEm)}
              {detalhe.enviadoPor && <> · Enviada por {detalhe.enviadoPor} em {formatarData(detalhe.enviadoEm)}</>}
              {detalhe.recebidoPor && <> · Recebida por {detalhe.recebidoPor} em {formatarData(detalhe.recebidoEm)}</>}
              {detalhe.canceladoPor && <> · Cancelada por {detalhe.canceladoPor} em {formatarData(detalhe.canceladoEm)}</>}
            </p>
            {detalhe.observacoes && <p className="rd-ajuda">Obs: {detalhe.observacoes}</p>}
            <table className="rd-tabela" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="rd-num">Solicitado</th>
                  <th className="rd-num">Enviado</th>
                </tr>
              </thead>
              <tbody>
                {detalhe.itens.map((it) => (
                  <tr key={it.id}>
                    <td>{it.produtoNome}</td>
                    <td className="rd-num">{it.quantidadeSolicitada}</td>
                    <td className="rd-num">{it.quantidadeEnviada ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="rd-modal-acoes">
              {botoes(detalhe)}
              <button className="rd-btn" onClick={() => setDetalhe(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {enviando && (
        <div className="rd-modal-fundo">
          <div className="rd-modal rd-modal-largo">
            <h3>Enviar Transferência #{enviando.id}</h3>
            <p className="rd-ajuda">Destino: {enviando.lojaDestino?.nome}. As quantidades saem do estoque desta loja ao confirmar.</p>
            <table className="rd-tabela" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="rd-num">Solicitado</th>
                  <th className="rd-num">Em estoque</th>
                  <th>Enviar</th>
                </tr>
              </thead>
              <tbody>
                {enviando.itens.map((it) => (
                  <tr key={it.id}>
                    <td>{it.produtoNome}</td>
                    <td className="rd-num">{it.quantidadeSolicitada}</td>
                    <td className="rd-num">{estoqueDe(it.produtoId)}</td>
                    <td>
                      <input
                        className="rd-input"
                        type="number"
                        min="0"
                        max={it.quantidadeSolicitada}
                        style={{ width: 90 }}
                        value={qtdsEnvio[it.id] ?? it.quantidadeSolicitada}
                        onChange={(e) => setQtdsEnvio((prev) => ({ ...prev, [it.id]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {erroEnvio && <p className="rd-erro">{erroEnvio}</p>}
            <div className="rd-modal-acoes">
              <button className="rd-btn rd-btn-primario" onClick={confirmarEnvio}>Confirmar envio</button>
              <button className="rd-btn" onClick={() => setEnviando(null)}>Voltar</button>
            </div>
          </div>
        </div>
      )}

      {modalNova && (
        <div className="rd-modal-fundo">
          <div className="rd-modal rd-modal-largo">
            <h3>Nova Transferência</h3>
            <form className="rd-form" onSubmit={salvar}>
              <div className="rd-form-linha">
                <label>
                  Operação *
                  <select value={form.direcao} onChange={(e) => setForm((p) => ({ ...p, direcao: e.target.value }))}>
                    <option value="ENVIAR">Enviar desta loja para outra</option>
                    <option value="PEDIR">Pedir de outra loja para esta</option>
                  </select>
                </label>
                <label>
                  {form.direcao === "ENVIAR" ? "Loja de destino *" : "Loja de origem *"}
                  <select value={form.outraLojaId} onChange={(e) => setForm((p) => ({ ...p, outraLojaId: e.target.value }))} required>
                    <option value="">Selecione...</option>
                    {outrasLojas.map((l) => (
                      <option key={l.id} value={l.id}>{l.nome}{l.matriz ? " (matriz)" : ""}</option>
                    ))}
                  </select>
                </label>
              </div>
              <span className="rd-ajuda">
                {form.direcao === "ENVIAR"
                  ? "O estoque sai desta loja agora e entra no destino quando ele confirmar o recebimento."
                  : "O pedido fica aguardando a loja de origem enviar."}
              </span>
              <label>
                Observações
                <input value={form.observacoes} maxLength={500} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} />
              </label>

              <div className="rd-header" style={{ marginBottom: 0 }}>
                <strong>Itens</strong>
                <button type="button" className="rd-btn rd-btn-pequeno" onClick={() => setItens((prev) => [...prev, { ...ITEM_VAZIO }])}>
                  + Item
                </button>
              </div>

              {itens.map((it, i) => (
                <div key={i} className="rd-item-linha">
                  <select value={it.produtoId} onChange={(e) => alterarItem(i, "produtoId", e.target.value)}>
                    <option value="">Produto...</option>
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} (estoque nesta loja: {p.estoque})
                      </option>
                    ))}
                  </select>
                  <input type="number" min="1" placeholder="Qtd" value={it.quantidade} onChange={(e) => alterarItem(i, "quantidade", e.target.value)} />
                  <button
                    type="button"
                    className="rd-btn rd-btn-pequeno"
                    disabled={itens.length === 1}
                    onClick={() => setItens((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    ✕
                  </button>
                </div>
              ))}

              {erroForm && <p className="rd-erro">{erroForm}</p>}
              <div className="rd-modal-acoes">
                <button type="submit" className="rd-btn rd-btn-primario" disabled={salvando}>
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
                <button type="button" className="rd-btn" onClick={() => setModalNova(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Transferencias;
