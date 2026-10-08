import { useCallback, useEffect, useState } from "react";
import api, { extrairErro } from "../services/api";
import "./rede.css";

const FORM_VAZIO = { nome: "", cnpj: "", endereco: "" };
const ADMIN_VAZIO = { nome: "", email: "", senha: "" };

function Lojas({ sessao }) {
  const [lojas, setLojas] = useState([]);
  const [plano, setPlano] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const [modalLoja, setModalLoja] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erroForm, setErroForm] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const [lojaAdmins, setLojaAdmins] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [adminForm, setAdminForm] = useState(ADMIN_VAZIO);
  const [erroAdmins, setErroAdmins] = useState(null);
  const [avisoAdmins, setAvisoAdmins] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [respLojas, respRede] = await Promise.all([api.get("/lojas"), api.get("/rede")]);
      setLojas(respLojas.data || []);
      setPlano(respRede.data?.plano ?? null);
    } catch (err) {
      setErro(extrairErro(err, "Falha ao carregar lojas."));
    } finally {
      setLoading(false);
    }
  }, []);

  const isSuperAdmin = !!sessao?.isSuperAdmin;

  useEffect(() => {
    if (isSuperAdmin) carregar();
  }, [isSuperAdmin, carregar]);

  if (!isSuperAdmin) {
    return (
      <div className="rd-container">
        <h2 className="rd-titulo">Lojas</h2>
        <p className="rd-subtitulo">Acesso restrito ao super admin da rede.</p>
      </div>
    );
  }

  const limiteAtingido = plano && plano.lojasCadastradas >= plano.maxLojas;

  function abrirNova() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setErroForm(null);
    setModalLoja(true);
  }

  function abrirEditar(loja) {
    setEditando(loja.id);
    setForm({ nome: loja.nome ?? "", cnpj: loja.cnpj ?? "", endereco: loja.endereco ?? "" });
    setErroForm(null);
    setModalLoja(true);
  }

  async function salvarLoja(e) {
    e.preventDefault();
    if (!form.nome.trim()) {
      setErroForm("Nome é obrigatório.");
      return;
    }
    setSalvando(true);
    setErroForm(null);
    try {
      if (editando) await api.put(`/lojas/${editando}`, form);
      else await api.post("/lojas", form);
      setModalLoja(false);
      carregar();
    } catch (err) {
      setErroForm(extrairErro(err, "Erro ao salvar loja."));
    } finally {
      setSalvando(false);
    }
  }

  async function alternarStatus(loja) {
    const acao = loja.ativa ? "suspender" : "reativar";
    const pergunta = loja.ativa
      ? `Suspender a loja "${loja.nome}"? Os usuários dela perdem o acesso imediatamente; os dados são mantidos.`
      : `Reativar a loja "${loja.nome}"?`;
    if (!window.confirm(pergunta)) return;
    try {
      await api.post(`/lojas/${loja.id}/${acao}`);
      carregar();
    } catch (err) {
      setErro(extrairErro(err, "Erro ao alterar a loja."));
    }
  }

  async function abrirAdmins(loja) {
    setLojaAdmins(loja);
    setAdminForm(ADMIN_VAZIO);
    setErroAdmins(null);
    setAvisoAdmins(null);
    await carregarAdmins(loja.id);
  }

  async function carregarAdmins(lojaId) {
    try {
      const resp = await api.get(`/lojas/${lojaId}/admins`);
      setAdmins(resp.data || []);
    } catch (err) {
      setErroAdmins(extrairErro(err, "Erro ao carregar admins."));
    }
  }

  async function criarPrincipal(e) {
    e.preventDefault();
    setErroAdmins(null);
    setAvisoAdmins(null);
    try {
      await api.post(`/lojas/${lojaAdmins.id}/principal`, {
        nome: adminForm.nome.trim(),
        email: adminForm.email.trim(),
        senha: adminForm.senha,
      });
      setAdminForm(ADMIN_VAZIO);
      setAvisoAdmins("Admin principal cadastrado.");
      await carregarAdmins(lojaAdmins.id);
    } catch (err) {
      setErroAdmins(extrairErro(err, "Erro ao cadastrar admin principal."));
    }
  }

  async function removerAdmin(admin) {
    if (!window.confirm(`Remover o acesso de ${admin.email}?`)) return;
    setErroAdmins(null);
    setAvisoAdmins(null);
    try {
      await api.delete(`/lojas/${lojaAdmins.id}/admins/${admin.id}`);
      await carregarAdmins(lojaAdmins.id);
    } catch (err) {
      setErroAdmins(extrairErro(err, "Erro ao remover admin."));
    }
  }

  async function redefinirSenha(admin) {
    const novaSenha = window.prompt(`Nova senha para ${admin.email} (mínimo 8 caracteres, com letra e número):`);
    if (!novaSenha) return;
    setErroAdmins(null);
    setAvisoAdmins(null);
    try {
      await api.post(`/lojas/${lojaAdmins.id}/admins/${admin.id}/redefinir-senha`, { novaSenha });
      setAvisoAdmins(`Senha de ${admin.email} redefinida. As sessões abertas dele foram encerradas.`);
    } catch (err) {
      setErroAdmins(extrairErro(err, "Erro ao redefinir senha."));
    }
  }

  const temPrincipal = admins.some((a) => a.tipo === "PRINCIPAL");

  return (
    <div className="rd-container">
      <div className="rd-header">
        <div>
          <h2 className="rd-titulo">Lojas da Rede</h2>
          {plano && (
            <p className="rd-subtitulo">
              Plano: {plano.lojasCadastradas} de {plano.maxLojas} loja(s) em uso · até {plano.maxSecundariosPorLoja} admin(s) secundário(s) por loja
            </p>
          )}
        </div>
        <button
          className="rd-btn rd-btn-primario"
          onClick={abrirNova}
          disabled={limiteAtingido}
          title={limiteAtingido ? "Limite de lojas do plano atingido" : ""}
        >
          + Nova Loja
        </button>
      </div>

      {loading && <p className="rd-vazio">Carregando...</p>}
      {erro && <p className="rd-erro">{erro}</p>}

      {!loading && lojas.length > 0 && (
        <div className="rd-tabela-wrap">
          <table className="rd-tabela">
            <thead>
              <tr>
                <th>Loja</th>
                <th>CNPJ</th>
                <th>Endereço</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lojas.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.nome}</strong>
                    {l.id === sessao?.loja?.id && <span className="rd-ajuda"> (loja atual)</span>}
                  </td>
                  <td>{l.cnpj || "—"}</td>
                  <td>{l.endereco || "—"}</td>
                  <td>
                    <span className={`rd-badge ${l.matriz ? "rd-badge-roxo" : ""}`}>{l.matriz ? "Matriz" : "Filial"}</span>
                  </td>
                  <td>
                    <span className={`rd-badge ${l.ativa ? "rd-badge-verde" : "rd-badge-vermelho"}`}>
                      {l.ativa ? "Ativa" : "Suspensa"}
                    </span>
                  </td>
                  <td>
                    <div className="rd-acoes">
                      <button className="rd-btn rd-btn-pequeno" onClick={() => abrirEditar(l)}>Editar</button>
                      <button className="rd-btn rd-btn-pequeno" onClick={() => abrirAdmins(l)}>Admins</button>
                      {!l.matriz && (
                        <button
                          className={`rd-btn rd-btn-pequeno ${l.ativa ? "rd-btn-perigo" : "rd-btn-sucesso"}`}
                          onClick={() => alternarStatus(l)}
                        >
                          {l.ativa ? "Suspender" : "Reativar"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="rd-ajuda" style={{ marginTop: 14 }}>
        Para operar em uma loja, selecione-a no seletor "Loja" do menu lateral.
      </p>

      {modalLoja && (
        <div className="rd-modal-fundo">
          <div className="rd-modal">
            <h3>{editando ? "Editar Loja" : "Nova Loja"}</h3>
            <form className="rd-form" onSubmit={salvarLoja}>
              <label>
                Nome *
                <input value={form.nome} maxLength={120} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} required />
              </label>
              <label>
                CNPJ
                <input value={form.cnpj} maxLength={20} placeholder="00.000.000/0001-00" onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))} />
              </label>
              <label>
                Endereço
                <input value={form.endereco} maxLength={300} onChange={(e) => setForm((p) => ({ ...p, endereco: e.target.value }))} />
              </label>
              {erroForm && <p className="rd-erro">{erroForm}</p>}
              <div className="rd-modal-acoes">
                <button type="submit" className="rd-btn rd-btn-primario" disabled={salvando}>
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
                <button type="button" className="rd-btn" onClick={() => setModalLoja(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {lojaAdmins && (
        <div className="rd-modal-fundo">
          <div className="rd-modal rd-modal-largo">
            <h3>Admins — {lojaAdmins.nome}</h3>

            {admins.length === 0 ? (
              <p className="rd-vazio">Nenhum admin cadastrado nesta loja.</p>
            ) : (
              <table className="rd-tabela">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Cargo</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id}>
                      <td>{a.nome}</td>
                      <td>{a.email}</td>
                      <td><span className="rd-badge">{a.selo}</span></td>
                      <td>
                        {a.tipo === "SUPER_ADMIN" ? (
                          <span className="rd-ajuda">Gerenciado pelo suporte</span>
                        ) : (
                          <div className="rd-acoes">
                            <button className="rd-btn rd-btn-pequeno" onClick={() => redefinirSenha(a)}>Redefinir senha</button>
                            <button className="rd-btn rd-btn-pequeno rd-btn-perigo" onClick={() => removerAdmin(a)}>Remover</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!temPrincipal && (
              <form className="rd-form" onSubmit={criarPrincipal} style={{ marginTop: 18 }}>
                <strong>Cadastrar admin principal da loja</strong>
                <div className="rd-form-linha">
                  <label>
                    Nome
                    <input value={adminForm.nome} maxLength={120} onChange={(e) => setAdminForm((p) => ({ ...p, nome: e.target.value }))} />
                  </label>
                  <label>
                    E-mail *
                    <input type="email" value={adminForm.email} maxLength={255} required onChange={(e) => setAdminForm((p) => ({ ...p, email: e.target.value }))} />
                  </label>
                  <label>
                    Senha *
                    <input type="password" value={adminForm.senha} minLength={8} required autoComplete="new-password" onChange={(e) => setAdminForm((p) => ({ ...p, senha: e.target.value }))} />
                  </label>
                </div>
                <span className="rd-ajuda">Senha com no mínimo 8 caracteres, com letra e número. Admins secundários são cadastrados pelo principal, na tela de Produtos da própria loja.</span>
                <div>
                  <button type="submit" className="rd-btn rd-btn-primario">Cadastrar principal</button>
                </div>
              </form>
            )}

            {erroAdmins && <p className="rd-erro">{erroAdmins}</p>}
            {avisoAdmins && <p className="rd-sucesso">{avisoAdmins}</p>}

            <div className="rd-modal-acoes">
              <button className="rd-btn" onClick={() => setLojaAdmins(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Lojas;
