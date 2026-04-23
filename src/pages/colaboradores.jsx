import { useEffect, useState } from "react";
import api from "../services/api";
import { getSessao } from "../services/auth";
import "./colaboradores.css";

export default function Colaboradores({ sessao: sessaoProp }) {
  const sessao = sessaoProp || getSessao();
  const isPrincipal = !!sessao?.isPrincipal;

  const [usuariosEstoque, setUsuariosEstoque] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [form, setForm] = useState({ nome: "", tipo: "AUXILIAR_ESTOQUE" });

  useEffect(() => {
    if (isPrincipal) carregarColaboradores();
  }, [isPrincipal]);

  function formatarDataHora(valor) {
    if (!valor) return "-";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(data);
  }

  function extrairErro(err, fallback) {
    if (!err?.response) return err?.message || fallback;
    const d = err.response.data;
    return d?.error ?? d?.message ?? d?.title ?? (typeof d === "string" ? d : null) ?? fallback;
  }

  async function carregarColaboradores() {
    setLoading(true);
    setErro(null);
    try {
      const res = await api.get("/auth/usuarios-estoque");
      setUsuariosEstoque(res.data || []);
    } catch (err) {
      console.error(err);
      setErro("Erro ao carregar colaboradores.");
    } finally {
      setLoading(false);
    }
  }

  async function cadastrar(e) {
    e.preventDefault();
    setErro(null);
    if (!form.nome.trim()) {
      setErro("Nome é obrigatório.");
      return;
    }
    try {
      await api.post("/auth/usuarios-estoque", {
        Nome: form.nome.trim(),
        Tipo: form.tipo,
      });
      setForm({ nome: "", tipo: "AUXILIAR_ESTOQUE" });
      await carregarColaboradores();
    } catch (err) {
      setErro(extrairErro(err, "Erro ao cadastrar colaborador."));
    }
  }

  async function remover(id) {
    if (!window.confirm("Confirma remover este colaborador?")) return;
    setErro(null);
    try {
      await api.delete(`/auth/usuarios-estoque/${id}`);
      await carregarColaboradores();
    } catch (err) {
      setErro(extrairErro(err, "Erro ao remover colaborador."));
    }
  }

  if (!isPrincipal) {
    return (
      <div className="colab-page">
        <div className="colab-header-card">
          <h2 className="colab-title">Colaboradores de Estoque</h2>
          <p className="colab-subtitle">Acesso restrito ao admin principal.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="colab-page">
      <div className="colab-bg-shape colab-bg-shape-a" />
      <div className="colab-bg-shape colab-bg-shape-b" />

      <section className="colab-header-card">
        <div>
          <h2 className="colab-title">Colaboradores de Estoque</h2>
          <p className="colab-subtitle">Gerencie estoquistas e auxiliares de estoque da operação.</p>
        </div>
        <div className="colab-actions">
          <button className="btn btn-ghost" onClick={carregarColaboradores}>Atualizar</button>
          <button className="btn btn-ghost" onClick={() => window.print()}>Imprimir / PDF</button>
        </div>
      </section>

      <section className="colab-card">
        <div className="colab-card-header">
          <h3>Cadastrar Colaborador</h3>
          <p>Colaboradores não possuem acesso ao sistema — apenas nome e função são necessários.</p>
        </div>

        <form className="colab-form" onSubmit={cadastrar}>
          <input
            className="input"
            placeholder="Nome completo"
            value={form.nome}
            onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
          />
          <select
            className="input input-select"
            value={form.tipo}
            onChange={e => setForm(prev => ({ ...prev, tipo: e.target.value }))}
          >
            <option value="AUXILIAR_ESTOQUE">Auxiliar de Estoque</option>
            <option value="ESTOQUISTA">Estoquista</option>
          </select>
          <button className="btn btn-primary" type="submit">Cadastrar</button>
        </form>

        {erro && <div className="colab-error">{erro}</div>}
      </section>

      <section className="colab-card">
        <div className="colab-card-header">
          <h3>Colaboradores Cadastrados</h3>
        </div>

        {loading ? (
          <div className="colab-loading">Carregando colaboradores...</div>
        ) : usuariosEstoque.length === 0 ? (
          <div className="colab-vazio">Nenhum colaborador cadastrado.</div>
        ) : (
          <div className="colab-lista">
            {usuariosEstoque.map(u => {
              const tipo = (u.Tipo || u.tipo || "").toString().toUpperCase();
              const nome = u.Nome ?? u.nome ?? "—";
              const id = u.Id ?? u.id;
              return (
                <div className="colab-item" key={id}>
                  <div className="colab-item-info">
                    <span className="colab-nome">{nome}</span>
                    <div className="colab-meta">
                      <span className={`perfil-badge ${tipo === "ESTOQUISTA" ? "perfil-estoquista" : "perfil-auxiliar"}`}>
                        {tipo === "ESTOQUISTA" ? "estoquista" : "auxiliar"}
                      </span>
                      <span className="colab-data">Cadastrado em: {formatarDataHora(u.CriadoEm ?? u.criadoEm)}</span>
                    </div>
                  </div>
                  <button className="btn btn-small btn-danger" onClick={() => remover(id)}>
                    Remover
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
