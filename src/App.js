import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import Login from "./pages/login";
import Produtos from "./pages/produtos";
import Dashboard from "./pages/dashboard";
import Fornecedores from "./pages/fornecedores";
import NotasFiscais from "./pages/notas-fiscais";
import Requisicoes from "./pages/requisicoes";
import Colaboradores from "./pages/colaboradores";
import Transferencias from "./pages/transferencias";
import Lojas from "./pages/lojas";
import Rede from "./pages/rede";
import Auditoria from "./pages/auditoria";
import Conta from "./pages/conta";
import api, { EVENTO_SESSAO_ENCERRADA, extrairErro } from "./services/api";
import { getPerfilAtual, getSessao, logout, trocarLoja } from "./services/auth";
import { definirIdentidadeRelatorio } from "./services/pdf-export";
import "./App.css";

const classeLink = ({ isActive }) => (isActive ? "nav-link active" : "nav-link");

function App() {
  const [logado, setLogado] = useState(!!localStorage.getItem("token"));
  const [sessao, setSessao] = useState(getSessao());
  const [validandoSessao, setValidandoSessao] = useState(!!localStorage.getItem("token"));
  const [lojas, setLojas] = useState([]);
  const [erroLoja, setErroLoja] = useState(null);

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

  // O servidor encerrou a sessao (token expirado, senha trocada, loja suspensa): volta para o login.
  useEffect(() => {
    function aoEncerrar() {
      setSessao(null);
      setLogado(false);
    }
    window.addEventListener(EVENTO_SESSAO_ENCERRADA, aoEncerrar);
    return () => window.removeEventListener(EVENTO_SESSAO_ENCERRADA, aoEncerrar);
  }, []);

  const isSuperAdmin = !!sessao?.isSuperAdmin;

  useEffect(() => {
    definirIdentidadeRelatorio(sessao?.rede?.nome, sessao?.loja?.nome);
  }, [sessao?.rede?.nome, sessao?.loja?.nome]);

  useEffect(() => {
    if (!logado || !isSuperAdmin) {
      setLojas([]);
      return;
    }
    api.get("/lojas").then((res) => setLojas(res.data || [])).catch(() => setLojas([]));
  }, [logado, isSuperAdmin, sessao?.loja?.id]);

  async function aoTrocarLoja(e) {
    const lojaId = Number(e.target.value);
    if (!lojaId || lojaId === sessao?.loja?.id) return;
    setErroLoja(null);
    try {
      await trocarLoja(lojaId);
      // Recarrega tudo: nenhuma tela pode continuar mostrando dados da loja anterior.
      window.location.assign("/dashboard");
    } catch (err) {
      setErroLoja(extrairErro(err, "Não foi possível trocar de loja."));
    }
  }

  if (validandoSessao) {
    return <div style={{ padding: 24 }}>Validando sessão...</div>;
  }

  if (!logado) {
    return <Login setLogado={setLogado} setSessao={setSessao} />;
  }

  const foraDaLojaBase = isSuperAdmin && sessao?.loja?.id !== sessao?.lojaBaseId;

  return (
    <BrowserRouter>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-logo">
            {sessao?.rede?.logoUrl
              ? <img className="sidebar-logo-img" src={sessao.rede.logoUrl} alt="" referrerPolicy="no-referrer" />
              : <span>🛒</span>}
            <span className="sidebar-logo-nome">{sessao?.rede?.nome || "Mercadinho"}</span>
          </div>

          <div className="sidebar-loja">
            <div className="sidebar-loja-rotulo">Loja</div>
            {isSuperAdmin && lojas.length > 1 ? (
              <select className="sidebar-loja-select" value={sessao?.loja?.id ?? ""} onChange={aoTrocarLoja}>
                {lojas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}{l.matriz ? " (matriz)" : ""}{l.ativa ? "" : " — suspensa"}
                  </option>
                ))}
              </select>
            ) : (
              <div className="sidebar-loja-nome">
                {sessao?.loja?.nome || "-"}{sessao?.loja?.matriz ? " (matriz)" : ""}
              </div>
            )}
            {foraDaLojaBase && <div className="sidebar-loja-aviso">Você está atuando em uma filial. Suas ações ficam registradas na auditoria.</div>}
            {erroLoja && <div className="sidebar-loja-erro">{erroLoja}</div>}
          </div>

          <nav className="sidebar-nav">
            <NavLink to="/dashboard" className={classeLink}>
              📊 Dashboard
            </NavLink>
            <NavLink to="/produtos" className={classeLink}>
              📦 Produtos
            </NavLink>
            <NavLink to="/fornecedores" className={classeLink}>
              🏭 Fornecedores
            </NavLink>
            <NavLink to="/notas-fiscais" className={classeLink}>
              🧾 Notas Fiscais
            </NavLink>
            <NavLink to="/requisicoes" className={classeLink}>
              📋 Requisições
            </NavLink>
            <NavLink to="/transferencias" className={classeLink}>
              🔁 Transferências
            </NavLink>
            {sessao?.isPrincipal && (
              <NavLink to="/colaboradores" className={classeLink}>
                👷 Colaboradores
              </NavLink>
            )}
            {sessao?.isPrincipal && (
              <NavLink to="/auditoria" className={classeLink}>
                🛡️ Auditoria
              </NavLink>
            )}
            {isSuperAdmin && (
              <>
                <div className="sidebar-secao">Rede</div>
                <NavLink to="/rede" className={classeLink}>
                  🌐 Visão da Rede
                </NavLink>
                <NavLink to="/lojas" className={classeLink}>
                  🏬 Lojas
                </NavLink>
              </>
            )}
          </nav>
          <div className="sidebar-footer">
            <NavLink to="/conta" className="sidebar-usuario" title="Minha conta">
              {sessao?.nome ?? "Usuário"}
            </NavLink>
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
            <Route path="/transferencias" element={<Transferencias sessao={sessao} />} />
            <Route path="/colaboradores" element={<Colaboradores sessao={sessao} />} />
            <Route path="/auditoria" element={<Auditoria sessao={sessao} />} />
            <Route path="/rede" element={<Rede sessao={sessao} setSessao={setSessao} />} />
            <Route path="/lojas" element={<Lojas sessao={sessao} />} />
            <Route path="/conta" element={<Conta sessao={sessao} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
