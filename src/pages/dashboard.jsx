
import { useEffect, useState, useCallback } from "react";
import api from "../services/api";
import { exportarDashboardPdf, imprimirDashboardPdf } from "../services/pdf-export";
import "./dashboard.css";

function Dashboard({ sessao }) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const isPrincipal = !!sessao?.isPrincipal;

  // ── Colaboradores de Estoque ──────────────────────────────────────────────
  const [usuariosEstoque, setUsuariosEstoque] = useState([]);
  const [loadingUsuariosEstoque, setLoadingUsuariosEstoque] = useState(false);
  const [erroUsuariosEstoque, setErroUsuariosEstoque] = useState(null);
  const [usuarioEstoqueForm, setUsuarioEstoqueForm] = useState({ nome: "", tipo: "AUXILIAR_ESTOQUE" });

  const carregarDashboard = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const resp = await api.get("/dashboard");
      setDados(resp.data);
    } catch (err) {
      setErro("Falha ao carregar dados do dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDashboard();
  }, [carregarDashboard]);

  const carregarUsuariosEstoque = useCallback(async () => {
    setLoadingUsuariosEstoque(true);
    setErroUsuariosEstoque(null);
    try {
      const res = await api.get("/auth/usuarios-estoque");
      setUsuariosEstoque(res.data || []);
    } catch (err) {
      setErroUsuariosEstoque("Erro ao carregar colaboradores de estoque.");
    } finally {
      setLoadingUsuariosEstoque(false);
    }
  }, []);

  useEffect(() => {
    if (isPrincipal) carregarUsuariosEstoque();
  }, [isPrincipal, carregarUsuariosEstoque]);

  function formatarDataHora(valor) {
    if (!valor) return "-";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
  }

  async function criarUsuarioEstoque(e) {
    e.preventDefault();
    setErroUsuariosEstoque(null);
    if (!usuarioEstoqueForm.nome.trim()) {
      setErroUsuariosEstoque("Nome é obrigatório.");
      return;
    }
    try {
      await api.post("/auth/usuarios-estoque", {
        Nome: usuarioEstoqueForm.nome.trim(),
        Tipo: usuarioEstoqueForm.tipo,
      });
      setUsuarioEstoqueForm({ nome: "", tipo: "AUXILIAR_ESTOQUE" });
      await carregarUsuariosEstoque();
    } catch (err) {
      const data = err?.response?.data;
      const msg = typeof data === "string" ? data : data?.message ?? "Erro ao cadastrar colaborador.";
      setErroUsuariosEstoque(msg);
    }
  }

  async function removerUsuarioEstoque(id) {
    if (!window.confirm("Confirma remover este colaborador?")) return;
    setErroUsuariosEstoque(null);
    try {
      await api.delete(`/auth/usuarios-estoque/${id}`);
      await carregarUsuariosEstoque();
    } catch (err) {
      const data = err?.response?.data;
      const msg = typeof data === "string" ? data : data?.message ?? "Erro ao remover colaborador.";
      setErroUsuariosEstoque(msg);
    }
  }

  if (loading) return <div className="dash-loading">Carregando dashboard...</div>;
  if (erro) return <div className="dash-erro">{erro}</div>;
  if (!dados) return null;

  return (
    <div className="dashboard-container">
      <div className="dash-topo">
        <h2 className="dash-titulo">Dashboard</h2>
        <div className="dash-topo-acoes">
          <button className="btn-atualizar" onClick={() => exportarDashboardPdf(dados, sessao?.nome)}>
            Exportar PDF
          </button>
          <button className="btn-atualizar" onClick={() => imprimirDashboardPdf(dados, sessao?.nome)}>
            Imprimir dados
          </button>
        </div>
      </div>

      <div className="dash-grid">
        {/* Produtos */}
        <div className="dash-card">
          <div className="dash-card-titulo">Produtos</div>
          <div className="dash-card-valor">{dados.produtos?.total ?? 0}</div>
          <div className="dash-card-sub">Total cadastrado</div>
          <div className="dash-card-detalhe">
            Valor inventário:{" "}
            <strong>
              {(dados.produtos?.valorInventario ?? 0).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </strong>
          </div>
          <div className="dash-card-detalhe">
            A custo:{" "}
            <strong>
              {(dados.produtos?.valorCusto ?? 0).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </strong>
            {(dados.produtos?.semCusto ?? 0) > 0 && ` (${dados.produtos.semCusto} sem custo)`}
          </div>
          {(dados.produtos?.abaixoMinimo ?? 0) > 0 && (
            <div className="dash-card-alerta">
              ⚠ {dados.produtos.abaixoMinimo} abaixo do mínimo
            </div>
          )}
        </div>

        {/* Fornecedores */}
        <div className="dash-card">
          <div className="dash-card-titulo">Fornecedores</div>
          <div className="dash-card-valor">{dados.fornecedores?.ativos ?? 0}</div>
          <div className="dash-card-sub">Ativos</div>
          <div className="dash-card-detalhe">
            Total: <strong>{dados.fornecedores?.total ?? 0}</strong>
          </div>
        </div>

        {/* Notas Fiscais */}
        <div className="dash-card">
          <div className="dash-card-titulo">Notas Fiscais</div>
          <div className="dash-card-valor">{dados.notasFiscais?.totalMes ?? 0}</div>
          <div className="dash-card-sub">Este mês</div>
          <div className="dash-card-detalhe">
            Valor do mês:{" "}
            <strong>
              {(dados.notasFiscais?.valorMes ?? 0).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </strong>
          </div>
          <div className="dash-card-detalhe">
            Total geral: <strong>{dados.notasFiscais?.totalGeral ?? 0}</strong>
          </div>
        </div>

        {/* Requisições */}
        <div className="dash-card">
          <div className="dash-card-titulo">Requisições</div>
          <div className="dash-card-valor">{dados.requisicoes?.pendentes ?? 0}</div>
          <div className="dash-card-sub">Pendentes</div>
          <div className="dash-card-detalhe">
            Este mês: <strong>{dados.requisicoes?.totalMes ?? 0}</strong>
          </div>
          <div className="dash-card-detalhe">
            Total geral: <strong>{dados.requisicoes?.totalGeral ?? 0}</strong>
          </div>
        </div>

        {/* Admins */}
        <div className="dash-card">
          <div className="dash-card-titulo">Administradores</div>
          <div className="dash-card-valor">{dados.admins?.total ?? 0}</div>
          <div className="dash-card-sub">Cadastrados</div>
        </div>

        {/* Aprovação */}
        <div className="dash-card">
          <div className="dash-card-titulo">Aprovação de Requisições</div>
          <div className="dash-card-valor">{dados.eficienciaAprovacao?.tempoMedioHoras ?? 0}h</div>
          <div className="dash-card-sub">Tempo médio para aprovação</div>
          <div className="dash-card-detalhe">
            Até 24h: <strong>{dados.eficienciaAprovacao?.percentualAprovadasAte24h ?? 0}%</strong>
          </div>
        </div>

        {/* Inatividade */}
        <div className="dash-card">
          <div className="dash-card-titulo">Produtos sem Movimento</div>
          <div className="dash-card-valor">{dados.inatividadeEstoque?.semMov30d ?? 0}</div>
          <div className="dash-card-sub">Sem movimentação em 30 dias</div>
          <div className="dash-card-detalhe">
            60d: <strong>{dados.inatividadeEstoque?.semMov60d ?? 0}</strong> | 90d: <strong>{dados.inatividadeEstoque?.semMov90d ?? 0}</strong>
          </div>
        </div>
      </div>

      {/* Estoque Baixo */}
      {dados.produtosEstoqueBaixo && dados.produtosEstoqueBaixo.length > 0 && (
        <div className="dash-secao">
          <h3 className="dash-secao-titulo">⚠ Produtos com Estoque Baixo</h3>
          <table className="dash-tabela">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Estoque Atual</th>
                <th>Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {dados.produtosEstoqueBaixo.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td className="dash-td-alerta">{p.estoque}</td>
                  <td>{p.estoqueMinimo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Últimas Movimentações */}
      {dados.ultimasMovimentacoes && dados.ultimasMovimentacoes.length > 0 && (
        <div className="dash-secao">
          <h3 className="dash-secao-titulo">Últimas Movimentações de Estoque</h3>
          <table className="dash-tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Produto</th>
                <th>Tipo</th>
                <th>Quantidade</th>
                <th>Estoque Após</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {dados.ultimasMovimentacoes.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.criadoEm).toLocaleDateString("pt-BR")}</td>
                  <td>{m.produto}</td>
                  <td className={`dash-tipo-${m.tipo?.toLowerCase()}`}>{m.tipo}</td>
                  <td>{m.quantidade}</td>
                  <td>{m.estoqueResultante}</td>
                  <td>{m.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inventário por janelas de tempo */}
      {dados.inventarioHistorico && dados.inventarioHistorico.length > 0 && (
        <div className="dash-secao">
          <h3 className="dash-secao-titulo">Inventário por Período</h3>
          <table className="dash-tabela">
            <thead>
              <tr>
                <th>Período</th>
                <th>Valor no Início</th>
                <th>Valor Atual</th>
                <th>Variação (R$)</th>
                <th>Variação (%)</th>
              </tr>
            </thead>
            <tbody>
              {dados.inventarioHistorico.map((p) => {
                const variacaoPositiva = Number(p.variacaoValor) >= 0;
                return (
                  <tr key={p.chave}>
                    <td>{p.periodo}</td>
                    <td>
                      {Number(p.valorInicio ?? 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td>
                      {Number(p.valorAtual ?? 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className={variacaoPositiva ? "dash-var-up" : "dash-var-down"}>
                      {Number(p.variacaoValor ?? 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className={variacaoPositiva ? "dash-var-up" : "dash-var-down"}>
                      {Number(p.variacaoPercentual ?? 0).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      %
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Previsão de Ruptura */}
      {dados.previsaoRuptura && dados.previsaoRuptura.length > 0 && (
        <div className="dash-secao">
          <h3 className="dash-secao-titulo">Previsão de Ruptura (base 30 dias)</h3>
          <table className="dash-tabela">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Estoque</th>
                <th>Saída média/dia</th>
                <th>Dias até ruptura</th>
              </tr>
            </thead>
            <tbody>
              {dados.previsaoRuptura.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td>{p.estoque}</td>
                  <td>{Number(p.mediaSaidaDiaria ?? 0).toLocaleString("pt-BR")}</td>
                  <td className={(p.diasAteRuptura ?? 99999) <= 7 ? "dash-var-down" : ""}>
                    {p.diasAteRuptura == null ? "Sem saída" : `${Number(p.diasAteRuptura).toLocaleString("pt-BR")} dias`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Top sem movimentação */}
      {dados.inatividadeEstoque?.topSemMovimento?.length > 0 && (
        <div className="dash-secao">
          <h3 className="dash-secao-titulo">Top Produtos sem Movimentação</h3>
          <table className="dash-tabela">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Estoque</th>
                <th>Último Movimento</th>
                <th>Dias sem movimentar</th>
              </tr>
            </thead>
            <tbody>
              {dados.inatividadeEstoque.topSemMovimento.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td>{p.estoque}</td>
                  <td>{p.ultimoMovimento ? new Date(p.ultimoMovimento).toLocaleDateString("pt-BR") : "Nunca"}</td>
                  <td>{p.diasSemMovimento ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Colaboradores de Estoque — visível apenas para principal */}
      {isPrincipal && (
        <div className="dash-secao">
          <h3 className="dash-secao-titulo">Colaboradores de Estoque</h3>
          <p className="dash-secao-desc">Somente o admin principal pode cadastrar e remover colaboradores operacionais.</p>

          <form className="dash-colab-form" onSubmit={criarUsuarioEstoque}>
            <input
              className="dash-colab-input"
              placeholder="Nome do colaborador"
              value={usuarioEstoqueForm.nome}
              onChange={e => setUsuarioEstoqueForm(prev => ({ ...prev, nome: e.target.value }))}
            />
            <select
              className="dash-colab-input"
              value={usuarioEstoqueForm.tipo}
              onChange={e => setUsuarioEstoqueForm(prev => ({ ...prev, tipo: e.target.value }))}
            >
              <option value="AUXILIAR_ESTOQUE">Auxiliar de Estoque</option>
              <option value="ESTOQUISTA">Estoquista</option>
            </select>
            <button className="btn-atualizar" type="submit">Cadastrar</button>
            <button className="btn-atualizar" type="button" onClick={carregarUsuariosEstoque}>Atualizar</button>
          </form>

          {erroUsuariosEstoque && <div className="dash-erro-inline">{erroUsuariosEstoque}</div>}

          {loadingUsuariosEstoque ? (
            <div className="dash-loading">Carregando colaboradores...</div>
          ) : usuariosEstoque.length === 0 ? (
            <p className="dash-secao-vazio">Nenhum colaborador cadastrado.</p>
          ) : (
            <table className="dash-tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Função</th>
                  <th>Cadastrado em</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {usuariosEstoque.map(u => {
                  const tipo = (u.Tipo || u.tipo || "").toString().toUpperCase();
                  return (
                    <tr key={u.Id ?? u.id}>
                      <td>{u.Nome ?? u.nome}</td>
                      <td>{tipo === "ESTOQUISTA" ? "Estoquista" : "Auxiliar de Estoque"}</td>
                      <td>{formatarDataHora(u.CriadoEm ?? u.criadoEm)}</td>
                      <td>
                        <button
                          className="dash-btn-remover"
                          onClick={() => removerUsuarioEstoque(u.Id ?? u.id)}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="dash-atualizar">
        <button className="btn-atualizar" onClick={carregarDashboard}>
          ↻ Atualizar
        </button>
      </div>
    </div>
  );
}

export default Dashboard;
