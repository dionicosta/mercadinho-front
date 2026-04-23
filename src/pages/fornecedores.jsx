import { useEffect, useState, useCallback } from "react";
import api from "../services/api";
import "./fornecedores.css";

const FORM_VAZIO = {
  razaoSocial: "",
  cnpj: "",
  telefone: "",
  email: "",
  endereco: "",
  ativo: true,
};

function Fornecedores({ sessao }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null); // id do fornecedor sendo editado
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(null);

  const isPrincipal = sessao?.isPrincipal;

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const resp = await api.get("/fornecedores");
      setLista(resp.data);
    } catch {
      setErro("Falha ao carregar fornecedores.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirNovo() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setErroForm(null);
    setModalAberto(true);
  }

  function abrirEditar(f) {
    setEditando(f.id);
    setForm({
      razaoSocial: f.razaoSocial ?? "",
      cnpj: f.cnpj ?? "",
      telefone: f.telefone ?? "",
      email: f.email ?? "",
      endereco: f.endereco ?? "",
      ativo: f.ativo ?? true,
    });
    setErroForm(null);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditando(null);
    setForm(FORM_VAZIO);
    setErroForm(null);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function salvar(e) {
    e.preventDefault();
    if (!form.razaoSocial.trim()) {
      setErroForm("Razão Social é obrigatória.");
      return;
    }
    setSalvando(true);
    setErroForm(null);
    try {
      if (editando) {
        await api.put(`/fornecedores/${editando}`, form);
      } else {
        await api.post("/fornecedores", form);
      }
      fecharModal();
      carregar();
    } catch (err) {
      setErroForm(
        err?.response?.data?.message ||
          err?.response?.data ||
          "Erro ao salvar fornecedor."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id) {
    try {
      await api.delete(`/fornecedores/${id}`);
      setConfirmandoExclusao(null);
      carregar();
    } catch (err) {
      alert(
        err?.response?.data?.message ||
          err?.response?.data ||
          "Erro ao excluir fornecedor."
      );
    }
  }

  return (
    <div className="forn-container">
      <div className="forn-header">
        <h2 className="forn-titulo">Fornecedores</h2>
        {isPrincipal && (
          <button className="btn-novo" onClick={abrirNovo}>
            + Novo Fornecedor
          </button>
        )}
      </div>

      {loading && <p className="forn-loading">Carregando...</p>}
      {erro && <p className="forn-erro">{erro}</p>}

      {!loading && !erro && lista.length === 0 && (
        <p className="forn-vazio">Nenhum fornecedor cadastrado.</p>
      )}

      {!loading && lista.length > 0 && (
        <table className="forn-tabela">
          <thead>
            <tr>
              <th>Razão Social</th>
              <th>CNPJ</th>
              <th>Telefone</th>
              <th>E-mail</th>
              <th>Status</th>
              {isPrincipal && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {lista.map((f) => (
              <tr key={f.id}>
                <td>{f.razaoSocial}</td>
                <td>{f.cnpj || "—"}</td>
                <td>{f.telefone || "—"}</td>
                <td>{f.email || "—"}</td>
                <td>
                  <span className={f.ativo ? "badge-ativo" : "badge-inativo"}>
                    {f.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                {isPrincipal && (
                  <td className="forn-acoes">
                    <button className="btn-editar" onClick={() => abrirEditar(f)}>
                      Editar
                    </button>
                    <button
                      className="btn-excluir"
                      onClick={() => setConfirmandoExclusao(f.id)}
                    >
                      Excluir
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal de confirmação de exclusão */}
      {confirmandoExclusao && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Confirmar Exclusão</h3>
            <p>Deseja excluir este fornecedor?</p>
            <div className="modal-acoes">
              <button className="btn-excluir" onClick={() => excluir(confirmandoExclusao)}>
                Excluir
              </button>
              <button className="btn-cancelar" onClick={() => setConfirmandoExclusao(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de cadastro/edição */}
      {modalAberto && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>{editando ? "Editar Fornecedor" : "Novo Fornecedor"}</h3>
            <form onSubmit={salvar} className="forn-form">
              <label>
                Razão Social *
                <input
                  type="text"
                  name="razaoSocial"
                  value={form.razaoSocial}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                CNPJ
                <input
                  type="text"
                  name="cnpj"
                  value={form.cnpj}
                  onChange={handleChange}
                  placeholder="00.000.000/0001-00"
                />
              </label>
              <label>
                Telefone
                <input
                  type="text"
                  name="telefone"
                  value={form.telefone}
                  onChange={handleChange}
                />
              </label>
              <label>
                E-mail
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                />
              </label>
              <label>
                Endereço
                <input
                  type="text"
                  name="endereco"
                  value={form.endereco}
                  onChange={handleChange}
                />
              </label>
              {editando && (
                <label className="forn-checkbox">
                  <input
                    type="checkbox"
                    name="ativo"
                    checked={form.ativo}
                    onChange={handleChange}
                  />
                  Ativo
                </label>
              )}
              {erroForm && <p className="forn-erro-form">{erroForm}</p>}
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

export default Fornecedores;
