import { useState } from "react";
import { extrairErro } from "../services/api";
import { alterarSenha } from "../services/auth";
import "./rede.css";

const CARGOS = {
  SUPER_ADMIN: "Super admin da rede",
  PRINCIPAL: "Admin principal da loja",
  SECUNDARIO: "Admin secundário da loja",
};

function Conta({ sessao }) {
  const [form, setForm] = useState({ atual: "", nova: "", confirmacao: "" });
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    setErro(null);
    setAviso(null);

    if (form.nova !== form.confirmacao) {
      setErro("A confirmação não confere com a nova senha.");
      return;
    }

    setSalvando(true);
    try {
      await alterarSenha(form.atual, form.nova);
      setForm({ atual: "", nova: "", confirmacao: "" });
      setAviso("Senha alterada. Suas sessões em outros dispositivos foram encerradas.");
    } catch (err) {
      setErro(extrairErro(err, "Erro ao alterar a senha."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rd-container">
      <div className="rd-header">
        <h2 className="rd-titulo">Minha Conta</h2>
      </div>

      <div className="rd-card">
        <h3>{sessao?.nome}</h3>
        <p className="rd-ajuda">{sessao?.email}</p>
        <p className="rd-ajuda">
          {CARGOS[sessao?.tipo] ?? sessao?.tipo} · {sessao?.rede?.nome} · {sessao?.loja?.nome}
        </p>
      </div>

      <div className="rd-card" style={{ maxWidth: 480 }}>
        <h3>Alterar senha</h3>
        <form className="rd-form" onSubmit={salvar}>
          <label>
            Senha atual
            <input type="password" autoComplete="current-password" required value={form.atual} onChange={(e) => setForm((p) => ({ ...p, atual: e.target.value }))} />
          </label>
          <label>
            Nova senha
            <input type="password" autoComplete="new-password" required minLength={8} value={form.nova} onChange={(e) => setForm((p) => ({ ...p, nova: e.target.value }))} />
          </label>
          <label>
            Confirmar nova senha
            <input type="password" autoComplete="new-password" required minLength={8} value={form.confirmacao} onChange={(e) => setForm((p) => ({ ...p, confirmacao: e.target.value }))} />
          </label>
          <span className="rd-ajuda">Mínimo de 8 caracteres, com pelo menos uma letra e um número.</span>
          {erro && <p className="rd-erro">{erro}</p>}
          {aviso && <p className="rd-sucesso">{aviso}</p>}
          <div>
            <button type="submit" className="rd-btn rd-btn-primario" disabled={salvando}>
              {salvando ? "Salvando..." : "Alterar senha"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Conta;
