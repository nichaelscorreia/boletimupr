package br.com.nstech.boletim;

import br.com.nstech.boletim.ConnectionPool.Pooled;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.regex.Pattern;
import javax.activation.DataHandler;
import javax.mail.Message;
import javax.mail.Session;
import javax.mail.Transport;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeBodyPart;
import javax.mail.internet.MimeMessage;
import javax.mail.internet.MimeMultipart;
import javax.mail.util.ByteArrayDataSource;
import javax.servlet.ServletContext;

/**
 * E-mail diário dos fretistas: cada fornecedor recebe SOMENTE a sua produção (transporte e colheita), em viagens
 * e toneladas, no dia anterior, no dia de referência (dia atual), na semana, no período de fechamento (20 a 19) e na safra, com quebra por tipo de equipamento, totais por
 * tipo e total geral. Só recebe quem produziu no dia de referência.
 *
 * Envios ficam registrados em NST_EMAIL_ENVIO: um fretista não recebe duas vezes o mesmo dia (a menos que se
 * peça reenvio). Com EMAIL_DESTINO_TESTE preenchido, todos os e-mails vão só para esse endereço.
 */
final class EmailFretistas {

    static final String ROTINA = "FRETISTAS";
    private static final Pattern EMAIL = Pattern.compile("[^@\\s<>]+@[^@\\s<>]+\\.[^@\\s<>]+");
    private static final String AZUL = "#1c2260";
    private static final String VERDE = "#2e9e5b";

    /** Períodos exibidos, na ordem das colunas do e-mail. */
    private static final String[] PERIODOS = {"DIAANTERIOR", "DIAATUAL", "SEMANA", "MES", "SAFRA"};
    private static final String[] CHAVES = {"DiaAnterior", "", "Semana", "Periodo", "Safra"}; // sufixos no JSON da prévia
    private static final int DIA = 1; // dia atual = data de referência
    private final String[] rotulos;

    /** Viagens e toneladas em cada período (índices de PERIODOS). */
    static class Producao {
        final int[] viagens = new int[PERIODOS.length];
        final double[] toneladas = new double[PERIODOS.length];
        /** Raio médio por período; null = sem movimento no período. Só existe por equipamento (médias não se somam). */
        final Double[] raio = new Double[PERIODOS.length];

        void somar(Producao o) {
            for (int i = 0; i < PERIODOS.length; i++) {
                viagens[i] += o.viagens[i];
                toneladas[i] += o.toneladas[i];
            }
        }
    }

    static final class Equip extends Producao {
        String codigo;
        String descricao;
    }

    static final class Tipo extends Producao {
        String descricao;
        final List<Equip> equipamentos = new ArrayList<Equip>();
    }

    static final class Fretista extends Producao {
        int codigo;
        String nome;
        String emailCadastro;
        final Map<String, Tipo> tipos = new LinkedHashMap<String, Tipo>();
    }

    static final class Resultado {
        String dataRef;
        boolean modoTeste;
        int fretistas;
        int enviados;
        int jaEnviados;
        int falhas;
        final List<String> detalhes = new ArrayList<String>();
    }

    private final ApiConfig cfg;
    private final ConnectionPool pool;
    private final ServletContext ctx;
    private final NamedSql sql;
    private final byte[] logo;
    private volatile boolean tabelaOk;

    EmailFretistas(ApiConfig cfg, ConnectionPool pool, ServletContext ctx) throws IOException {
        this.cfg = cfg;
        this.pool = pool;
        this.ctx = ctx;
        this.sql = NamedSql.parse(new String(recurso("/sql/email_fretistas.sql"), StandardCharsets.UTF_8));
        this.logo = recurso("/email/LogoImpacto.png");
        this.rotulos = new String[] {"Dia anterior", "Dia atual", "Semana atual", "Período 20 a 19", "Safra " + cfg.emailSafraRotulo};
    }

    boolean smtpConfigurado() {
        return !cfg.smtpUser.isEmpty() && !cfg.smtpPassword.isEmpty();
    }

    boolean modoTeste() {
        return !cfg.emailDestinoTeste.isEmpty();
    }

    // ---------------------------------------------------------------- dados

    /**
     * Produção até o dia de referência (dd/mm/aaaa), agrupada por fretista -> tipo de equipamento -> equipamento.
     * Traz só os fretistas com produção no dia; deles, todos os equipamentos que já produziram na safra.
     */
    List<Fretista> carregar(String dataRef) throws Exception {
        Map<Integer, Fretista> mapa = new LinkedHashMap<Integer, Fretista>();
        Pooled p = pool.borrow();
        boolean broken = false;
        try {
            PreparedStatement ps = p.con.prepareStatement(sql.jdbcSql);
            try {
                ps.setQueryTimeout(cfg.queryTimeoutSeconds);
                for (int i = 0; i < sql.paramNames.size(); i++) {
                    String n = sql.paramNames.get(i);
                    if ("dataRef".equals(n)) ps.setString(i + 1, dataRef);
                    else if ("grupoEmpresa".equals(n)) ps.setInt(i + 1, cfg.codGrupoEmpresa);
                    else if ("empresa".equals(n)) ps.setInt(i + 1, cfg.codEmpresa);
                    else if ("filial".equals(n)) ps.setInt(i + 1, cfg.codFilial);
                    else if ("safra".equals(n)) ps.setInt(i + 1, cfg.safraPadrao);
                    else throw new IllegalStateException("Parâmetro desconhecido no SQL de fretistas: " + n);
                }
                ResultSet rs = ps.executeQuery();
                try {
                    while (rs.next()) {
                        int cod = rs.getInt("COD_FORNECEDOR");
                        Fretista f = mapa.get(cod);
                        if (f == null) {
                            f = new Fretista();
                            f.codigo = cod;
                            f.nome = limpo(rs.getString("FORNECEDOR"), "Fornecedor " + cod);
                            f.emailCadastro = limpo(rs.getString("EMAIL"), "");
                            mapa.put(cod, f);
                        }
                        String chaveTipo = rs.getString("COD_TIPOEQUIPAMENTO");
                        Tipo t = f.tipos.get(chaveTipo);
                        if (t == null) {
                            t = new Tipo();
                            t.descricao = limpo(rs.getString("DESCRICAOTIPOEQUIPAMENTO"), "Tipo " + chaveTipo);
                            f.tipos.put(chaveTipo, t);
                        }
                        Equip e = new Equip();
                        e.codigo = limpo(rs.getString("COD_EQUIPAMENTO"), "");
                        e.descricao = limpo(rs.getString("EQUIPAMENTO"), "");
                        for (int i = 0; i < PERIODOS.length; i++) {
                            e.viagens[i] = rs.getInt("VIAGENS" + PERIODOS[i]);
                            e.toneladas[i] = rs.getDouble("PESOLIQUIDO" + PERIODOS[i]);
                            double raio = rs.getDouble("RAIOMEDIO" + PERIODOS[i]);
                            e.raio[i] = rs.wasNull() ? null : Double.valueOf(raio);
                        }
                        t.equipamentos.add(e);
                        t.somar(e);
                        f.somar(e);
                    }
                } finally {
                    rs.close();
                }
            } finally {
                ps.close();
            }
        } catch (SQLException e) {
            broken = true;
            throw e;
        } finally {
            pool.release(p, broken);
        }
        List<Fretista> lista = new ArrayList<Fretista>();
        for (Fretista f : mapa.values()) {
            if (f.viagens[DIA] > 0 || f.toneladas[DIA] > 0) lista.add(f);
        }
        return lista;
    }

    // ---------------------------------------------------------------- envio

    /**
     * Envia os e-mails do dia de referência.
     * @param reenviar    true envia mesmo para quem já recebeu esse dia
     * @param soFornecedor código de um único fornecedor (null = todos)
     */
    synchronized Resultado enviar(String dataRef, boolean reenviar, Integer soFornecedor) throws Exception {
        if (!smtpConfigurado()) throw new IllegalStateException("SMTP_USER/SMTP_PASSWORD não configurados");
        garantirTabela();

        Resultado r = new Resultado();
        r.dataRef = dataRef;
        r.modoTeste = modoTeste();
        List<Fretista> lista = carregar(dataRef);

        // JavaMail localiza seus manipuladores pelo classloader do contexto: garante o da aplicação
        Thread atual = Thread.currentThread();
        ClassLoader anterior = atual.getContextClassLoader();
        atual.setContextClassLoader(EmailFretistas.class.getClassLoader());
        Transport transporte = null;
        try {
            Session sessao = Session.getInstance(propriedadesSmtp());
            for (Fretista f : lista) {
                if (soFornecedor != null && soFornecedor != f.codigo) continue;
                r.fretistas++;
                if (!reenviar && jaEnviado(dataRef, f.codigo)) {
                    r.jaEnviados++;
                    continue;
                }
                List<InternetAddress> destinos = destinatarios(f);
                List<InternetAddress> copias = copias(destinos);
                String destinoTxt = enderecos(destinos) + (copias.isEmpty() ? "" : " (cc: " + enderecos(copias) + ")");
                try {
                    if (destinos.isEmpty()) throw new IllegalStateException("e-mail do cadastro inválido: " + f.emailCadastro);
                    if (transporte == null) {
                        transporte = sessao.getTransport("smtp");
                        transporte.connect(cfg.smtpHost, cfg.smtpPort, cfg.smtpUser, cfg.smtpPassword);
                    }
                    MimeMessage msg = montar(sessao, f, dataRef, destinos, copias);
                    transporte.sendMessage(msg, msg.getAllRecipients());
                    registrar(dataRef, f, destinoTxt, "E", null);
                    r.enviados++;
                    r.detalhes.add(f.codigo + " " + f.nome + " -> " + destinoTxt);
                    Thread.sleep(1500); // respeita o limite de mensagens por minuto do servidor
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw ie;
                } catch (Exception e) {
                    r.falhas++;
                    String erro = resumo(e);
                    r.detalhes.add(f.codigo + " " + f.nome + " FALHOU: " + erro);
                    ctx.log("E-mail fretistas: falha para " + f.codigo + " " + f.nome, e);
                    registrar(dataRef, f, destinoTxt, "F", erro);
                    // Conexão pode ter caído: reabre no próximo
                    if (transporte != null && !transporte.isConnected()) {
                        fechar(transporte);
                        transporte = null;
                    }
                }
            }
        } finally {
            fechar(transporte);
            atual.setContextClassLoader(anterior);
        }
        ctx.log("E-mail fretistas " + dataRef + (r.modoTeste ? " [TESTE -> " + cfg.emailDestinoTeste + "]" : "")
            + ": fretistas=" + r.fretistas + " enviados=" + r.enviados + " já enviados=" + r.jaEnviados + " falhas=" + r.falhas);
        return r;
    }

    private Properties propriedadesSmtp() {
        Properties p = new Properties();
        p.put("mail.transport.protocol", "smtp");
        p.put("mail.smtp.host", cfg.smtpHost);
        p.put("mail.smtp.port", String.valueOf(cfg.smtpPort));
        p.put("mail.smtp.auth", "true");
        p.put("mail.smtp.starttls.enable", "true");
        p.put("mail.smtp.starttls.required", "true"); // nunca envia a senha sem criptografia
        p.put("mail.smtp.ssl.protocols", "TLSv1.2 TLSv1.3");
        p.put("mail.smtp.connectiontimeout", "20000");
        p.put("mail.smtp.timeout", "30000");
        p.put("mail.smtp.writetimeout", "30000");
        return p;
    }

    /** Em modo de teste, tudo vai só para EMAIL_DESTINO_TESTE; senão, para o(s) e-mail(s) do cadastro. */
    private List<InternetAddress> destinatarios(Fretista f) {
        return enderecosDe(modoTeste() ? cfg.emailDestinoTeste : f.emailCadastro);
    }

    /** Cópia (CC) de EMAIL_COPIA, sem repetir quem já está como destinatário principal. */
    private List<InternetAddress> copias(List<InternetAddress> destinos) {
        List<InternetAddress> lista = new ArrayList<InternetAddress>();
        for (InternetAddress c : enderecosDe(cfg.emailCopia)) {
            boolean repetido = false;
            for (InternetAddress d : destinos) repetido |= d.getAddress().equalsIgnoreCase(c.getAddress());
            if (!repetido) lista.add(c);
        }
        return lista;
    }

    private static List<InternetAddress> enderecosDe(String origem) {
        List<InternetAddress> lista = new ArrayList<InternetAddress>();
        for (String e : origem.split("[;,\\s]+")) {
            if (EMAIL.matcher(e).matches()) {
                try {
                    lista.add(new InternetAddress(e, true));
                } catch (Exception ignore) {
                    // endereço malformado: ignora
                }
            }
        }
        return lista;
    }

    private static String enderecos(List<InternetAddress> lista) {
        StringBuilder sb = new StringBuilder();
        for (InternetAddress a : lista) sb.append(sb.length() > 0 ? "; " : "").append(a.getAddress());
        return sb.toString();
    }

    private MimeMessage montar(Session sessao, Fretista f, String dataRef, List<InternetAddress> destinos,
                               List<InternetAddress> copias) throws Exception {
        MimeMessage msg = new MimeMessage(sessao);
        msg.setFrom(new InternetAddress(cfg.smtpUser, cfg.emailRemetenteNome, "UTF-8"));
        msg.setRecipients(Message.RecipientType.TO, destinos.toArray(new InternetAddress[0]));
        if (!copias.isEmpty()) msg.setRecipients(Message.RecipientType.CC, copias.toArray(new InternetAddress[0]));
        msg.setSubject((modoTeste() ? "[TESTE] " : "") + "Impacto Bioenergia - Sua produção de " + dataRef + " - " + f.nome, "UTF-8");
        msg.setHeader("Auto-Submitted", "auto-generated");

        MimeBodyPart texto = new MimeBodyPart();
        texto.setText(texto(f, dataRef), "UTF-8");
        MimeBodyPart html = new MimeBodyPart();
        html.setContent(html(f, dataRef), "text/html; charset=UTF-8");
        MimeMultipart alternativa = new MimeMultipart("alternative");
        alternativa.addBodyPart(texto);
        alternativa.addBodyPart(html);
        MimeBodyPart corpo = new MimeBodyPart();
        corpo.setContent(alternativa);

        MimeBodyPart imagem = new MimeBodyPart();
        imagem.setDataHandler(new DataHandler(new ByteArrayDataSource(logo, "image/png")));
        imagem.setContentID("<logo-impacto>");
        imagem.setDisposition(MimeBodyPart.INLINE);
        imagem.setFileName("impacto.png");

        MimeMultipart relacionado = new MimeMultipart("related");
        relacionado.addBodyPart(corpo);
        relacionado.addBodyPart(imagem);
        msg.setContent(relacionado);
        msg.saveChanges();
        return msg;
    }

    // ---------------------------------------------------------------- layout

    private static final DecimalFormatSymbols BR = new DecimalFormatSymbols(new Locale("pt", "BR"));

    private static String ton(double v) {
        // Arredondamento convencional (meio para cima) a partir do valor decimal exato vindo do banco
        java.math.BigDecimal d = new java.math.BigDecimal(String.valueOf(v)).setScale(2, java.math.RoundingMode.HALF_UP);
        return new DecimalFormat("#,##0.00", BR).format(d);
    }

    private static String inteiro(int v) {
        return new DecimalFormat("#,##0", BR).format(v);
    }

    /** Intervalo de cada período até o dia de referência (semana começa na segunda-feira, como no SQL). */
    private static String[] intervalos(String dataRef) {
        java.time.format.DateTimeFormatter completo = java.time.format.DateTimeFormatter.ofPattern("dd/MM/uuuu");
        java.time.format.DateTimeFormatter curto = java.time.format.DateTimeFormatter.ofPattern("dd/MM");
        java.time.LocalDate d = java.time.LocalDate.parse(dataRef, completo);
        java.time.LocalDate segunda = d.with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
        // Fechamento: do dia 20 ao dia 19 do mês seguinte, o que contém o dia de referência
        java.time.LocalDate inicio = (d.getDayOfMonth() >= 20 ? d : d.minusMonths(1)).withDayOfMonth(20);
        return new String[] {
            curto.format(d.minusDays(1)),
            curto.format(d),
            curto.format(segunda) + " a " + curto.format(d),
            curto.format(inicio) + " a " + curto.format(inicio.plusMonths(1).withDayOfMonth(19)),
            "até " + curto.format(d)
        };
    }

    private static void celulasProducao(StringBuilder h, Producao p, String estilo) {
        for (int i = 0; i < PERIODOS.length; i++) {
            String borda = "border-left:1px solid #e5e7eb;";
            h.append("<td style=\"").append(estilo).append(borda).append("\">").append(inteiro(p.viagens[i])).append("</td>")
             .append("<td style=\"").append(estilo).append("\">").append(ton(p.toneladas[i])).append("</td>")
             .append("<td style=\"").append(estilo).append("\">").append(p.raio[i] == null ? "&ndash;" : ton(p.raio[i])).append("</td>");
        }
    }

    String html(Fretista f, String dataRef) {
        String[] intervalos = intervalos(dataRef);
        String celula = "padding:7px 5px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#1f2937;";
        String num = celula + "text-align:right;white-space:nowrap;";
        String cab = "padding:6px 5px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:11px;color:#6b7280;font-weight:bold;";
        int colunas = 2 + 3 * PERIODOS.length;
        StringBuilder h = new StringBuilder(8192);
        h.append("<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"UTF-8\">")
         .append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"></head>")
         .append("<body style=\"margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;\">")
         .append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f3f4f6;\"><tr><td align=\"center\" style=\"padding:20px 10px;\">")
         .append("<table role=\"presentation\" width=\"1000\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:1000px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;\">");

        if (modoTeste()) {
            h.append("<tr><td style=\"background:#fef3c7;color:#92400e;padding:10px 24px;font-size:13px;\">")
             .append("<b>E-mail de teste.</b> Em produção, este e-mail seria enviado para: <b>")
             .append(esc(f.emailCadastro.isEmpty() ? "(sem e-mail no cadastro)" : f.emailCadastro)).append("</b>")
             .append(cfg.emailCopia.isEmpty() ? "" : ", com cópia para <b>" + esc(cfg.emailCopia) + "</b>").append("</td></tr>");
        }

        h.append("<tr><td style=\"padding:20px 24px 14px;border-bottom:4px solid ").append(VERDE).append(";\">")
         .append("<img src=\"cid:logo-impacto\" alt=\"Impacto Bioenergia\" height=\"48\" style=\"height:48px;display:block;border:0;\">")
         .append("</td></tr>")
         .append("<tr><td style=\"padding:20px 24px 6px;\">")
         .append("<div style=\"font-size:20px;font-weight:bold;color:").append(AZUL).append(";\">Sua produção de ").append(esc(dataRef)).append("</div>")
         .append("<div style=\"font-size:14px;color:#4b5563;margin-top:6px;\">Fretista: <b style=\"color:#111827;\">")
         .append(esc(f.nome)).append("</b> (código ").append(f.codigo).append(")</div>")
         .append("<div style=\"font-size:13px;color:#6b7280;margin-top:4px;\">Transporte e colheita de cana realizados pelos seus equipamentos: ")
         .append("viagens, toneladas e raio médio no dia anterior, no dia atual, na semana, no período de fechamento e na safra.</div>")
         .append("</td></tr>");

        for (Tipo t : f.tipos.values()) {
            h.append("<tr><td style=\"padding:14px 24px 0;\">")
             .append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border:1px solid #e5e7eb;border-radius:6px;border-collapse:separate;overflow:hidden;\">")
             .append("<tr><td colspan=\"").append(colunas).append("\" style=\"background:").append(AZUL).append(";color:#ffffff;padding:9px 12px;font-size:14px;font-weight:bold;\">")
             .append(esc(t.descricao)).append("</td></tr>");
            cabecalho(h, cab, intervalos, true);
            for (Equip e : t.equipamentos) {
                h.append("<tr><td style=\"").append(celula).append("padding-left:12px;font-weight:bold;white-space:nowrap;\">").append(esc(e.codigo)).append("</td>")
                 .append("<td style=\"").append(celula).append("\">").append(esc(e.descricao)).append("</td>");
                celulasProducao(h, e, num);
                h.append("</tr>");
            }
            String sub = "padding:8px 5px;background:#eef6f1;font-size:12px;font-weight:bold;color:" + AZUL + ";";
            h.append("<tr><td colspan=\"2\" style=\"").append(sub).append("padding-left:12px;\">Total ").append(esc(t.descricao)).append("</td>");
            celulasProducao(h, t, sub + "text-align:right;white-space:nowrap;");
            h.append("</tr></table></td></tr>");
        }

        String total = "padding:10px 5px;background:" + VERDE + ";color:#ffffff;font-size:13px;font-weight:bold;";
        h.append("<tr><td style=\"padding:16px 24px 0;\">")
         .append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;border-collapse:separate;\">");
        cabecalho(h, cab, intervalos, false);
        h.append("<tr><td colspan=\"2\" style=\"").append(total).append("padding-left:12px;\">TOTAL GERAL</td>");
        celulasProducao(h, f, total + "text-align:right;white-space:nowrap;");
        h.append("</tr></table></td></tr>")
         .append("<tr><td style=\"padding:18px 24px 22px;font-size:12px;color:#9ca3af;line-height:1.5;\">")
         .append("Dia atual: ").append(esc(dataRef)).append(". Semana atual: de segunda-feira até o dia atual. Período 20 a 19: fechamento do dia 20 ao dia 19 do mês seguinte, acumulado até o dia atual. Safra: acumulada até o dia atual. Raio: raio médio das viagens, por equipamento.<br>")
         .append("Mensagem automática da Impacto Bioenergia, enviada diariamente com a produção do dia anterior. ")
         .append("Não responda a este e-mail; em caso de divergência, procure o setor agrícola da usina.")
         .append("</td></tr></table></td></tr></table></body></html>");
        return h.toString();
    }

    /** Duas linhas de cabeçalho: o período (com o intervalo de datas) e, abaixo, Viagens | Toneladas | Raio médio. */
    private void cabecalho(StringBuilder h, String cab, String[] intervalos, boolean equipamento) {
        String borda = "border-left:1px solid #e5e7eb;";
        if (equipamento) {
            h.append("<tr><td rowspan=\"2\" width=\"48\" style=\"width:48px;").append(cab).append("padding-left:12px;vertical-align:bottom;\">C&Oacute;D.</td>")
             .append("<td rowspan=\"2\" style=\"").append(cab).append("vertical-align:bottom;\">DESCRI&Ccedil;&Atilde;O</td>");
        } else {
            h.append("<tr><td rowspan=\"2\" colspan=\"2\" style=\"").append(cab).append("\">&nbsp;</td>");
        }
        for (int i = 0; i < PERIODOS.length; i++) {
            h.append("<td colspan=\"3\" style=\"").append(cab).append(borda).append("text-align:center;white-space:nowrap;color:").append(AZUL).append(";\">")
             .append(esc(rotulos[i].toUpperCase(new Locale("pt", "BR"))))
             .append("<br><span style=\"font-weight:normal;font-size:10px;color:#6b7280;\">").append(intervalos[i]).append("</span></td>");
        }
        h.append("</tr><tr>");
        for (int i = 0; i < PERIODOS.length; i++) {
            h.append("<td width=\"34\" style=\"width:34px;").append(cab).append(borda).append("text-align:right;\">VIAG.</td>")
             .append("<td width=\"62\" style=\"width:62px;").append(cab).append("text-align:right;\">TON.</td>")
             .append("<td width=\"40\" style=\"width:40px;").append(cab).append("text-align:right;\">RAIO</td>");
        }
        h.append("</tr>");
    }

    private void linhaTexto(StringBuilder t, String rotulo, Producao p) {
        t.append("  ").append(rotulo).append("\n");
        for (int i = 0; i < PERIODOS.length; i++) {
            t.append("    ").append(rotulos[i]).append(": ").append(inteiro(p.viagens[i])).append(" viagens, ")
             .append(ton(p.toneladas[i])).append(" t").append(p.raio[i] == null ? "" : ", raio médio " + ton(p.raio[i])).append("\n");
        }
    }

    String texto(Fretista f, String dataRef) {
        StringBuilder t = new StringBuilder();
        if (modoTeste()) {
            t.append("[E-MAIL DE TESTE - destinatário original: ").append(f.emailCadastro)
             .append(cfg.emailCopia.isEmpty() ? "" : "; cópia para: " + cfg.emailCopia).append("]\n\n");
        }
        t.append("IMPACTO BIOENERGIA\nSua produção de ").append(dataRef).append("\nFretista: ").append(f.nome)
         .append(" (código ").append(f.codigo).append(")\n");
        for (Tipo tp : f.tipos.values()) {
            t.append("\n").append(tp.descricao).append("\n");
            for (Equip e : tp.equipamentos) linhaTexto(t, e.codigo + " - " + e.descricao, e);
            linhaTexto(t, "Total " + tp.descricao, tp);
        }
        t.append("\n");
        linhaTexto(t, "TOTAL GERAL", f);
        t.append("\nDia atual: ").append(dataRef).append(". Semana atual: de segunda-feira até o dia atual. Período 20 a 19 e safra: acumulados até o dia atual.\n")
         .append("Mensagem automática. Não responda a este e-mail.\n");
        return t.toString();
    }

    private static String producaoJson(Producao p) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < PERIODOS.length; i++) {
            String sufixo = CHAVES[i];
            sb.append(",\"viagens").append(sufixo).append("\":").append(p.viagens[i])
              .append(",\"toneladas").append(sufixo).append("\":").append(String.format(Locale.ROOT, "%.3f", p.toneladas[i]));
            if (p.raio[i] != null) sb.append(",\"raio").append(sufixo).append("\":").append(String.format(Locale.ROOT, "%.2f", p.raio[i]));
        }
        return sb.toString();
    }

    /** Prévia em JSON: o que seria enviado, sem enviar nada. */
    String previaJson(String dataRef, Integer htmlDoFornecedor) throws Exception {
        garantirTabela();
        List<Fretista> lista = carregar(dataRef);
        StringBuilder sb = new StringBuilder("{\"dataRef\":").append(Json.quote(dataRef))
            .append(",\"modoTeste\":").append(modoTeste())
            .append(",\"destinoTeste\":").append(Json.quote(cfg.emailDestinoTeste))
            .append(",\"agendamento\":").append(Json.quote(cfg.emailFretistasAtivo ? cfg.emailFretistasHora + " " + cfg.emailFuso : "desativado"))
            .append(",\"fretistas\":[");
        boolean primeiro = true;
        String html = null;
        for (Fretista f : lista) {
            if (!primeiro) sb.append(',');
            primeiro = false;
            sb.append("{\"codFornecedor\":").append(f.codigo)
              .append(",\"fornecedor\":").append(Json.quote(f.nome))
              .append(",\"emailCadastro\":").append(Json.quote(f.emailCadastro))
              .append(",\"destinatario\":").append(Json.quote(enderecos(destinatarios(f))))
              .append(",\"copia\":").append(Json.quote(enderecos(copias(destinatarios(f)))))
              .append(",\"jaEnviado\":").append(jaEnviado(dataRef, f.codigo))
              .append(producaoJson(f))
              .append(",\"tipos\":[");
            boolean pt = true;
            for (Tipo t : f.tipos.values()) {
                if (!pt) sb.append(',');
                pt = false;
                sb.append("{\"tipo\":").append(Json.quote(t.descricao)).append(producaoJson(t)).append(",\"equipamentos\":[");
                boolean pe = true;
                for (Equip e : t.equipamentos) {
                    if (!pe) sb.append(',');
                    pe = false;
                    sb.append("{\"codigo\":").append(Json.quote(e.codigo)).append(",\"descricao\":").append(Json.quote(e.descricao))
                      .append(producaoJson(e)).append('}');
                }
                sb.append("]}");
            }
            sb.append("]}");
            if (htmlDoFornecedor != null && htmlDoFornecedor == f.codigo) html = html(f, dataRef);
        }
        sb.append(']');
        if (html != null) sb.append(",\"html\":").append(Json.quote(html));
        return sb.append('}').toString();
    }

    static String resultadoJson(Resultado r) {
        StringBuilder sb = new StringBuilder("{\"dataRef\":").append(Json.quote(r.dataRef))
            .append(",\"modoTeste\":").append(r.modoTeste)
            .append(",\"fretistas\":").append(r.fretistas)
            .append(",\"enviados\":").append(r.enviados)
            .append(",\"jaEnviados\":").append(r.jaEnviados)
            .append(",\"falhas\":").append(r.falhas)
            .append(",\"detalhes\":[");
        for (int i = 0; i < r.detalhes.size(); i++) sb.append(i > 0 ? "," : "").append(Json.quote(r.detalhes.get(i)));
        return sb.append("]}").toString();
    }

    // ---------------------------------------------------------------- registro (NST_EMAIL_ENVIO)

    private boolean jaEnviado(String dataRef, int codFornecedor) throws Exception {
        if (!cfg.emailRegistrar) return false;
        Pooled p = pool.borrow();
        boolean broken = false;
        try {
            PreparedStatement ps = p.con.prepareStatement(
                "select count(*) from nst_email_envio where rotina = ? and data_ref = to_date(?, 'dd/mm/rrrr') "
                + "and cod_fornecedor = ? and status = 'E'");
            try {
                ps.setString(1, ROTINA);
                ps.setString(2, dataRef);
                ps.setInt(3, codFornecedor);
                ResultSet rs = ps.executeQuery();
                try {
                    rs.next();
                    return rs.getInt(1) > 0;
                } finally {
                    rs.close();
                }
            } finally {
                ps.close();
            }
        } catch (SQLException e) {
            broken = true;
            throw e;
        } finally {
            pool.release(p, broken);
        }
    }

    private void registrar(String dataRef, Fretista f, String destino, String status, String erro) {
        if (!cfg.emailRegistrar) return;
        try {
            Pooled p = pool.borrow();
            boolean broken = false;
            try {
                PreparedStatement ps = p.con.prepareStatement(
                    "insert into nst_email_envio (id, rotina, data_ref, cod_fornecedor, fornecedor, destinatario, status, erro, enviado_em) "
                    + "values (nst_email_envio_seq.nextval, ?, to_date(?, 'dd/mm/rrrr'), ?, ?, ?, ?, ?, sysdate)");
                try {
                    ps.setString(1, ROTINA);
                    ps.setString(2, dataRef);
                    ps.setInt(3, f.codigo);
                    ps.setString(4, cortar(f.nome, 200));
                    ps.setString(5, cortar(destino, 400));
                    ps.setString(6, status);
                    ps.setString(7, cortar(erro, 500));
                    ps.executeUpdate();
                } finally {
                    ps.close();
                }
            } catch (SQLException e) {
                broken = true;
                throw e;
            } finally {
                pool.release(p, broken);
            }
        } catch (Exception e) {
            ctx.log("E-mail fretistas: não foi possível registrar o envio de " + f.codigo, e);
        }
    }

    /** Cria NST_EMAIL_ENVIO (tabela, índice e sequência) se ainda não existirem. */
    private synchronized void garantirTabela() throws Exception {
        if (tabelaOk || !cfg.emailRegistrar) return;
        Pooled p = pool.borrow();
        boolean broken = false;
        try {
            Statement st = p.con.createStatement();
            try {
                boolean temTabela = conta(st, "select count(*) from user_tables where table_name = 'NST_EMAIL_ENVIO'") > 0;
                boolean temSeq = conta(st, "select count(*) from user_sequences where sequence_name = 'NST_EMAIL_ENVIO_SEQ'") > 0;
                if (!temTabela || !temSeq) {
                    for (String cmd : comandosDdl("/ddl/nst_email_envio.sql")) {
                        String c = cmd.toLowerCase();
                        boolean executar = ((c.startsWith("create table") || c.startsWith("create index")) && !temTabela)
                            || (c.startsWith("create sequence") && !temSeq);
                        if (executar) st.execute(cmd);
                    }
                    ctx.log("Tabela NST_EMAIL_ENVIO criada/completada");
                }
                tabelaOk = true;
            } finally {
                st.close();
            }
        } catch (SQLException e) {
            broken = true;
            throw e;
        } finally {
            pool.release(p, broken);
        }
    }

    // ---------------------------------------------------------------- utilitários

    private static int conta(Statement st, String sql) throws SQLException {
        ResultSet rs = st.executeQuery(sql);
        try {
            rs.next();
            return rs.getInt(1);
        } finally {
            rs.close();
        }
    }

    private static List<String> comandosDdl(String recurso) throws IOException {
        BufferedReader r = new BufferedReader(new InputStreamReader(
            new java.io.ByteArrayInputStream(recurso(recurso)), StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String linha;
        while ((linha = r.readLine()) != null) {
            if (!linha.trim().startsWith("--")) sb.append(linha).append('\n');
        }
        List<String> cmds = new ArrayList<String>();
        for (String c : sb.toString().split(";\\s*\n")) {
            if (!c.trim().isEmpty()) cmds.add(c.trim());
        }
        return cmds;
    }

    private static byte[] recurso(String caminho) throws IOException {
        InputStream in = EmailFretistas.class.getResourceAsStream(caminho);
        if (in == null) throw new IOException("Recurso não encontrado no WAR: " + caminho);
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        } finally {
            in.close();
        }
    }

    private static void fechar(Transport t) {
        if (t != null) {
            try {
                t.close();
            } catch (Exception ignore) {
                // conexão já encerrada
            }
        }
    }

    private static String limpo(String s, String padrao) {
        return s == null || s.trim().isEmpty() ? padrao : s.trim();
    }

    private static String cortar(String s, int max) {
        return s == null ? null : (s.length() > max ? s.substring(0, max) : s);
    }

    private static String resumo(Throwable e) {
        String m = e.getClass().getSimpleName() + (e.getMessage() != null ? ": " + e.getMessage().trim() : "");
        return m.length() > 480 ? m.substring(0, 480) : m;
    }

    private static String esc(String s) {
        StringBuilder sb = new StringBuilder(s.length() + 16);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '&': sb.append("&amp;"); break;
                case '<': sb.append("&lt;"); break;
                case '>': sb.append("&gt;"); break;
                case '"': sb.append("&quot;"); break;
                default: sb.append(c);
            }
        }
        return sb.toString();
    }
}
