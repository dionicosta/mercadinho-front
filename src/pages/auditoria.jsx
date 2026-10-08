import { useCallback, useEffect, useState } from "react";
import api, { extrairErro } from "../services/api";
import "./rede.css";

const TAMANHO = 50;
const FILTRO_VAZIO = { lojaId: "", de: "", ate: "", acao: "", usuario: "", somenteAtuacaoRemota: false };

function Auditoria({ sessao }) {
  const isSuperAdmin = !!sessao?.isSuperAdmin;
  const podeVer = !!sessao?.isPrincipal;

  const [filtro, setFiltro] = useState(FILTRO_VAZIO);
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState({ itens: [], total: 0 });
  const [lojas, setLojas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async (filtroAtual, paginaAtual) => {
    setLoading(true);
    setErro(null);
    try {
      const params = { pagina: paginaAtual, tamanho: TAMANHO };
      if (filtroAtual.lojaId) params.lojaId = filtroAtual.lojaId;
      if (filtroAtual.de) params.de = `${filtroAtual.de}T00:00:00`;
      if (filtroAtual.ate) params.ate = `${filtroAtual.ate}T23:59:59`;
      if (filtroAtual.acao.trim()) params.acao = filtroAtual.acao.trim().toUpperCase();
      if (filtroAtual.usuario.trim()) params.usuario = filtroAtual.usuario.trim();
      if (filtroAtual.somenteAtuacaoRemota) params.somenteAtuacaoRemota = true;

      const resp = await api.get("/auditoria", { params });
      setResultado({ itens: resp.data?.itens ?? [], total: resp.data?.total ?? 0 });
    } catch (err) {
      setErro(extrairErro(err, "Falha ao carregar a auditoria."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (podeVer) carregar(FILTRO_VAZIO, 1);
  }, [podeVer, carregar]);

  useEffect(() => {
    if (isSuperAdmin) api.get("/lojas").then((r) => setLojas(r.data || [])).catch(() => setLojas([]));
  }, [isSuperAdmin]);

  if (!podeVer) {
    return (
      <div className="rd-container">
        <h2 className="rd-titulo">Auditoria</h2>
        <p className="rd-subtitulo">Acesso restrito ao admin principal da loja e ao super admin.</p>
      </div>
    );
  }

  function aplicar(e) {
    e?.preventDefault();
    setPagina(1);
    carregar(filtro, 1);
  }

  function limpar() {
    setFiltro(FILTRO_VAZIO);
    setPagina(1);
    carregar(FILTRO_VAZIO, 1);
  }

  function irPara(n) {
    setPagina(n);
    carregar(filtro, n);
  }

  const totalPaginas = Math.max(1, Math.ceil(resultado.total / TAMANHO));

  return (
    <div className="rd-container">
      <div className="rd-header">
        <div>
          <h2 className="rd-titulo">Auditoria</h2>
          <p className="rd-subtitulo">
            {isSuperAdmin
              ? "Tudo o que foi feito em todas as lojas da rede. Os registros não podem ser alterados nem apagados."
              : "Tudo o que foi feito nesta loja, inclusive pelo super admin da rede. Os registros não podem ser alterados nem apagados."}
          </p>
        </div>
      </div>

      <form className="rd-filtros" onSubmit={aplicar}>
        {isSuperAdmin && (
          <select className="rd-input" value={filtro.lojaId} onChange={(e) => setFiltro((p) => ({ ...p, lojaId: e.target.value }))}>
            <option value="">Todas as lojas</option>
            {lojas.map((l) => (
              <option key={l.id} value={l.id}>{l.nome}</option>
            ))}
          </select>
        )}
        <input className="rd-input" type="date" value={filtro.de} onChange={(e) => setFiltro((p) => ({ ...p, de: e.target.value }))} />
        <input className="rd-input" type="date" value={filtro.ate} onChange={(e) => setFiltro((p) => ({ ...p, ate: e.target.value }))} />
        <input className="rd-input" placeholder="Ação (ex.: LOGIN)" value={filtro.acao} maxLength={60} onChange={(e) => setFiltro((p) => ({ ...p, acao: e.target.value }))} />
        <input className="rd-input" placeholder="E-mail do usuário" value={filtro.usuario} maxLength={255} onChange={(e) => setFiltro((p) => ({ ...p, usuario: e.target.value }))} />
        <label className="rd-check rd-ajuda" style={{ display: "flex" }}>
          <input
            type="checkbox"
            checked={filtro.somenteAtuacaoRemota}
            onChange={(e) => setFiltro((p) => ({ ...p, somenteAtuacaoRemota: e.target.checked }))}
          />
          Somente ações do super admin em filiais
        </label>
        <button type="submit" className="rd-btn rd-btn-primario">Filtrar</button>
        <button type="button" className="rd-btn" onClick={limpar}>Limpar</button>
      </form>

      {loading && <p className="rd-vazio">Carregando...</p>}
      {erro && <p className="rd-erro">{erro}</p>}
      {!loading && !erro && resultado.itens.length === 0 && <p className="rd-vazio">Nenhum registro encontrado.</p>}

      {!loading && resultado.itens.length > 0 && (
        <>
          <div className="rd-tabela-wrap">
            <table className="rd-tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Loja</th>
                  <th>Usuário</th>
                  <th>Ação</th>
                  <th>Registro</th>
                  <th>Detalhes</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {resultado.itens.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(a.criadoEm).toLocaleString("pt-BR")}</td>
                    <td>{a.lojaNome ?? "—"}</td>
                    <td>
                      {a.usuarioEmail}
                      <div className="rd-ajuda">{a.usuarioTipo}</div>
                      {a.atuacaoRemota && <span className="rd-badge rd-badge-amarelo">de outra loja</span>}
                    </td>
                    <td><span className="rd-badge">{a.acao}</span></td>
                    <td>{a.entidade ? `${a.entidade} #${a.entidadeId ?? "-"}` : "—"}</td>
                    <td>{a.detalhes ?? "—"}</td>
                    <td>{a.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rd-paginacao">
            <span>{resultado.total} registro(s)</span>
            <button className="rd-btn rd-btn-pequeno" disabled={pagina <= 1} onClick={() => irPara(pagina - 1)}>Anterior</button>
            <span>Página {pagina} de {totalPaginas}</span>
            <button className="rd-btn rd-btn-pequeno" disabled={pagina >= totalPaginas} onClick={() => irPara(pagina + 1)}>Próxima</button>
          </div>
        </>
      )}
    </div>
  );
}

export default Auditoria;
