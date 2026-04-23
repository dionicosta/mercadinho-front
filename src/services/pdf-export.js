import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function gerarCabecalho(doc, titulo, subtitulo) {
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

export function exportarRequisicoesPdf(lista = [], usuarioAtual = "") {
  const doc = new jsPDF({ orientation: "landscape" });
  gerarCabecalho(doc, "Relatorio de Requisicoes", `Gerado em ${formatarDataHora(new Date())} por ${usuarioAtual || "sistema"}`);

  autoTable(doc, {
    startY: 28,
    head: [["#", "Solicitante", "Tipo", "Data", "Status", "Assinado por", "Liberado por"]],
    body: lista.map((r) => [
      r.id,
      r.solicitante || "-",
      r.tipoSolicitante || "-",
      formatarData(r.data),
      r.status || "-",
      r.criadoPor || "-",
      r.aprovadoPor || "-"
    ])
  });

  doc.save(`requisicoes-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportarRequisicaoDetalhePdf(requisicao, usuarioAtual = "") {
  if (!requisicao) return;

  const doc = new jsPDF();
  gerarCabecalho(
    doc,
    `Requisicao #${requisicao.id}`,
    `Gerado em ${formatarDataHora(new Date())} por ${usuarioAtual || "sistema"}`
  );

  doc.setFontSize(10);
  doc.text(`Solicitante: ${requisicao.solicitante || "-"}`, 14, 32);
  doc.text(`Tipo: ${requisicao.tipoSolicitante || "-"}`, 14, 38);
  doc.text(`Data: ${formatarData(requisicao.data)}`, 14, 44);
  doc.text(`Status: ${requisicao.status || "-"}`, 14, 50);
  doc.text(`Assinado por: ${requisicao.criadoPor || "-"}`, 14, 56);
  doc.text(`Liberado por: ${requisicao.aprovadoPor || "-"}`, 14, 62);

  autoTable(doc, {
    startY: 68,
    head: [["Produto", "Qtd Solicitada", "Qtd Atendida"]],
    body: (requisicao.itens || []).map((it) => [
      it.produtoNome || it.produto?.nome || it.produtoId || "-",
      it.quantidadeSolicitada ?? "-",
      it.quantidadeAtendida ?? "-"
    ])
  });

  doc.save(`requisicao-${requisicao.id}.pdf`);
}

export function exportarNotasFiscaisPdf(lista = [], usuarioAtual = "") {
  const doc = new jsPDF({ orientation: "landscape" });
  gerarCabecalho(doc, "Relatorio de Notas Fiscais", `Gerado em ${formatarDataHora(new Date())} por ${usuarioAtual || "sistema"}`);

  autoTable(doc, {
    startY: 28,
    head: [["Numero", "Data Emissao", "Fornecedor", "Valor Total", "Criado por"]],
    body: lista.map((nf) => [
      nf.numero || "-",
      formatarData(nf.dataEmissao),
      nf.fornecedor?.razaoSocial || nf.fornecedorId || "-",
      formatarMoeda(nf.valorTotal),
      nf.criadoPor || "-"
    ])
  });

  doc.save(`notas-fiscais-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportarNotaFiscalDetalhePdf(nota, usuarioAtual = "") {
  if (!nota) return;

  const doc = new jsPDF();
  gerarCabecalho(
    doc,
    `Nota Fiscal #${nota.numero || nota.id}`,
    `Gerado em ${formatarDataHora(new Date())} por ${usuarioAtual || "sistema"}`
  );

  doc.setFontSize(10);
  doc.text(`Fornecedor: ${nota.fornecedor?.razaoSocial || "-"}`, 14, 32);
  doc.text(`Data de emissao: ${formatarData(nota.dataEmissao)}`, 14, 38);
  doc.text(`Criado por: ${nota.criadoPor || "-"}`, 14, 44);

  autoTable(doc, {
    startY: 50,
    head: [["Produto", "Quantidade", "Preco Unit.", "Total"]],
    body: (nota.itens || []).map((it) => {
      const total = Number(it.precoUnitario || 0) * Number(it.quantidade || 0);
      return [
        it.produtoNome || it.produto?.nome || it.produtoId || "-",
        it.quantidade ?? "-",
        formatarMoeda(it.precoUnitario),
        formatarMoeda(total)
      ];
    })
  });

  doc.text(`Valor total: ${formatarMoeda(nota.valorTotal)}`, 14, doc.lastAutoTable.finalY + 10);
  doc.save(`nota-fiscal-${nota.numero || nota.id}.pdf`);
}

export function exportarDashboardPdf(dados, usuarioAtual = "") {
  if (!dados) return;

  const doc = new jsPDF();
  gerarCabecalho(doc, "Relatorio do Dashboard", `Gerado em ${formatarDataHora(new Date())} por ${usuarioAtual || "sistema"}`);

  autoTable(doc, {
    startY: 28,
    head: [["Indicador", "Valor"]],
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
    ]
  });

  if ((dados.produtosEstoqueBaixo || []).length > 0) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [["Produtos com Estoque Baixo", "Estoque", "Minimo"]],
      body: dados.produtosEstoqueBaixo.map((p) => [p.nome, p.estoque, p.estoqueMinimo])
    });
  }

  doc.save(`dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
}