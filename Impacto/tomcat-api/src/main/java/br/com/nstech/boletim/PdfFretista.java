package br.com.nstech.boletim;

import br.com.nstech.boletim.EmailFretistas.Equip;
import br.com.nstech.boletim.EmailFretistas.Fretista;
import br.com.nstech.boletim.EmailFretistas.Producao;
import br.com.nstech.boletim.EmailFretistas.Tipo;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.util.Locale;

/**
 * Relatório de produção do fretista em PDF (enviado pelo WhatsApp). Mesmo conteúdo do e-mail diário: por função
 * do equipamento, viagens, toneladas e raio médio no dia anterior, dia atual, semana, período de fechamento e safra.
 */
final class PdfFretista {

    private static final Color AZUL = new Color(0x1c, 0x22, 0x60);
    private static final Color VERDE = new Color(0x2e, 0x9e, 0x5b);
    private static final Color CINZA_CLARO = new Color(0xf3, 0xf4, 0xf6);
    private static final Color VERDE_CLARO = new Color(0xea, 0xf5, 0xee);
    private static final Color LINHA = new Color(0xd9, 0xdc, 0xe1);
    private static final Color TEXTO = new Color(0x1f, 0x29, 0x37);
    private static final Color SUAVE = new Color(0x6b, 0x72, 0x80);

    private static final Font TITULO = new Font(Font.HELVETICA, 15, Font.BOLD, AZUL);
    private static final Font NORMAL = new Font(Font.HELVETICA, 9, Font.NORMAL, TEXTO);
    private static final Font NEGRITO = new Font(Font.HELVETICA, 9, Font.BOLD, TEXTO);
    private static final Font NOTA = new Font(Font.HELVETICA, 7, Font.NORMAL, SUAVE);
    private static final Font FAIXA = new Font(Font.HELVETICA, 9.5f, Font.BOLD, Color.WHITE);
    private static final Font CAB = new Font(Font.HELVETICA, 6.5f, Font.BOLD, AZUL);
    private static final Font CAB_DATA = new Font(Font.HELVETICA, 6, Font.NORMAL, SUAVE);
    private static final Font CAB_COL = new Font(Font.HELVETICA, 6, Font.BOLD, SUAVE);
    private static final Font CEL = new Font(Font.HELVETICA, 7, Font.NORMAL, TEXTO);
    private static final Font CEL_NEG = new Font(Font.HELVETICA, 7, Font.BOLD, TEXTO);
    private static final Font SUB = new Font(Font.HELVETICA, 7, Font.BOLD, AZUL);
    private static final Font TOTAL = new Font(Font.HELVETICA, 7.5f, Font.BOLD, Color.WHITE);

    private PdfFretista() {
    }

    static byte[] gerar(Fretista f, String dataRef, String[] rotulos, byte[] logo, String aviso) throws Exception {
        String[] intervalos = EmailFretistas.intervalos(dataRef);
        ByteArrayOutputStream out = new ByteArrayOutputStream(32 * 1024);
        Document doc = new Document(PageSize.A4.rotate(), 24, 24, 22, 22);
        PdfWriter.getInstance(doc, out);
        doc.addTitle("Produção de " + dataRef + " - " + f.nome);
        doc.addAuthor("Impacto Bioenergia");
        doc.open();

        // Cabeçalho: logo à esquerda, título e fretista à direita
        PdfPTable topo = new PdfPTable(new float[] {22, 78});
        topo.setWidthPercentage(100);
        Image img = Image.getInstance(logo);
        img.scaleToFit(130, 40);
        PdfPCell cLogo = new PdfPCell(img, false);
        cLogo.setBorder(Rectangle.BOTTOM);
        cLogo.setBorderColor(VERDE);
        cLogo.setBorderWidthBottom(2.5f);
        cLogo.setPaddingBottom(8);
        cLogo.setVerticalAlignment(Element.ALIGN_MIDDLE);
        topo.addCell(cLogo);
        Paragraph titulo = new Paragraph();
        titulo.setAlignment(Element.ALIGN_RIGHT);
        titulo.add(new Phrase("Sua produção de " + dataRef + "\n", TITULO));
        titulo.add(new Phrase("Fretista: ", NORMAL));
        titulo.add(new Phrase(f.nome, NEGRITO));
        titulo.add(new Phrase(" (código " + f.codigo + ")", NORMAL));
        PdfPCell cTitulo = new PdfPCell();
        cTitulo.addElement(titulo);
        cTitulo.setBorder(Rectangle.BOTTOM);
        cTitulo.setBorderColor(VERDE);
        cTitulo.setBorderWidthBottom(2.5f);
        cTitulo.setPaddingBottom(8);
        topo.addCell(cTitulo);
        doc.add(topo);

        if (aviso != null && !aviso.isEmpty()) {
            Paragraph p = new Paragraph(aviso, new Font(Font.HELVETICA, 8, Font.BOLD, new Color(0x92, 0x40, 0x0e)));
            p.setSpacingBefore(6);
            doc.add(p);
        }

        for (Tipo t : f.tipos.values()) {
            PdfPTable tab = tabela();
            tab.setSpacingBefore(10);
            PdfPCell faixa = new PdfPCell(new Phrase(t.descricao, FAIXA));
            faixa.setColspan(2 + 3 * EmailFretistas.PERIODOS.length);
            faixa.setBackgroundColor(AZUL);
            faixa.setBorder(Rectangle.NO_BORDER);
            faixa.setPadding(5);
            tab.addCell(faixa);
            cabecalho(tab, rotulos, intervalos, true);
            tab.setHeaderRows(3); // repete faixa e cabeçalho se a tabela quebrar de página
            for (Equip e : t.equipamentos) {
                tab.addCell(celula(e.codigo, CEL_NEG, Element.ALIGN_LEFT, null));
                tab.addCell(celula(e.descricao, CEL, Element.ALIGN_LEFT, null));
                producao(tab, e, CEL, null);
            }
            PdfPCell rot = celula("Total " + t.descricao, SUB, Element.ALIGN_LEFT, VERDE_CLARO);
            rot.setColspan(2);
            tab.addCell(rot);
            producao(tab, t, SUB, VERDE_CLARO);
            doc.add(tab);
        }

        PdfPTable geral = tabela();
        geral.setSpacingBefore(12);
        geral.setKeepTogether(true);
        cabecalho(geral, rotulos, intervalos, false);
        PdfPCell rot = celula("TOTAL GERAL", TOTAL, Element.ALIGN_LEFT, VERDE);
        rot.setColspan(2);
        geral.addCell(rot);
        producao(geral, f, TOTAL, VERDE);
        doc.add(geral);

        Paragraph nota = new Paragraph(
            "Dia atual: " + dataRef + ". Semana atual: de segunda-feira até o dia atual. Período 20 a 19: fechamento do dia 20 ao dia 19 "
            + "do mês seguinte, acumulado até o dia atual. Safra: acumulada até o dia atual. KM: raio médio das viagens, em km; nos totais, "
            + "média ponderada pela quantidade de viagens.\nRelatório automático da Impacto Bioenergia. Em caso de divergência, procure o "
            + "setor agrícola da usina.", NOTA);
        nota.setSpacingBefore(8);
        doc.add(nota);

        doc.close();
        return out.toByteArray();
    }

    private static PdfPTable tabela() {
        int n = EmailFretistas.PERIODOS.length;
        float[] larguras = new float[2 + 3 * n];
        larguras[0] = 5.5f;
        larguras[1] = 19f;
        for (int i = 0; i < n; i++) {
            larguras[2 + 3 * i] = 4.2f;
            larguras[3 + 3 * i] = 6.8f;
            larguras[4 + 3 * i] = 4.1f;
        }
        PdfPTable t = new PdfPTable(larguras);
        t.setWidthPercentage(100);
        return t;
    }

    private static void cabecalho(PdfPTable tab, String[] rotulos, String[] intervalos, boolean equipamento) {
        if (equipamento) {
            PdfPCell cod = celula("CÓD.", CAB_COL, Element.ALIGN_LEFT, CINZA_CLARO);
            cod.setRowspan(2);
            cod.setVerticalAlignment(Element.ALIGN_BOTTOM);
            tab.addCell(cod);
            PdfPCell desc = celula("DESCRIÇÃO", CAB_COL, Element.ALIGN_LEFT, CINZA_CLARO);
            desc.setRowspan(2);
            desc.setVerticalAlignment(Element.ALIGN_BOTTOM);
            tab.addCell(desc);
        } else {
            PdfPCell vazio = celula("", CAB_COL, Element.ALIGN_LEFT, CINZA_CLARO);
            vazio.setColspan(2);
            vazio.setRowspan(2);
            tab.addCell(vazio);
        }
        for (int i = 0; i < rotulos.length; i++) {
            Phrase ph = new Phrase();
            ph.add(new Phrase(rotulos[i].toUpperCase(new Locale("pt", "BR")) + "\n", CAB));
            ph.add(new Phrase(intervalos[i], CAB_DATA));
            PdfPCell c = new PdfPCell(ph);
            c.setColspan(3);
            c.setHorizontalAlignment(Element.ALIGN_CENTER);
            c.setBackgroundColor(CINZA_CLARO);
            c.setBorderColor(LINHA);
            c.setBorderWidth(0.5f);
            c.setPadding(3);
            tab.addCell(c);
        }
        for (int i = 0; i < rotulos.length; i++) {
            tab.addCell(celula("VIAG.", CAB_COL, Element.ALIGN_RIGHT, CINZA_CLARO));
            tab.addCell(celula("TON.", CAB_COL, Element.ALIGN_RIGHT, CINZA_CLARO));
            tab.addCell(celula("KM", CAB_COL, Element.ALIGN_RIGHT, CINZA_CLARO));
        }
    }

    private static void producao(PdfPTable tab, Producao p, Font fonte, Color fundo) {
        for (int i = 0; i < EmailFretistas.PERIODOS.length; i++) {
            tab.addCell(celula(EmailFretistas.inteiro(p.viagens[i]), fonte, Element.ALIGN_RIGHT, fundo));
            tab.addCell(celula(EmailFretistas.ton(p.toneladas[i]), fonte, Element.ALIGN_RIGHT, fundo));
            tab.addCell(celula(p.raio[i] == null ? "-" : EmailFretistas.ton(p.raio[i]), fonte, Element.ALIGN_RIGHT, fundo));
        }
    }

    private static PdfPCell celula(String texto, Font fonte, int alinhamento, Color fundo) {
        PdfPCell c = new PdfPCell(new Phrase(texto == null ? "" : texto, fonte));
        c.setHorizontalAlignment(alinhamento);
        c.setVerticalAlignment(Element.ALIGN_MIDDLE);
        c.setBorderColor(LINHA);
        c.setBorderWidth(0.5f);
        c.setPadding(3.2f);
        if (fundo != null) c.setBackgroundColor(fundo);
        return c;
    }
}
