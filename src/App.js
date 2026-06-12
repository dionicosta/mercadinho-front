import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import Login from "./pages/login";
import Produtos from "./pages/produtos";
import Dashboard from "./pages/dashboard";
import Fornecedores from "./pages/fornecedores";
import NotasFiscais from "./pages/notas-fiscais";
import Requisicoes from "./pages/requisicoes";
import Colaboradores from "./pages/colaboradores";
import { getPerfilAtual, getSessao, logout } from "./services/auth";
import "./App.css";

function App() {
  const [logado, setLogado] = useState(!!localStorage.getItem("token"));
  const [sessao, setSessao] = useState(getSessao());
  const [validandoSessao, setValidandoSessao] = useState(!!localStorage.getItem("token"));

  useEffect(() => {
    async function validarSessaoInicial() {
      if (!localStorage.getItem("token")) {
        setValidandoSessao(false);
        return;
      }
      setValidandoSessao(true);
      try {
        const perfil = await getPerfilAtual();
        if (!perfil) {
          logout();
          setSessao(null);
          setLogado(false);
          return;
        }
        setSessao(perfil);
        setLogado(true);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) {
          console.warn("Sessao expirada ou token invalido. Redirecionando para login.");
          logout();
          setSessao(null);
          setLogado(false);
        } else {
          console.error("Falha ao validar sessao:", err);
          // Se a API estiver fora no momento do boot, preserva a sessao local e evita logout indevido.
          const sessaoLocal = getSessao();
          if (sessaoLocal?.token) {
            setSessao(sessaoLocal);
            setLogado(true);
          } else {
            setSessao(null);
            setLogado(false);
          }
        }
      } finally {
        setValidandoSessao(false);
      }
    }
    validarSessaoInicial();
  }, []);

  if (validandoSessao) {
    return <div style={{ padding: 24 }}>Validando sessão...</div>;
  }

  if (!logado) {
    return <Login setLogado={setLogado} setSessao={setSessao} />;
  }

  return (
    <BrowserRouter>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-logo">🛒 Mercadinho</div>
          <nav className="sidebar-nav">
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              📊 Dashboard
            </NavLink>
            <NavLink to="/produtos" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              📦 Produtos
            </NavLink>
            <NavLink to="/fornecedores" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              🏭 Fornecedores
            </NavLink>
            <NavLink to="/notas-fiscais" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              🧾 Notas Fiscais
            </NavLink>
            <NavLink to="/requisicoes" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              📋 Requisições
            </NavLink>
            {sessao?.isPrincipal && (
              <NavLink to="/colaboradores" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                👷 Colaboradores
              </NavLink>
            )}
          </nav>
          <div className="sidebar-footer">
            <div className="sidebar-usuario">{sessao?.nome ?? "Usuário"}</div>
            <button
              className="btn-sair"
              onClick={() => {
                logout();
                setSessao(null);
                setLogado(false);
              }}
            >
              Sair
            </button>
          </div>
        </aside>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard sessao={sessao} />} />
            <Route
              path="/produtos"
              element={<Produtos setLogado={setLogado} sessao={sessao} setSessao={setSessao} />}
            />
            <Route path="/fornecedores" element={<Fornecedores sessao={sessao} />} />
            <Route path="/notas-fiscais" element={<NotasFiscais sessao={sessao} />} />
            <Route path="/requisicoes" element={<Requisicoes sessao={sessao} />} />
            <Route path="/colaboradores" element={<Colaboradores sessao={sessao} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
