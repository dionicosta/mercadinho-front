import { useEffect, useState } from "react";
import api from "../services/api";

export default function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  // modal / form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    Id: null,
    Nome: "",
    Preco: "",
    Estoque: "",
    SecaoId: "",
    ImagemUrl: ""
  });

  // paginação cliente
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(produtos.length / pageSize));
  const paginated = produtos.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const res = await api.get("/produtos");
      setProdutos(res.data || []);
      setPage(1);
    } catch (err) {
      console.error(err);
      setErro("Erro ao carregar produtos.");
    } finally {
      setLoading(false);
    }
  }

  function abrirNovo() {
    setForm({ Id: null, Nome: "", Preco: "", Estoque: "", SecaoId: "", ImagemUrl: "" });
    setIsEditing(false);
    setIsModalOpen(true);
  }

  function abrirEditar(p) {
    setForm({
      Id: p.Id ?? p.id,
      Nome: p.Nome ?? p.nome ?? "",
      Preco: (p.Preco ?? p.preco ?? "").toString(),
      Estoque: (p.Estoque ?? p.estoque ?? "").toString(),
      SecaoId: (p.SecaoId ?? p.secaoId ?? "").toString(),
      ImagemUrl: p.ImagemUrl ?? p.imagemUrl ?? ""
    });
    setIsEditing(true);
    setIsModalOpen(true);
  }

  function fecharModal() {
    setIsModalOpen(false);
    setErro(null);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function salvar(e) {
    e.preventDefault();
    setErro(null);

    if (!form.Nome || !form.Preco) {
      setErro("Nome e Preço são obrigatórios.");
      return;
    }

    const payload = {
      Nome: form.Nome,
      Preco: parseFloat(form.Preco),
      Estoque: parseInt(form.Estoque || "0"),
      SecaoId: parseInt(form.SecaoId || "0"),
      ImagemUrl: form.ImagemUrl || ""
    };

    try {
      if (isEditing && form.Id) {
        await api.put(`/produtos/${form.Id}`, payload);
      } else {
        await api.post("/produtos", payload);
      }
      fecharModal();
      carregar();
    } catch (err) {
      console.error(err);
      setErro("Erro ao salvar produto.");
    }
  }

  async function excluir(id) {
      if (!window.confirm("Confirma exclusão do produto?")) return;
    try {
      await api.delete(`/produtos/${id}`);
      // ajustar página se necessário
      const next = Math.min(page, Math.max(1, Math.ceil((produtos.length - 1) / pageSize)));
      setPage(next);
      carregar();
    } catch (err) {
      console.error(err);
      setErro("Erro ao excluir produto.");
    }
  }

  function goToPage(n) {
    setPage(Math.max(1, Math.min(totalPages, n)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Produtos</h2>

      <div style={{ marginBottom: 12 }}>
        <button onClick={abrirNovo} style={{ marginRight: 8 }}>Novo Produto</button>
        <button onClick={carregar}>Atualizar Lista</button>
      </div>

      {loading ? (
        <div>Carregando...</div>
      ) : (
        <>
          {erro && <div style={{ color: "red", marginBottom: 8 }}>{erro}</div>}

          <div style={{ border: "1px solid #ddd", borderRadius: 4, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f5f5f5" }}>
                <tr>
                  <th style={{ padding: 8, textAlign: "left" }}>Nome</th>
                  <th style={{ padding: 8, width: 120 }}>Preço</th>
                  <th style={{ padding: 8, width: 100 }}>Estoque</th>
                  <th style={{ padding: 8, width: 120 }}>Seção</th>
                  <th style={{ padding: 8, width: 180 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 12, textAlign: "center" }}>Nenhum produto encontrado.</td>
                  </tr>
                ) : (
                  paginated.map(p => {
                    const id = p.Id ?? p.id;
                    const nome = p.Nome ?? p.nome;
                    const preco = p.Preco ?? p.preco;
                    const estoque = p.Estoque ?? p.estoque;
                    const secao = p.SecaoId ?? p.secaoId;
                    return (
                      <tr key={id} style={{ borderTop: "1px solid #eee" }}>
                        <td style={{ padding: 8 }}>{nome}</td>
                        <td style={{ padding: 8 }}>R$ {preco}</td>
                        <td style={{ padding: 8 }}>{estoque}</td>
                        <td style={{ padding: 8 }}>{secao}</td>
                        <td style={{ padding: 8 }}>
                          <button onClick={() => abrirEditar(p)} style={{ marginRight: 8 }}>Editar</button>
                          <button onClick={() => excluir(id)} style={{ color: "red" }}>Excluir</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* paginação */}
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => goToPage(page - 1)} disabled={page <= 1}>Anterior</button>
            <div>
              Página {page} de {totalPages}
            </div>
            <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>Próxima</button>

            {/* páginas rápidas (limitar range) */}
            <div style={{ marginLeft: "auto" }}>
              {Array.from({ length: totalPages }).slice(0, 20).map((_, i) => {
                const n = i + 1;
                return (
                  <button
                    key={n}
                    onClick={() => goToPage(n)}
                    style={{
                      marginLeft: 4,
                      padding: "4px 8px",
                      background: n === page ? "#007bff" : undefined,
                      color: n === page ? "#fff" : undefined,
                      borderRadius: 4,
                      border: "1px solid #ccc"
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Modal simples */}
      {isModalOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
        }}>
          <div style={{ width: 720, background: "#fff", padding: 16, borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
            <h3>{isEditing ? "Editar Produto" : "Novo Produto"}</h3>
            {erro && <div style={{ color: "red", marginBottom: 8 }}>{erro}</div>}
            <form onSubmit={salvar}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input name="Nome" placeholder="Nome" value={form.Nome} onChange={handleChange} style={{ flex: 1 }} />
                <input name="Preco" placeholder="Preço" value={form.Preco} onChange={handleChange} style={{ width: 140 }} />
                <input name="Estoque" placeholder="Estoque" value={form.Estoque} onChange={handleChange} style={{ width: 120 }} />
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input name="SecaoId" placeholder="Seção (Id)" value={form.SecaoId} onChange={handleChange} style={{ width: 140 }} />
                <input name="ImagemUrl" placeholder="URL da imagem (opcional)" value={form.ImagemUrl} onChange={handleChange} style={{ flex: 1 }} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={fecharModal}>Cancelar</button>
                <button type="submit">{isEditing ? "Atualizar" : "Cadastrar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}