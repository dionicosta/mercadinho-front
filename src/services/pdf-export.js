import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Nome da rede e da loja impressos no topo de todos os relatorios.
let identidadeRelatorio = "";

export function definirIdentidadeRelatorio(rede, loja) {
  identidadeRelatorio = [rede, loja].filter(Boolean).join(" - ");
}

function gerarCabecalho(doc, titulo, subtitulo) {
  if (identidadeRelatorio) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(identidadeRelatorio, 14, 9);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(titulo, 14, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (subtitulo) {
    doc.text(subtitulo, 14, 22);
  }
}

function formatarData(data) {
  if (!data) return "-";
  const dt = new Date(data);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("pt-BR");
}

function formatarDataHora(data) {
  if (!data) return "-";
  const dt = new Date(data);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("pt-BR");
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function escapeHtml(valor) {
  return String(valor ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderizarRelatorioPdf(relatorio) {
  const doc = new jsPDF({ orientation: relatorio.orientation || "portrait" });
  gerarCabecalho(doc, relatorio.titulo, relatorio.subtitulo);

  let currentY = 28;

  relatorio.secoes.forEach((secao) => {
    if (secao.type === "info") {
      doc.setFontSize(10);
      secao.items.forEach((item) => {
        doc.text(`${item.label}: ${item.value}`, 14, currentY);
        currentY += 6;
      });
      currentY += 4;
      return;
    }

    if (secao.type === "table") {
      if (secao.title) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(secao.title, 14, currentY);
        currentY += 6;
      }

      autoTable(doc, {
        startY: currentY,
        head: [secao.head],
        body: secao.body.length > 0 ? secao.body : [[secao.emptyMessage || "Sem dados"]],
        theme: "grid",
        headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81] }
      });

      currentY = doc.lastAutoTable.finalY + 8;
    }
  });

  return doc;
}

function construirSecaoInfoHtml(secao) {
  const items = secao.items.map((item) => (
    `<div class="info-item"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</div>`
  )).join("");

  return `<section class="report-section info-grid">${items}</section>`;
}

function construirSecaoTabelaHtml(secao) {
  const title = secao.title ? `<h2>${escapeHtml(secao.title)}</h2>` : "";
  const head = secao.head.map((coluna) => `<th>${escapeHtml(coluna)}</th>`).join("");
  const body = secao.body.length > 0
    ? secao.body.map((linha) => `<tr>${linha.map((coluna) => `<td>${escapeHtml(coluna)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${secao.head.length}">${escapeHtml(secao.emptyMessage || "Sem dados")}</td></tr>`;

  return `
    <section class="report-section">
      ${title}
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>`;
}

function abrirRelatorioParaImpressao(relatorio) {
  const secoesHtml = relatorio.secoes.map((secao) => {
    if (secao.type === "info") return construirSecaoInfoHtml(secao);
    if (secao.type === "table") return construirSecaoTabelaHtml(secao);
    return "";
  }).join("");

  const container = document.createElement("div");
  container.id = "report-print-root";
  container.innerHTML = `
    <div class="report-print-page">
      ${identidadeRelatorio ? `<p class="subtitle">${escapeHtml(identidadeRelatorio)}</p>` : ""}
      <h1>${escapeHtml(relatorio.titulo)}</h1>
      <p class="subtitle">${escapeHtml(relatorio.subtitulo)}</p>
      ${secoesHtml}
    </div>`;

  const style = document.createElement("style");
  style.id = "report-print-style";
  style.textContent = `
    #report-print-root {
      display: none;
    }

    #report-print-root .report-print-page {
      font-family: Arial, sans-serif;
      color: #111827;
      margin: 24px;
    }

    #report-print-root h1 {
      margin: 0 0 8px;
      font-size: 22px;
    }

    #report-print-root .subtitle {
      margin: 0 0 20px;
      color: #4b5563;
      font-size: 12px;
    }

    #report-print-root .report-section {
      margin-top: 16px;
    }

    #report-print-root .info-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 16px;
    }

    #report-print-root .info-item {
      font-size: 12px;
    }

    #report-print-root h2 {
      margin: 0 0 8px;
      font-size: 16px;
    }

    #report-print-root table {
      width: 100%;
      border-collapse: collapse;
    }

    #report-print-root th,
    #report-print-root td {
      border: 1px solid #d1d5db;
      padding: 8px;
      font-size: 12px;
      text-align: left;
    }

    #report-print-root th {
      background: #f3f4f6;
      color: #374151;
    }

    @media print {
      body.report-printing > *:not(#report-print-root):not(#report-print-style) {
        display: none !important;
      }

      body.report-printing #report-print-root {
        display: block !important;
      }

      body.report-printing {
        margin: 0;
        background: #fff;
      }

      body.report-printing #report-print-root .report-print-page {
        margin: 12mm;
      }

      body.report-printing #report-print-root .report-section {
        break-inside: avoid;
      }
    }
  `;

  const limpar = () => {
    document.body.classList.remove("report-printing");
    container.remove();
    style.remove();
    window.removeEventListener("afterprint", limpar);
  };

  document.head.appendChild(style);
  document.body.appendChild(container);
  document.body.classList.add("report-printing");
  window.addEventListener("afterprint", limpar);

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.print();
    });
  });
}

function criarRelatorioRequisicoes(lista = [], usuarioAtual = "") {
  return {
    titulo: "Relatorio de Requisicoes",
    subtitulo: `Gerado em ${formatarDataHora(new Date())} por ${usuarioAtual || "sistema"}`,
    orientation: "landscape",
    secoes: [
      {
        type: "table",
        head: ["#", "Solicitante", "Tipo", "Data", "Status", "Assinado por", "Liberado por"],
        body: lista.map((r) => [
          r.id,
          r.solicitante || "-",
          r.tipoSolicitante || "-",
          formatarData(r.data),
          r.status || "-",
          r.criadoPor || "-",
          r.aprovadoPor || "-"
        ]),
        emptyMessage: "Sem dados"
      }
    ]
  };
}

function criarRelatorioRequisicaoDetalhe(requisicao, usuarioAtual = "") {
  if (!requisicao) return null;

  return {
    titulo: `Requisicao #${requisicao.id}`,
    subtitulo: `Gerado em ${formatarDataHora(new Date())} por ${usuarioAtual || "sistema"}`,
    orientation: "portrait",
    secoes: [
      {
        type: "info",
        items: [
          { label: "Solicitante", value: requisicao.solicitante || "-" },
          { label: "Tipo", value: requisicao.tipoSolicitante || "-" },
          { label: "Data", value: formatarData(requisicao.data) },
          { label: "Status", value: requisicao.status || "-" },
          { label: "Assinado por", value: requisicao.criadoPor || "-" },
          { label: "Liberado por", value: requisicao.aprovadoPor || "-" }
        ]
      },
      {
        type: "table",
        head: ["Produto", "Qtd Solicitada", "Qtd Atendida"],
        body: (requisicao.itens || []).map((it) => [
          it.produtoNome || it.produto?.nome || it.produtoId || "-",
          it.quantidadeSolicitada ?? "-",
          it.quantidadeAtendida ?? "-"
        ]),
        emptyMessage: "Sem itens"
      }
    ]
  };
}

function criarRelatorioNotasFiscais(lista = [], usuarioAtual = "") {
  return {
    titulo: "Relatorio de Notas Fiscais",
    subtitulo: `Gerado em ${formatarDataHora(new Date())} por ${usuarioAtual || "sistema"}`,
    orientation: "landscape",
    secoes: [
      {
        type: "table",
        head: ["Numero", "Data Emissao", "Fornecedor", "Valor Total", "Criado por"],
        body: lista.map((nf) => [
          nf.numero || "-",
          formatarData(nf.dataEmissao),
          nf.fornecedor?.razaoSocial || nf.fornecedorId || "-",
          formatarMoeda(nf.valorTotal),
          nf.criadoPor || "-"
        ]),
        emptyMessage: "Sem dados"
      }
    ]
  };
}

function criarRelatorioNotaFiscalDetalhe(nota, usuarioAtual = "") {
  if (!nota) return null;

  return {
    titulo: `Nota Fiscal #${nota.numero || nota.id}`,
    subtitulo: `Gerado em ${formatarDataHora(new Date())} por ${usuarioAtual || "sistema"}`,
    orientation: "portrait",
    secoes: [
      {
        type: "info",
        items: [
          { label: "Fornecedor", value: nota.fornecedor?.razaoSocial || "-" },
          { label: "Data de emissao", value: formatarData(nota.dataEmissao) },
          { label: "Criado por", value: nota.criadoPor || "-" },
          { label: "Valor total", value: formatarMoeda(nota.valorTotal) }
        ]
      },
      {
        type: "table",
        head: ["Produto", "Quantidade", "Preco Unit.", "Total"],
        body: (nota.itens || []).map((it) => {
          const total = Number(it.precoUnitario || 0) * Number(it.quantidade || 0);
          return [
            it.produtoNome || it.produto?.nome || it.produtoId || "-",
            it.quantidade ?? "-",
            formatarMoeda(it.precoUnitario),
            formatarMoeda(total)
          ];
        }),
        emptyMessage: "Sem itens"
      }
    ]
  };
}

function criarRelatorioDashboard(dados, usuarioAtual = "") {
  if (!dados) return null;

  const secoes = [
    {
      type: "table",
      head: ["Indicador", "Valor"],
      body: [
        ["Produtos (total)", dados.produtos?.total ?? 0],
        ["Valor inventario", formatarMoeda(dados.produtos?.valorInventario)],
        ["Produtos abaixo minimo", dados.produtos?.abaixoMinimo ?? 0],
        ["Fornecedores ativos", dados.fornecedores?.ativos ?? 0],
        ["Fornecedores total", dados.fornecedores?.total ?? 0],
        ["Notas fiscais do mes", dados.notasFiscais?.totalMes ?? 0],
        ["Valor notas do mes", formatarMoeda(dados.notasFiscais?.valorMes)],
        ["Requisicoes pendentes", dados.requisicoes?.pendentes ?? 0],
        ["Requisicoes total do mes", dados.requisicoes?.totalMes ?? 0],
        ["Administradores", dados.admins?.total ?? 0],
        ["Tempo medio aprovacao (h)", dados.eficienciaAprovacao?.tempoMedioHoras ?? 0],
        ["Aprovadas ate 24h (%)", `${dados.eficienciaAprovacao?.percentualAprovadasAte24h ?? 0}%`]
      ],
      emptyMessage: "Sem dados"
    }
  ];

  if ((dados.produtosEstoqueBaixo || []).length > 0) {
    secoes.push({
      type: "table",
      title: "Produtos com Estoque Baixo",
      head: ["Produto", "Estoque", "Minimo"],
      body: dados.produtosEstoqueBaixo.map((p) => [p.nome, p.estoque, p.estoqueMinimo]),
      emptyMessage: "Sem dados"
    });
  }

  return {
    titulo: "Relatorio do Dashboard",
    subtitulo: `Gerado em ${formatarDataHora(new Date())} por ${usuarioAtual || "sistema"}`,
    orientation: "portrait",
    secoes
  };
}

export function exportarRequisicoesPdf(lista = [], usuarioAtual = "") {
  const doc = renderizarRelatorioPdf(criarRelatorioRequisicoes(lista, usuarioAtual));
  doc.save(`requisicoes-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportarRequisicaoDetalhePdf(requisicao, usuarioAtual = "") {
  const relatorio = criarRelatorioRequisicaoDetalhe(requisicao, usuarioAtual);
  if (!relatorio) return;
  const doc = renderizarRelatorioPdf(relatorio);
  doc.save(`requisicao-${requisicao.id}.pdf`);
}

export function exportarNotasFiscaisPdf(lista = [], usuarioAtual = "") {
  const doc = renderizarRelatorioPdf(criarRelatorioNotasFiscais(lista, usuarioAtual));
  doc.save(`notas-fiscais-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportarNotaFiscalDetalhePdf(nota, usuarioAtual = "") {
  const relatorio = criarRelatorioNotaFiscalDetalhe(nota, usuarioAtual);
  if (!relatorio) return;
  const doc = renderizarRelatorioPdf(relatorio);
  doc.save(`nota-fiscal-${nota.numero || nota.id}.pdf`);
}

export function exportarDashboardPdf(dados, usuarioAtual = "") {
  const relatorio = criarRelatorioDashboard(dados, usuarioAtual);
  if (!relatorio) return;
  const doc = renderizarRelatorioPdf(relatorio);
  doc.save(`dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function imprimirRequisicoesPdf(lista = [], usuarioAtual = "") {
  abrirRelatorioParaImpressao(criarRelatorioRequisicoes(lista, usuarioAtual));
}

export function imprimirRequisicaoDetalhePdf(requisicao, usuarioAtual = "") {
  const relatorio = criarRelatorioRequisicaoDetalhe(requisicao, usuarioAtual);
  if (!relatorio) return;
  abrirRelatorioParaImpressao(relatorio);
}

export function imprimirNotasFiscaisPdf(lista = [], usuarioAtual = "") {
  abrirRelatorioParaImpressao(criarRelatorioNotasFiscais(lista, usuarioAtual));
}

export function imprimirNotaFiscalDetalhePdf(nota, usuarioAtual = "") {
  const relatorio = criarRelatorioNotaFiscalDetalhe(nota, usuarioAtual);
  if (!relatorio) return;
  abrirRelatorioParaImpressao(relatorio);
}

export function imprimirDashboardPdf(dados, usuarioAtual = "") {
  const relatorio = criarRelatorioDashboard(dados, usuarioAtual);
  if (!relatorio) return;
  abrirRelatorioParaImpressao(relatorio);
}