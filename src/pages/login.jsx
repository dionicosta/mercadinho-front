import { useState } from "react";
import { login } from "../services/auth";
import "./login.css";

export default function Login({ setLogado, setSessao }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagemErro, setMensagemErro] = useState("");

  async function entrar() {
    setMensagemErro("");
    
    if (!email || !senha) {
      setMensagemErro("Email e senha são obrigatórios");
      return;
    }

    try {
      setCarregando(true);
      const sessao = await login(email, senha);
      setSessao(sessao);
      setLogado(true);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setMensagemErro("Email ou senha inválidos");
        return;
      }

      const detalhe = err?.response?.data?.message || err?.message || "Erro desconhecido";
      setMensagemErro(`Falha ao conectar no backend: ${detalhe}`);
    } finally {
      setCarregando(false);
    }
  }

  function handleKeyPress(e) {
    if (e.key === "Enter" && !carregando) {
      entrar();
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>🏪 Mercadinho</h2>
        <p className="login-subtitle">Sistema de Gestão de Produtos</p>

        {mensagemErro && (
          <div className="error-message">{mensagemErro}</div>
        )}

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={carregando}
          />
        </div>

        <div className="form-group">
          <label>Senha</label>
          <input
            type="password"
            placeholder="Sua senha"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={carregando}
          />
        </div>

        <button 
          className="login-button" 
          onClick={entrar}
          disabled={carregando}
        >
          {carregando ? (
            <>
              <span className="loading-spinner"></span>
              Entrando...
            </>
          ) : (
            "Entrar"
          )}
        </button>
      </div>
    </div>
  );
}
