import { useCallback, useEffect, useState } from "react";
import api, { extrairErro } from "../services/api";
import { getPerfilAtual } from "../services/auth";
import "./rede.css";

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Rede({ sessao, setSessao }) {
  const [dados, setDados] = useState(null);
  const [estoque, setEstoque] = useState(null);
  const [rede, setRede] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState("");
  const [somenteDesbalanceados, setSomenteDesbalanceados] = useState(false);

  const [identidade, setIdentidade] = useState({ nome: "", cnpj: "", logoUrl: "" });
  const [erroIdentidade, setErroIdentidade] = useState(null);
  const [avisoIdentidade, setAvisoIdentidade] = useState(null);
  const [exportando, setExportando] = useState(false);

  const isSuperAdmin = !!sessao?.isSuperAdmin;

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [respDash, respEstoque, respRede] = await Promise.all([
        api.get("/rede/dashboard"),
        api.get("/rede/estoque"),
        api.get("/rede"),
      ]);
      setDados(respDash.data);
      setEstoque(respEstoque.data);
      setRede(respRede.data);
      setIdentidade({
        nome: respRede.data?.nome ?? "",
        cnpj: respRede.data?.cnpj ?? "",
        logoUrl: respRede.data?.logoUrl ?? "",
      });
    } catch (err) {
      setErro(extrairErro(err, "Falha ao carregar a visão da rede."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) carregar();
  }, [isSuperAdmin, carregar]);

  if (!isSuperAdmin) {
    return (
      <div className="rd-container">
        <h2 className="rd-titulo">Visão da Rede</h2>
        <p className="rd-subtitulo">Acesso restrito ao super admin da rede.</p>
      </div>
    );
  }

  async function salvarIdentidade(e) {
    e.preventDefault();
    setErroIdentidade(null);
    setAvisoIdentidade(null);
    try {
      await api.put("/rede/identidade", identidade);
      setAvisoIdentidade("Identidade da rede atualizada.");
      const perfil = await getPerfilAtual();
      if (perfil) setSessao(perfil);
    } catch (err) {
      setErroIdentidade(extrairErro(err, "Erro ao salvar a identidade da rede."));
    }
  }

  async function exportar() {
    if (!window.confirm("Baixar uma cópia completa dos dados da rede (todas as lojas)? O arquivo contém dados do negócio: guarde-o em local seguro.")) return;
    setExportando(true);
    setErro(null);
    try {
      const resp = await api.get("/rede/exportar", { responseType: "blob" });
      const url = URL.createObjectURL(resp.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rede-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErro(extrairErro(err, "Erro ao exportar os dados."));
    } finally {
      setExportando(false);
    }
  }

  if (loading) return <div className="rd-container"><p className="rd-vazio">Carregando visão da rede...</p></div>;
  if (erro && !dados) return <div className="rd-container"><p className="rd-erro">{erro}</p></div>;
  if (!dados) return null;

  const lojasEstoque = estoque?.lojas ?? [];
  const termo = busca.trim().toLowerCase();
  const produtosFiltrados = (estoque?.produtos ?? []).filter((p) => {
    if (termo && !p.nome.toLowerCase().includes(termo)) return false;
    if (!somenteDesbalanceados) return true;
    // Falta em uma loja e sobra em outra: candidato a transferencia.
    const falta = p.saldos.some((s) => s.quantidade < s.estoqueMinimo);
    const sobra = p.saldos.some((s) => s.quantidade > s.estoqueMinimo);
    return falta && sobra;
  });

  const t = dados.totais;

  return (
    <div className="rd-container">
      <div className="rd-header">
        <div>
          <h2 className="rd-titulo">Visão da Rede — {rede?.nome}</h2>
          <p className="rd-subtitulo">Consolidado de todas as lojas. Visível somente para o super admin.</p>
        </div>
        <div className="rd-acoes">
          <button className="rd-btn" onClick={carregar}>↻ Atualizar</button>
          <button className="rd-btn" onClick={exportar} disabled={exportando}>
            {exportando ? "Exportando..." : "Exportar dados (JSON)"}
          </button>
        </div>
      </div>

      {erro && <p className="rd-erro">{erro}</p>}

      <div className="rd-grid">
        <div className="rd-indicador">
          <div className="rd-indicador-rotulo">Lojas ativas</div>
          <div className="rd-indicador-valor">{t.lojasAtivas} / {t.lojas}</div>
        </div>
        <div className="rd-indicador">
          <div className="rd-indicador-rotulo">Valor em estoque</div>
          <div className="rd-indicador-valor">{moeda(t.valorInventario)}</div>
        </div>
        <div className="rd-indicador">
          <div className="rd-indicador-rotulo">Estoque a custo</div>
          <div className="rd-indicador-valor">{moeda(t.valorCusto)}</div>
        </div>
        <div className="rd-indicador">
          <div className="rd-indicador-rotulo">Itens abaixo do mínimo</div>
          <div className={`rd-indicador-valor ${t.abaixoMinimo > 0 ? "rd-alerta" : ""}`}>{t.abaixoMinimo}</div>
        </div>
        <div className="rd-indicador">
          <div className="rd-indicador-rotulo">Compras no mês</div>
          <div className="rd-indicador-valor">{moeda(t.valorNotasMes)}</div>
        </div>
        <div className="rd-indicador">
          <div className="rd-indicador-rotulo">Requisições pendentes</div>
          <div className="rd-indicador-valor">{t.requisicoesPendentes}</div>
        </div>
        <div className="rd-indicador">
          <div className="rd-indicador-rotulo">Transferências em andamento</div>
          <div className="rd-indicador-valor">{t.transferenciasEmAndamento}</div>
        </div>
      </div>

      <div className="rd-card">
        <h3>Comparativo por loja</h3>
        <div className="rd-tabela-wrap">
          <table className="rd-tabela">
            <thead>
              <tr>
                <th>Loja</th>
                <th className="rd-num">Produtos com saldo</th>
                <th className="rd-num">Unidades</th>
                <th className="rd-num">Valor em estoque</th>
                <th className="rd-num">A custo</th>
                <th className="rd-num">Abaixo do mínimo</th>
                <th className="rd-num">Notas no mês</th>
                <th className="rd-num">Compras no mês</th>
                <th className="rd-num">Req. pendentes</th>
                <th className="rd-num">Transf. a enviar / receber</th>
              </tr>
            </thead>
            <tbody>
              {dados.lojas.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.nome}</strong>{" "}
                    {l.matriz && <span className="rd-badge rd-badge-roxo">Matriz</span>}{" "}
                    {!l.ativa && <span className="rd-badge rd-badge-vermelho">Suspensa</span>}
                  </td>
                  <td className="rd-num">{l.produtosComSaldo}</td>
                  <td className="rd-num">{l.unidades}</td>
                  <td className="rd-num">{moeda(l.valorInventario)}</td>
                  <td className="rd-num">{moeda(l.valorCusto)}</td>
                  <td className={`rd-num ${l.abaixoMinimo > 0 ? "rd-alerta" : ""}`}>{l.abaixoMinimo}</td>
                  <td className="rd-num">{l.notasMes}</td>
                  <td className="rd-num">{moeda(l.valorNotasMes)}</td>
                  <td className="rd-num">{l.requisicoesPendentes}</td>
                  <td className="rd-num">{l.transferenciasAEnviar} / {l.transferenciasAReceber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dados.estoqueBaixo.length > 0 && (
        <div className="rd-card">
          <h3>⚠ Estoque abaixo do mínimo</h3>
          <div className="rd-tabela-wrap">
            <table className="rd-tabela">
              <thead>
                <tr>
                  <th>Loja</th>
                  <th>Produto</th>
                  <th className="rd-num">Estoque</th>
                  <th className="rd-num">Mínimo</th>
                </tr>
              </thead>
              <tbody>
                {dados.estoqueBaixo.map((e) => (
                  <tr key={`${e.lojaId}-${e.produtoId}`}>
                    <td>{e.lojaNome}</td>
                    <td>{e.produtoNome}</td>
                    <td className="rd-num rd-alerta">{e.estoque}</td>
                    <td className="rd-num">{e.estoqueMinimo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rd-card">
        <h3>Estoque de cada produto por loja</h3>
        <div className="rd-filtros">
          <input className="rd-input" placeholder="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <label className="rd-check rd-ajuda" style={{ display: "flex" }}>
            <input type="checkbox" checked={somenteDesbalanceados} onChange={(e) => setSomenteDesbalanceados(e.target.checked)} />
            Somente produtos faltando em uma loja e sobrando em outra
          </label>
        </div>
        {produtosFiltrados.length === 0 ? (
          <p className="rd-vazio">Nenhum produto encontrado.</p>
        ) : (
          <div className="rd-tabela-wrap">
            <table className="rd-tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  {lojasEstoque.map((l) => (
                    <th key={l.id} className="rd-num">{l.nome}</th>
                  ))}
                  <th className="rd-num">Total</th>
                </tr>
              </thead>
              <tbody>
                {produtosFiltrados.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    {lojasEstoque.map((l) => {
                      const saldo = p.saldos.find((s) => s.lojaId === l.id);
                      const baixo = saldo && saldo.quantidade < saldo.estoqueMinimo;
                      return (
                        <td key={l.id} className={`rd-num ${baixo ? "rd-alerta" : ""}`} title={saldo ? `Mínimo: ${saldo.estoqueMinimo} · Preço: ${moeda(saldo.preco)}` : "Sem registro nesta loja"}>
                          {saldo ? saldo.quantidade : "—"}
                        </td>
                      );
                    })}
                    <td className="rd-num"><strong>{p.total}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rd-card">
        <h3>Identidade da rede</h3>
        <form className="rd-form" onSubmit={salvarIdentidade}>
          <div className="rd-form-linha">
            <label>
              Nome exibido *
              <input value={identidade.nome} maxLength={120} required onChange={(e) => setIdentidade((p) => ({ ...p, nome: e.target.value }))} />
            </label>
            <label>
              CNPJ
              <input value={identidade.cnpj} maxLength={20} onChange={(e) => setIdentidade((p) => ({ ...p, cnpj: e.target.value }))} />
            </label>
            <label>
              URL do logo (https)
              <input value={identidade.logoUrl} maxLength={2048} placeholder="https://..." onChange={(e) => setIdentidade((p) => ({ ...p, logoUrl: e.target.value }))} />
            </label>
          </div>
          <span className="rd-ajuda">O nome aparece no menu e no cabeçalho dos relatórios; o logo aparece no menu.</span>
          {erroIdentidade && <p className="rd-erro">{erroIdentidade}</p>}
          {avisoIdentidade && <p className="rd-sucesso">{avisoIdentidade}</p>}
          <div>
            <button type="submit" className="rd-btn rd-btn-primario">Salvar identidade</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Rede;
