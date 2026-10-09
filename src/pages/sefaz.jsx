import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { extrairErro } from "../services/api";
import "./rede.css";

const UFS = [
  [12, "AC"], [27, "AL"], [16, "AP"], [13, "AM"], [29, "BA"], [23, "CE"], [53, "DF"], [32, "ES"], [52, "GO"],
  [21, "MA"], [51, "MT"], [50, "MS"], [31, "MG"], [15, "PA"], [25, "PB"], [41, "PR"], [26, "PE"], [22, "PI"],
  [33, "RJ"], [24, "RN"], [43, "RS"], [11, "RO"], [14, "RR"], [42, "SC"], [35, "SP"], [28, "SE"], [17, "TO"],
];

const MANIFESTACAO = {
  NENHUMA: { rotulo: "Sem manifestação", classe: "" },
  CIENCIA: { rotulo: "Ciência", classe: "rd-badge-azul" },
  CONFIRMADA: { rotulo: "Confirmada", classe: "rd-badge-verde" },
  DESCONHECIDA: { rotulo: "Desconhecida", classe: "rd-badge-vermelho" },
  NAO_REALIZADA: { rotulo: "Não realizada", classe: "rd-badge-vermelho" },
};

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Le o arquivo do certificado e devolve em Base64 (o conteudo so trafega para a API, por HTTPS).
function lerBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(",")[1] ?? "");
    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });
}

function Sefaz({ sessao }) {
  const navegar = useNavigate();
  const isSuperAdmin = !!sessao?.isSuperAdmin;
  const podeOperar = !!sessao?.isPrincipal;

  const [certificado, setCertificado] = useState(null);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const [arquivo, setArquivo] = useState(null);
  const [formCert, setFormCert] = useState({ senha: "", codigoUf: "35", ambiente: "1" });
  const [erroCert, setErroCert] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [respCert, respDocs] = await Promise.all([api.get("/fiscal/certificado"), api.get("/fiscal/documentos")]);
      setCertificado(respCert.data);
      setDocumentos(respDocs.data || []);
    } catch (err) {
      setErro(extrairErro(err, "Falha ao carregar os dados fiscais."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function enviarCertificado(e) {
    e.preventDefault();
    setErroCert(null);
    setAviso(null);
    if (!arquivo) {
      setErroCert("Escolha o arquivo do certificado (.pfx ou .p12).");
      return;
    }
    if (arquivo.size > 100_000) {
      setErroCert("Arquivo grande demais para ser um certificado A1.");
      return;
    }
    setOcupado(true);
    try {
      await api.put("/fiscal/certificado", {
        pfxBase64: await lerBase64(arquivo),
        senha: formCert.senha,
        codigoUf: Number(formCert.codigoUf),
        ambiente: Number(formCert.ambiente),
      });
      setArquivo(null);
      setFormCert((p) => ({ ...p, senha: "" }));
      setAviso("Certificado instalado.");
      await carregar();
    } catch (err) {
      setErroCert(extrairErro(err, "Erro ao instalar o certificado."));
    } finally {
      setOcupado(false);
    }
  }

  async function removerCertificado() {
    if (!window.confirm("Remover o certificado desta loja? A consulta à SEFAZ deixa de funcionar até outro ser instalado.")) return;
    try {
      await api.delete("/fiscal/certificado");
      await carregar();
    } catch (err) {
      setErro(extrairErro(err, "Erro ao remover o certificado."));
    }
  }

  async function sincronizar() {
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      const resp = await api.post("/fiscal/sincronizar");
      setAviso(`${resp.data.novos} documento(s) novo(s). SEFAZ: ${resp.data.mensagem}`);
      await carregar();
    } catch (err) {
      setErro(extrairErro(err, "Erro ao consultar a SEFAZ."));
    } finally {
      setOcupado(false);
    }
  }

  async function manifestar(documento, tipo) {
    let justificativa = null;
    if (tipo === "NAO_REALIZADA") {
      justificativa = window.prompt("Justificativa (mínimo de 15 caracteres):");
      if (!justificativa) return;
    } else {
      const textos = {
        CIENCIA: "Registrar ciência desta nota? A SEFAZ passa a liberar o XML completo.",
        CONFIRMADA: "Confirmar que a operação aconteceu e a mercadoria foi recebida? Esta manifestação é definitiva.",
        DESCONHECIDA: "Declarar que a loja desconhece esta operação? Use quando a nota foi emitida indevidamente contra o seu CNPJ.",
      };
      if (!window.confirm(textos[tipo])) return;
    }
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      const resp = await api.post(`/fiscal/documentos/${documento.id}/manifestar`, { tipo, justificativa });
      setAviso(`Manifestação registrada. SEFAZ: ${resp.data.mensagem}`);
      await carregar();
    } catch (err) {
      setErro(extrairErro(err, "Erro ao manifestar."));
    } finally {
      setOcupado(false);
    }
  }

  if (loading) return <div className="rd-container"><p className="rd-vazio">Carregando...</p></div>;

  const diasParaVencer = certificado?.validoAte ? Math.floor((new Date(certificado.validoAte) - new Date()) / 86400000) : null;
  const proxima = certificado?.proximaConsultaEm ? new Date(certificado.proximaConsultaEm) : null;
  const emEspera = proxima && proxima > new Date();

  return (
    <div className="rd-container">
      <div className="rd-header">
        <div>
          <h2 className="rd-titulo">Notas na SEFAZ</h2>
          <p className="rd-subtitulo">Notas emitidas contra o CNPJ de {sessao?.loja?.nome || "esta loja"}, buscadas direto na SEFAZ com o certificado digital.</p>
        </div>
        {certificado?.instalado && podeOperar && (
          <button className="rd-btn rd-btn-primario" onClick={sincronizar} disabled={ocupado || emEspera || certificado.vencido}
            title={emEspera ? `A SEFAZ só permite nova consulta após ${proxima.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}>
            {ocupado ? "Consultando..." : "Buscar notas novas"}
          </button>
        )}
      </div>

      {erro && <p className="rd-erro">{erro}</p>}
      {aviso && <p className="rd-sucesso">{aviso}</p>}

      <div className="rd-card">
        <h3>Certificado digital (A1)</h3>
        {certificado?.instalado ? (
          <>
            <p className="rd-ajuda">
              <strong>{certificado.titular}</strong> · CNPJ {certificado.cnpj} · válido até {new Date(certificado.validoAte).toLocaleDateString("pt-BR")}{" "}
              {certificado.vencido
                ? <span className="rd-badge rd-badge-vermelho">vencido</span>
                : diasParaVencer !== null && diasParaVencer <= 30 && <span className="rd-badge rd-badge-amarelo">vence em {diasParaVencer} dia(s)</span>}
            </p>
            <p className="rd-ajuda">
              Ambiente: {certificado.ambiente === 1 ? "produção" : "homologação"}
              {certificado.ultimaConsultaEm && ` · Última consulta: ${new Date(certificado.ultimaConsultaEm).toLocaleString("pt-BR")}`}
              {emEspera && ` · Próxima consulta permitida: ${proxima.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
            </p>
            {isSuperAdmin && <button className="rd-btn rd-btn-pequeno rd-btn-perigo" style={{ marginTop: 8 }} onClick={removerCertificado}>Remover certificado</button>}
          </>
        ) : (
          <p className="rd-ajuda">Nenhum certificado instalado para esta loja. Sem ele, as notas entram pela importação do XML enviado pelo fornecedor.</p>
        )}

        {!certificado?.servidorConfigurado && (
          <p className="rd-erro">Este servidor ainda não foi preparado para guardar certificados. Fale com o suporte.</p>
        )}

        {isSuperAdmin && certificado?.servidorConfigurado && (
          <form className="rd-form" style={{ marginTop: 14 }} onSubmit={enviarCertificado}>
            <strong>{certificado.instalado ? "Substituir certificado" : "Instalar certificado"}</strong>
            <div className="rd-form-linha">
              <label>
                Arquivo (.pfx / .p12)
                <input type="file" accept=".pfx,.p12" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
              </label>
              <label>
                Senha do certificado
                <input type="password" autoComplete="off" required value={formCert.senha} onChange={(e) => setFormCert((p) => ({ ...p, senha: e.target.value }))} />
              </label>
              <label>
                UF da loja
                <select value={formCert.codigoUf} onChange={(e) => setFormCert((p) => ({ ...p, codigoUf: e.target.value }))}>
                  {UFS.slice().sort((a, b) => a[1].localeCompare(b[1])).map(([codigo, sigla]) => (
                    <option key={codigo} value={codigo}>{sigla}</option>
                  ))}
                </select>
              </label>
              <label>
                Ambiente
                <select value={formCert.ambiente} onChange={(e) => setFormCert((p) => ({ ...p, ambiente: e.target.value }))}>
                  <option value="1">Produção</option>
                  <option value="2">Homologação (testes)</option>
                </select>
              </label>
            </div>
            <span className="rd-ajuda">O certificado é guardado cifrado no servidor e nunca é exibido de volta. O CNPJ da loja precisa estar cadastrado e ser o mesmo do certificado.</span>
            {erroCert && <p className="rd-erro">{erroCert}</p>}
            <div>
              <button type="submit" className="rd-btn rd-btn-primario" disabled={ocupado}>Enviar certificado</button>
            </div>
          </form>
        )}
      </div>

      <div className="rd-card">
        <h3>Notas localizadas</h3>
        {documentos.length === 0 ? (
          <p className="rd-vazio">Nenhuma nota localizada ainda.</p>
        ) : (
          <div className="rd-tabela-wrap">
            <table className="rd-tabela">
              <thead>
                <tr>
                  <th>Emissão</th>
                  <th>Emitente</th>
                  <th>Número</th>
                  <th className="rd-num">Valor</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {documentos.map((d) => {
                  const m = MANIFESTACAO[d.manifestacao] ?? { rotulo: d.manifestacao, classe: "" };
                  const definitiva = ["CONFIRMADA", "DESCONHECIDA", "NAO_REALIZADA"].includes(d.manifestacao);
                  return (
                    <tr key={d.id}>
                      <td>{d.dataEmissao ? new Date(d.dataEmissao).toLocaleDateString("pt-BR") : "—"}</td>
                      <td>
                        {d.emitenteNome}
                        <div className="rd-ajuda">{d.emitenteCnpj}</div>
                      </td>
                      <td>{d.numero ?? "—"}</td>
                      <td className="rd-num">{moeda(d.valorTotal)}</td>
                      <td>
                        <span className={`rd-badge ${m.classe}`}>{m.rotulo}</span>{" "}
                        {d.cancelada && <span className="rd-badge rd-badge-vermelho">cancelada pelo emitente</span>}{" "}
                        {d.notaFiscalId && <span className="rd-badge rd-badge-verde">importada</span>}{" "}
                        {d.tipo === "RESUMO" && !d.cancelada && <span className="rd-badge">só resumo</span>}
                      </td>
                      <td>
                        <div className="rd-acoes">
                          {d.podeImportar && (
                            <button className="rd-btn rd-btn-pequeno rd-btn-sucesso" onClick={() => navegar(`/notas-fiscais?documento=${d.id}`)}>Importar</button>
                          )}
                          {podeOperar && !d.cancelada && d.manifestacao === "NENHUMA" && (
                            <button className="rd-btn rd-btn-pequeno rd-btn-primario" disabled={ocupado} onClick={() => manifestar(d, "CIENCIA")}>Ciência</button>
                          )}
                          {podeOperar && !d.cancelada && !definitiva && (
                            <>
                              <button className="rd-btn rd-btn-pequeno" disabled={ocupado} onClick={() => manifestar(d, "CONFIRMADA")}>Confirmar</button>
                              <button className="rd-btn rd-btn-pequeno" disabled={ocupado} onClick={() => manifestar(d, "NAO_REALIZADA")}>Não realizada</button>
                              <button className="rd-btn rd-btn-pequeno rd-btn-perigo" disabled={ocupado} onClick={() => manifestar(d, "DESCONHECIDA")}>Desconheço</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="rd-ajuda" style={{ marginTop: 10 }}>
          Fluxo: a SEFAZ entrega primeiro só o resumo da nota. Depois da <strong>ciência</strong>, a próxima busca traz o XML completo e a nota pode ser importada.
          Ao receber a mercadoria, <strong>confirme</strong> a operação.
        </p>
      </div>
    </div>
  );
}

export default Sefaz;
