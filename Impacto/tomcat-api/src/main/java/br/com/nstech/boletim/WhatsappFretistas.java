package br.com.nstech.boletim;

import br.com.nstech.boletim.ConnectionPool.Pooled;
import br.com.nstech.boletim.EmailFretistas.Fretista;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.servlet.ServletContext;

/**
 * Relatório de produção dos fretistas pelo WhatsApp (Evolution API), em PDF.
 *
 * - Cadastro (NST_WPP_FRETISTA): vincula um número de WhatsApp a um código de fornecedor. É a única fonte de quem
 *   pode receber: um número só recebe (ou consegue pedir) o relatório do fornecedor a que está vinculado.
 * - Envio diário: no horário definido pelo administrador (NST_WPP_CONFIG), para os cadastros ativos que
 *   produziram no dia anterior. NST_WPP_ENVIO registra cada envio e evita duplicidade.
 * - Pedido pelo WhatsApp: a Evolution API chama o webhook a cada mensagem recebida; se o número estiver
 *   cadastrado, respondemos com o PDF. Números não cadastrados são ignorados (sem resposta).
 * - Com WPP_DESTINO_TESTE preenchido, TODOS os envios vão só para esse número e só ele é atendido no webhook.
 */
final class WhatsappFretistas {

    private static final DateTimeFormatter BR = DateTimeFormatter.ofPattern("dd/MM/uuuu");
    private static final Pattern HORA = Pattern.compile("([01]\\d|2[0-3]):[0-5]\\d");
    private static final Pattern DATA_NA_MENSAGEM = Pattern.compile("\\b(\\d{1,2})[/.-](\\d{1,2})(?:[/.-](\\d{2,4}))?\\b");
    private static final int MAX_RELATORIOS_POR_HORA = 6;

    static final class Cadastro {
        int id;
        int codFornecedor;
        String nome;
        String numero;
        boolean ativo;
    }

    static final class Config {
        boolean ativo;
        String hora;
    }

    static final class Resultado {
        String dataRef;
        int cadastros;
        int enviados;
        int jaEnviados;
        int semProducao;
        int falhas;
        final List<String> detalhes = new ArrayList<String>();
    }

    /** Parâmetro inválido vindo da tela de administração (vira HTTP 400). */
    static final class Invalido extends Exception {
        private static final long serialVersionUID = 1L;

        Invalido(String msg) {
            super(msg);
        }
    }

    private final ApiConfig cfg;
    private final ConnectionPool pool;
    private final ServletContext ctx;
    private final EmailFretistas dados;
    private volatile boolean tabelasOk;

    // Estado em memória do atendimento pelo WhatsApp
    private final Map<String, Boolean> mensagensVistas = Collections.synchronizedMap(new LinkedHashMap<String, Boolean>() {
        private static final long serialVersionUID = 1L;

        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Boolean> e) {
            return size() > 2000;
        }
    });
    private final Map<String, List<Long>> pedidos = new ConcurrentHashMap<String, List<Long>>();
    private final Map<String, Long> ultimoMenu = new ConcurrentHashMap<String, Long>();
    private volatile List<Fretista> fornecedoresCache;
    private volatile long fornecedoresEm;

    WhatsappFretistas(ApiConfig cfg, ConnectionPool pool, ServletContext ctx, EmailFretistas dados) {
        this.cfg = cfg;
        this.pool = pool;
        this.ctx = ctx;
        this.dados = dados;
    }

    boolean evolutionConfigurada() {
        return !cfg.evolutionUrl.isEmpty() && !cfg.evolutionApiKey.isEmpty() && !cfg.evolutionInstancia.isEmpty();
    }

    boolean modoTeste() {
        return !cfg.wppDestinoTeste.isEmpty();
    }

    // ---------------------------------------------------------------- números

    /** Só dígitos, com DDI 55. Lança Invalido se não parecer um celular/telefone brasileiro. */
    static String normalizar(String numero) throws Invalido {
        String d = numero == null ? "" : numero.replaceAll("\\D", "");
        if (d.startsWith("0")) d = d.replaceFirst("^0+", "");
        if (d.length() == 10 || d.length() == 11) d = "55" + d;
        if (!d.startsWith("55") || (d.length() != 12 && d.length() != 13)) {
            throw new Invalido("Número de WhatsApp inválido: informe DDD + número (ex.: 82 99114-2153)");
        }
        return d;
    }

    /**
     * Chave de comparação: DDI + DDD + 8 últimos dígitos. O WhatsApp identifica muitos números brasileiros sem o
     * nono dígito, então "5582991142153" e "558291142153" são a mesma pessoa.
     */
    static String chave(String numero) {
        String d = numero == null ? "" : numero.replaceAll("\\D", "");
        if (d.length() < 12) return d;
        return d.substring(0, 4) + d.substring(d.length() - 8);
    }

    // ---------------------------------------------------------------- banco

    private interface Acao<T> {
        T executar(Connection con) throws Exception;
    }

    private <T> T comConexao(Acao<T> acao) throws Exception {
        Pooled p = pool.borrow();
        boolean broken = false;
        try {
            return acao.executar(p.con);
        } catch (SQLException e) {
            broken = true;
            throw e;
        } finally {
            pool.release(p, broken);
        }
    }

    /** Cria as tabelas e sequências do WhatsApp se ainda não existirem (script em /ddl/nst_wpp.sql). */
    synchronized void garantirTabelas() throws Exception {
        if (tabelasOk) return;
        comConexao(new Acao<Void>() {
            @Override
            public Void executar(Connection con) throws Exception {
                Statement st = con.createStatement();
                try {
                    for (String cmd : comandosDdl()) {
                        Matcher m = Pattern.compile("(?i)^create\\s+(table|sequence|unique\\s+index|index)\\s+(\\w+)").matcher(cmd);
                        if (!m.find()) continue;
                        String tipo = m.group(1).toLowerCase();
                        String nome = m.group(2).toUpperCase();
                        String visao = tipo.equals("table") ? "user_tables where table_name"
                            : tipo.equals("sequence") ? "user_sequences where sequence_name" : "user_indexes where index_name";
                        ResultSet rs = st.executeQuery("select count(*) from " + visao + " = '" + nome + "'");
                        rs.next();
                        boolean existe = rs.getInt(1) > 0;
                        rs.close();
                        if (!existe) {
                            st.execute(cmd);
                            ctx.log("WhatsApp fretistas: criado " + nome);
                        }
                    }
                } finally {
                    st.close();
                }
                return null;
            }
        });
        tabelasOk = true;
    }

    private static List<String> comandosDdl() throws IOException {
        String txt = new String(EmailFretistas.recurso("/ddl/nst_wpp.sql"), StandardCharsets.UTF_8);
        StringBuilder sb = new StringBuilder();
        for (String linha : txt.split("\n")) {
            if (!linha.trim().startsWith("--")) sb.append(linha).append('\n');
        }
        List<String> cmds = new ArrayList<String>();
        for (String c : sb.toString().split(";\\s*\n")) {
            if (!c.trim().isEmpty()) cmds.add(c.trim());
        }
        return cmds;
    }

    Config config() throws Exception {
        garantirTabelas();
        final Config c = new Config();
        c.ativo = false;
        c.hora = cfg.emailFretistasHora;
        comConexao(new Acao<Void>() {
            @Override
            public Void executar(Connection con) throws Exception {
                Statement st = con.createStatement();
                try {
                    ResultSet rs = st.executeQuery("select chave, valor from nst_wpp_config");
                    while (rs.next()) {
                        String k = rs.getString(1);
                        String v = rs.getString(2);
                        if ("ATIVO".equals(k)) c.ativo = "S".equals(v);
                        else if ("HORA".equals(k) && v != null && HORA.matcher(v).matches()) c.hora = v;
                    }
                    rs.close();
                } finally {
                    st.close();
                }
                return null;
            }
        });
        return c;
    }

    void salvarConfig(final boolean ativo, final String hora, final String por) throws Exception {
        if (hora == null || !HORA.matcher(hora).matches()) throw new Invalido("Horário inválido: use HH:mm (ex.: 06:00)");
        garantirTabelas();
        comConexao(new Acao<Void>() {
            @Override
            public Void executar(Connection con) throws Exception {
                String[][] pares = {{"ATIVO", ativo ? "S" : "N"}, {"HORA", hora}};
                PreparedStatement ps = con.prepareStatement(
                    "merge into nst_wpp_config c using (select ? chave from dual) s on (c.chave = s.chave) "
                    + "when matched then update set c.valor = ?, c.alterado_por = ?, c.alterado_em = sysdate "
                    + "when not matched then insert (chave, valor, alterado_por, alterado_em) values (?, ?, ?, sysdate)");
                try {
                    for (String[] p : pares) {
                        ps.setString(1, p[0]);
                        ps.setString(2, p[1]);
                        ps.setString(3, por);
                        ps.setString(4, p[0]);
                        ps.setString(5, p[1]);
                        ps.setString(6, por);
                        ps.executeUpdate();
                    }
                } finally {
                    ps.close();
                }
                return null;
            }
        });
    }

    List<Cadastro> listar() throws Exception {
        garantirTabelas();
        return comConexao(new Acao<List<Cadastro>>() {
            @Override
            public List<Cadastro> executar(Connection con) throws Exception {
                List<Cadastro> lista = new ArrayList<Cadastro>();
                Statement st = con.createStatement();
                try {
                    ResultSet rs = st.executeQuery(
                        "select id, cod_fornecedor, nome, numero, ativo from nst_wpp_fretista order by nome, cod_fornecedor, numero");
                    while (rs.next()) {
                        Cadastro c = new Cadastro();
                        c.id = rs.getInt(1);
                        c.codFornecedor = rs.getInt(2);
                        c.nome = rs.getString(3) == null ? "" : rs.getString(3);
                        c.numero = rs.getString(4);
                        c.ativo = "S".equals(rs.getString(5));
                        lista.add(c);
                    }
                    rs.close();
                } finally {
                    st.close();
                }
                return lista;
            }
        });
    }

    /** Nome do fornecedor no cadastro da usina (null se o código não existir). */
    String nomeFornecedor(final int cod) throws Exception {
        return comConexao(new Acao<String>() {
            @Override
            public String executar(Connection con) throws Exception {
                PreparedStatement ps = con.prepareStatement(
                    "select material.fn_buscanomefornec(f.cod_fornecedor, trunc(sysdate)) from material.fornecedor f where f.cod_fornecedor = ?");
                try {
                    ps.setInt(1, cod);
                    ResultSet rs = ps.executeQuery();
                    try {
                        return rs.next() ? rs.getString(1) : null;
                    } finally {
                        rs.close();
                    }
                } finally {
                    ps.close();
                }
            }
        });
    }

    /** Inclui (id null) ou altera um vínculo número <-> fornecedor. Devolve o nome do fornecedor. */
    String salvar(final Integer id, final int codFornecedor, String numero, final boolean ativo, final String por) throws Exception {
        final String num = normalizar(numero);
        garantirTabelas();
        final String nome = nomeFornecedor(codFornecedor);
        if (nome == null) throw new Invalido("Fornecedor " + codFornecedor + " não encontrado no cadastro da usina");
        for (Cadastro c : listar()) {
            if (c.codFornecedor == codFornecedor && chave(c.numero).equals(chave(num)) && (id == null || c.id != id)) {
                throw new Invalido("Este número já está vinculado a este fornecedor");
            }
        }
        comConexao(new Acao<Void>() {
            @Override
            public Void executar(Connection con) throws Exception {
                PreparedStatement ps = con.prepareStatement(id == null
                    ? "insert into nst_wpp_fretista (id, cod_fornecedor, nome, numero, ativo, criado_por, criado_em, alterado_em) "
                      + "values (nst_wpp_fretista_seq.nextval, ?, ?, ?, ?, ?, sysdate, sysdate)"
                    : "update nst_wpp_fretista set cod_fornecedor = ?, nome = ?, numero = ?, ativo = ?, alterado_por = ?, "
                      + "alterado_em = sysdate where id = ?");
                try {
                    ps.setInt(1, codFornecedor);
                    ps.setString(2, cortar(nome, 200));
                    ps.setString(3, num);
                    ps.setString(4, ativo ? "S" : "N");
                    ps.setString(5, cortar(por, 100));
                    if (id != null) ps.setInt(6, id);
                    if (ps.executeUpdate() == 0) throw new Invalido("Cadastro não encontrado");
                } finally {
                    ps.close();
                }
                return null;
            }
        });
        return nome;
    }

    void excluir(final int id) throws Exception {
        garantirTabelas();
        comConexao(new Acao<Void>() {
            @Override
            public Void executar(Connection con) throws Exception {
                PreparedStatement ps = con.prepareStatement("delete from nst_wpp_fretista where id = ?");
                try {
                    ps.setInt(1, id);
                    ps.executeUpdate();
                } finally {
                    ps.close();
                }
                return null;
            }
        });
    }

    private boolean jaEnviadoAgendado(final String dataRef, final Cadastro c) throws Exception {
        return comConexao(new Acao<Boolean>() {
            @Override
            public Boolean executar(Connection con) throws Exception {
                PreparedStatement ps = con.prepareStatement(
                    "select count(*) from nst_wpp_envio where data_ref = to_date(?, 'dd/mm/rrrr') and cod_fornecedor = ? "
                    + "and numero = ? and origem = 'A' and status = 'E'");
                try {
                    ps.setString(1, dataRef);
                    ps.setInt(2, c.codFornecedor);
                    ps.setString(3, c.numero);
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
            }
        });
    }

    /** origem: A = agendado, M = manual (administrador), P = pedido pelo WhatsApp. status: E = enviado, F = falhou. */
    private void registrar(final String dataRef, final Cadastro c, final String destino, final String origem,
                           final String status, final String erro) {
        try {
            comConexao(new Acao<Void>() {
                @Override
                public Void executar(Connection con) throws Exception {
                    PreparedStatement ps = con.prepareStatement(
                        "insert into nst_wpp_envio (id, data_ref, cod_fornecedor, fornecedor, numero, destino, origem, status, erro, enviado_em) "
                        + "values (nst_wpp_envio_seq.nextval, to_date(?, 'dd/mm/rrrr'), ?, ?, ?, ?, ?, ?, ?, sysdate)");
                    try {
                        ps.setString(1, dataRef);
                        ps.setInt(2, c.codFornecedor);
                        ps.setString(3, cortar(c.nome, 200));
                        ps.setString(4, c.numero);
                        ps.setString(5, destino);
                        ps.setString(6, origem);
                        ps.setString(7, status);
                        ps.setString(8, cortar(erro, 500));
                        ps.executeUpdate();
                    } finally {
                        ps.close();
                    }
                    return null;
                }
            });
        } catch (Exception e) {
            ctx.log("WhatsApp fretistas: não foi possível registrar o envio de " + c.codFornecedor, e);
        }
    }

    // ---------------------------------------------------------------- envio

    private String ontem() {
        return LocalDate.now(ZoneId.of(cfg.emailFuso)).minusDays(1).format(BR);
    }

    /** Para onde a mensagem realmente vai: em modo de teste, sempre o número de teste. */
    private String destino(String numero) {
        return modoTeste() ? cfg.wppDestinoTeste : numero;
    }

    /**
     * Gera o PDF do fornecedor do cadastro e envia.
     * @return "ENVIADO" ou "SEM_PRODUCAO" (nada enviado: não houve produção no período pedido)
     */
    private String enviarRelatorio(Cadastro c, String dataRef, String origem, boolean exigirProducaoNoDia) throws Exception {
        String destino = destino(c.numero);
        try {
            List<Fretista> lista = dados.carregar(dataRef, c.codFornecedor, exigirProducaoNoDia);
            if (lista.isEmpty()) return "SEM_PRODUCAO";
            Fretista f = lista.get(0);
            String aviso = modoTeste() ? "ENVIO DE TESTE. Em produção, este relatório iria para o WhatsApp " + c.numero + "." : null;
            byte[] pdf = PdfFretista.gerar(f, dataRef, dados.rotulos, dados.logo, aviso);
            String legenda = "*Impacto Bioenergia*\nProdução de " + dataRef + "\n" + f.nome + "\n"
                + EmailFretistas.inteiro(f.viagens[EmailFretistas.DIA]) + " viagens · "
                + EmailFretistas.ton(f.toneladas[EmailFretistas.DIA]) + " t no dia"
                + (modoTeste() ? "\n_(envio de teste)_" : "");
            enviarDocumento(destino, pdf, "Producao_" + dataRef.replace("/", "-") + "_" + f.codigo + ".pdf", legenda);
            registrar(dataRef, c, destino, origem, "E", null);
            return "ENVIADO";
        } catch (Exception e) {
            registrar(dataRef, c, destino, origem, "F", resumo(e));
            throw e;
        }
    }

    /** Envio manual pelo administrador: um cadastro, mesmo sem produção no dia. */
    String enviarManual(int id, String dataRef) throws Exception {
        if (!evolutionConfigurada()) throw new Invalido("Evolution API não configurada no servidor (EVOLUTION_URL/APIKEY/INSTANCIA)");
        Cadastro alvo = null;
        for (Cadastro c : listar()) if (c.id == id) alvo = c;
        if (alvo == null) throw new Invalido("Cadastro não encontrado");
        String data = dataRef == null || dataRef.isEmpty() ? ontem() : dataRef;
        String r = enviarRelatorio(alvo, data, "M", false);
        return "{\"resultado\":" + Json.quote(r) + ",\"dataRef\":" + Json.quote(data) + ",\"destino\":" + Json.quote(destino(alvo.numero))
            + ",\"modoTeste\":" + modoTeste() + "}";
    }

    /** Envio diário: cadastros ativos que produziram no dia de referência e ainda não receberam. */
    synchronized Resultado enviarAgendado(String dataRef) throws Exception {
        Resultado r = new Resultado();
        r.dataRef = dataRef;
        for (Cadastro c : listar()) {
            if (!c.ativo) continue;
            r.cadastros++;
            if (jaEnviadoAgendado(dataRef, c)) {
                r.jaEnviados++;
                continue;
            }
            try {
                if ("ENVIADO".equals(enviarRelatorio(c, dataRef, "A", true))) {
                    r.enviados++;
                    r.detalhes.add(c.codFornecedor + " " + c.nome + " -> " + destino(c.numero));
                    Thread.sleep(2500); // envios espaçados: evita que o WhatsApp trate o número como disparo em massa
                } else {
                    r.semProducao++;
                }
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw ie;
            } catch (Exception e) {
                r.falhas++;
                r.detalhes.add(c.codFornecedor + " " + c.nome + " FALHOU: " + resumo(e));
                ctx.log("WhatsApp fretistas: falha para " + c.codFornecedor + " " + c.nome, e);
            }
        }
        ctx.log("WhatsApp fretistas " + dataRef + (modoTeste() ? " [TESTE -> " + cfg.wppDestinoTeste + "]" : "")
            + ": cadastros=" + r.cadastros + " enviados=" + r.enviados + " já enviados=" + r.jaEnviados
            + " sem produção=" + r.semProducao + " falhas=" + r.falhas);
        return r;
    }

    // ---------------------------------------------------------------- atendimento (webhook da Evolution API)

    /** Trata uma notificação da Evolution API. Nunca lança: erros vão para o log. */
    void receber(String corpo) {
        try {
            JsonObject raiz = JsonParser.parseString(corpo).getAsJsonObject();
            String evento = texto(raiz, "event").toLowerCase().replace('_', '.');
            if (!evento.equals("messages.upsert")) return;
            JsonElement d = raiz.get("data");
            if (d == null) return;
            if (d.isJsonArray()) {
                for (JsonElement e : d.getAsJsonArray()) if (e.isJsonObject()) tratarMensagem(e.getAsJsonObject());
            } else if (d.isJsonObject()) {
                tratarMensagem(d.getAsJsonObject());
            }
        } catch (Exception e) {
            ctx.log("WhatsApp fretistas: erro ao tratar mensagem recebida", e);
        }
    }

    private void tratarMensagem(JsonObject data) throws Exception {
        JsonObject key = objeto(data, "key");
        if (key == null || booleano(key, "fromMe")) return;
        String jid = texto(key, "remoteJid");
        if (jid.endsWith("@g.us") || jid.contains("broadcast") || jid.contains("newsletter")) return; // grupos, status, canais
        // Contas novas chegam como "@lid": o número real vem em campos alternativos
        if (jid.endsWith("@lid")) {
            String alt = texto(key, "remoteJidAlt");
            if (alt.isEmpty()) alt = texto(key, "senderPn");
            if (alt.isEmpty()) alt = texto(data, "senderPn");
            if (alt.isEmpty()) return;
            jid = alt;
        }
        String numero = jid.replaceAll("[@:].*$", "").replaceAll("\\D", "");
        if (numero.length() < 12) return;
        String idMsg = texto(key, "id");
        if (!idMsg.isEmpty() && mensagensVistas.put(idMsg, Boolean.TRUE) != null) return; // reentrega do mesmo evento

        String msg = "";
        JsonObject m = objeto(data, "message");
        if (m != null) {
            msg = texto(m, "conversation");
            JsonObject ext = objeto(m, "extendedTextMessage");
            if (msg.isEmpty() && ext != null) msg = texto(ext, "text");
        }
        msg = msg.trim();

        if (modoTeste() && !chave(numero).equals(chave(cfg.wppDestinoTeste))) return;

        List<Cadastro> meus = new ArrayList<Cadastro>();
        for (Cadastro c : listar()) {
            if (c.ativo && chave(c.numero).equals(chave(numero))) meus.add(c);
        }
        if (meus.isEmpty()) return; // número não cadastrado: sem resposta

        String ontem = ontem();
        String dataRef = dataPedida(msg);
        String simples = java.text.Normalizer.normalize(msg.toLowerCase(), java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        boolean pedeRelatorio = dataRef != null || simples.matches("\\s*1\\s*")
            || simples.matches(".*\\b(relatorio|producao|pdf|ontem|viagens|toneladas)\\b.*");
        if (!pedeRelatorio) {
            Long ultimo = ultimoMenu.get(chave(numero));
            if (ultimo != null && System.currentTimeMillis() - ultimo < 10 * 60 * 1000L) return;
            ultimoMenu.put(chave(numero), System.currentTimeMillis());
            enviarTexto(destino(numero), "Olá! Este é o canal de relatórios da *Impacto Bioenergia*.\n\n"
                + "Envie *1* para receber o relatório de produção de ontem (" + ontem + ").\n"
                + "Para outro dia, envie a data (ex.: " + ontem.substring(0, 5) + ").");
            return;
        }
        if ("FUTURA".equals(dataRef)) {
            enviarTexto(destino(numero), "Só é possível consultar dias já encerrados (até " + ontem + ").");
            return;
        }
        if (dataRef == null) dataRef = ontem;
        if (!permitirPedido(chave(numero))) {
            enviarTexto(destino(numero), "Você já pediu vários relatórios na última hora. Tente novamente mais tarde.");
            return;
        }
        for (Cadastro c : meus) {
            try {
                if ("SEM_PRODUCAO".equals(enviarRelatorio(c, dataRef, "P", false))) {
                    enviarTexto(destino(numero), "Não há produção registrada para " + c.nome + " na safra até " + dataRef + ".");
                }
            } catch (Exception e) {
                ctx.log("WhatsApp fretistas: falha ao atender pedido de " + c.codFornecedor, e);
                enviarTexto(destino(numero), "Não foi possível gerar o relatório agora. Tente novamente em alguns minutos.");
            }
        }
    }

    /** Data citada na mensagem (dd/mm ou dd/mm/aaaa) em dd/mm/aaaa; "FUTURA" se for hoje ou depois; null se não houver. */
    private String dataPedida(String msg) {
        Matcher m = DATA_NA_MENSAGEM.matcher(msg);
        if (!m.find()) return null;
        try {
            LocalDate hoje = LocalDate.now(ZoneId.of(cfg.emailFuso));
            int ano = m.group(3) == null ? hoje.getYear() : Integer.parseInt(m.group(3));
            if (ano < 100) ano += 2000;
            LocalDate d = LocalDate.of(ano, Integer.parseInt(m.group(2)), Integer.parseInt(m.group(1)));
            if (m.group(3) == null && d.isAfter(hoje)) d = d.minusYears(1); // "28/12" pedido em janeiro
            return d.isBefore(hoje) ? d.format(BR) : "FUTURA";
        } catch (RuntimeException e) {
            return null;
        }
    }

    private boolean permitirPedido(String chave) {
        long agora = System.currentTimeMillis();
        List<Long> lista = pedidos.get(chave);
        if (lista == null) {
            lista = Collections.synchronizedList(new ArrayList<Long>());
            pedidos.put(chave, lista);
        }
        synchronized (lista) {
            for (int i = lista.size() - 1; i >= 0; i--) if (agora - lista.get(i) > 3600 * 1000L) lista.remove(i);
            if (lista.size() >= MAX_RELATORIOS_POR_HORA) return false;
            lista.add(agora);
            return true;
        }
    }

    // ---------------------------------------------------------------- Evolution API

    private void enviarTexto(String numero, String texto) throws Exception {
        String corpo = cfg.evolutionVersao == 1
            ? "{\"number\":" + Json.quote(numero) + ",\"textMessage\":{\"text\":" + Json.quote(texto) + "}}"
            : "{\"number\":" + Json.quote(numero) + ",\"text\":" + Json.quote(texto) + "}";
        evolution("POST", "/message/sendText/", corpo);
    }

    private void enviarDocumento(String numero, byte[] pdf, String arquivo, String legenda) throws Exception {
        String midia = "\"mediatype\":\"document\",\"mimetype\":\"application/pdf\",\"fileName\":" + Json.quote(arquivo)
            + ",\"caption\":" + Json.quote(legenda) + ",\"media\":\"" + Base64.getEncoder().encodeToString(pdf) + "\"";
        String corpo = cfg.evolutionVersao == 1
            ? "{\"number\":" + Json.quote(numero) + ",\"mediaMessage\":{" + midia + "}}"
            : "{\"number\":" + Json.quote(numero) + "," + midia + "}";
        evolution("POST", "/message/sendMedia/", corpo);
    }

    /** Situação da instância na Evolution API: "open" = conectada ao WhatsApp. */
    String estadoConexao() {
        if (!evolutionConfigurada()) return "nao_configurada";
        try {
            JsonObject o = JsonParser.parseString(evolution("GET", "/instance/connectionState/", null)).getAsJsonObject();
            JsonObject inst = objeto(o, "instance");
            String estado = inst != null ? texto(inst, "state") : texto(o, "state");
            return estado.isEmpty() ? "desconhecido" : estado;
        } catch (Exception e) {
            return "erro: " + resumo(e);
        }
    }

    /** Aponta o webhook da instância para esta API (mensagens recebidas). */
    String configurarWebhook() throws Exception {
        if (!evolutionConfigurada()) throw new Invalido("Evolution API não configurada no servidor");
        if (cfg.wppWebhookUrl.isEmpty() || cfg.wppWebhookToken.length() < 16) {
            throw new Invalido("WPP_WEBHOOK_URL / WPP_WEBHOOK_TOKEN não configurados no servidor");
        }
        String url = cfg.wppWebhookUrl.replaceAll("/+$", "") + "/api/whatsapp/webhook?token=" + URLEncoder.encode(cfg.wppWebhookToken, "UTF-8");
        // A instância só tem UM webhook: nunca sobrescreve o de outro sistema (ex.: um fluxo que já usa este número)
        String base = cfg.wppWebhookUrl.replaceAll("/+$", "");
        try {
            JsonElement atual = JsonParser.parseString(evolution("GET", "/webhook/find/", null));
            if (atual.isJsonObject()) {
                JsonObject o = atual.getAsJsonObject();
                String urlAtual = texto(o, "url");
                if (booleano(o, "enabled") && !urlAtual.isEmpty() && !urlAtual.startsWith(base)) {
                    throw new Invalido("A instância " + cfg.evolutionInstancia + " já tem um webhook de outro sistema (" + urlAtual
                        + "). Não foi alterado: use uma instância própria ou faça esse sistema repassar as mensagens.");
                }
            }
        } catch (Invalido e) {
            throw e;
        } catch (Exception e) {
            throw new Invalido("Não foi possível conferir o webhook atual da instância; nada foi alterado (" + resumo(e) + ")");
        }
        String corpo = cfg.evolutionVersao == 1
            ? "{\"url\":" + Json.quote(url) + ",\"webhook_by_events\":false,\"webhook_base64\":false,\"events\":[\"MESSAGES_UPSERT\"]}"
            : "{\"webhook\":{\"enabled\":true,\"url\":" + Json.quote(url)
              + ",\"byEvents\":false,\"base64\":false,\"events\":[\"MESSAGES_UPSERT\"]}}";
        evolution("POST", "/webhook/set/", corpo);
        return "{\"success\":true}";
    }

    private String evolution(String metodo, String caminho, String corpo) throws Exception {
        URL url = new URL(cfg.evolutionUrl.replaceAll("/+$", "") + caminho
            + URLEncoder.encode(cfg.evolutionInstancia, "UTF-8").replace("+", "%20"));
        HttpURLConnection c = (HttpURLConnection) url.openConnection();
        try {
            c.setRequestMethod(metodo);
            c.setConnectTimeout(15000);
            c.setReadTimeout(60000);
            c.setRequestProperty("apikey", cfg.evolutionApiKey);
            c.setRequestProperty("Accept", "application/json");
            if (corpo != null) {
                byte[] bytes = corpo.getBytes(StandardCharsets.UTF_8);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                c.setFixedLengthStreamingMode(bytes.length);
                OutputStream os = c.getOutputStream();
                try {
                    os.write(bytes);
                } finally {
                    os.close();
                }
            }
            int status = c.getResponseCode();
            String resposta = ler(status >= 400 ? c.getErrorStream() : c.getInputStream());
            if (status >= 400) {
                throw new IOException("Evolution API respondeu HTTP " + status + ": " + cortar(resposta.replaceAll("\\s+", " "), 300));
            }
            return resposta;
        } finally {
            c.disconnect();
        }
    }

    private static String ler(InputStream in) throws IOException {
        if (in == null) return "";
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0 && out.size() < 512 * 1024) out.write(buf, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } finally {
            in.close();
        }
    }

    // ---------------------------------------------------------------- JSON para a tela de administração

    /** Configuração, situação da conexão, cadastros e últimos envios. */
    String estadoJson() throws Exception {
        Config c = config();
        StringBuilder sb = new StringBuilder("{\"config\":{\"ativo\":").append(c.ativo).append(",\"hora\":").append(Json.quote(c.hora))
            .append(",\"fuso\":").append(Json.quote(cfg.emailFuso)).append('}')
            .append(",\"evolution\":{\"configurada\":").append(evolutionConfigurada())
            .append(",\"estado\":").append(Json.quote(estadoConexao()))
            .append(",\"instancia\":").append(Json.quote(cfg.evolutionInstancia))
            .append(",\"webhookConfiguravel\":").append(!cfg.wppWebhookUrl.isEmpty() && cfg.wppWebhookToken.length() >= 16).append('}')
            .append(",\"modoTeste\":").append(modoTeste())
            .append(",\"destinoTeste\":").append(Json.quote(cfg.wppDestinoTeste))
            .append(",\"cadastros\":[");
        boolean primeiro = true;
        for (Cadastro k : listar()) {
            if (!primeiro) sb.append(',');
            primeiro = false;
            sb.append("{\"id\":").append(k.id).append(",\"codFornecedor\":").append(k.codFornecedor)
              .append(",\"nome\":").append(Json.quote(k.nome)).append(",\"numero\":").append(Json.quote(k.numero))
              .append(",\"ativo\":").append(k.ativo).append('}');
        }
        sb.append("],\"envios\":").append(ultimosEnvios()).append('}');
        return sb.toString();
    }

    private String ultimosEnvios() throws Exception {
        return comConexao(new Acao<String>() {
            @Override
            public String executar(Connection con) throws Exception {
                StringBuilder sb = new StringBuilder("[");
                Statement st = con.createStatement();
                try {
                    ResultSet rs = st.executeQuery(
                        "select * from (select to_char(enviado_em, 'dd/mm/yyyy hh24:mi') quando, to_char(data_ref, 'dd/mm/yyyy') data_ref, "
                        + "cod_fornecedor, fornecedor, destino, origem, status, erro from nst_wpp_envio order by enviado_em desc, id desc) "
                        + "where rownum <= 30");
                    boolean primeiro = true;
                    while (rs.next()) {
                        if (!primeiro) sb.append(',');
                        primeiro = false;
                        sb.append("{\"quando\":").append(Json.quote(rs.getString(1))).append(",\"dataRef\":").append(Json.quote(rs.getString(2)))
                          .append(",\"codFornecedor\":").append(rs.getInt(3))
                          .append(",\"fornecedor\":").append(Json.quote(nvl(rs.getString(4))))
                          .append(",\"destino\":").append(Json.quote(nvl(rs.getString(5))))
                          .append(",\"origem\":").append(Json.quote(nvl(rs.getString(6))))
                          .append(",\"status\":").append(Json.quote(nvl(rs.getString(7))))
                          .append(",\"erro\":").append(Json.quote(nvl(rs.getString(8)))).append('}');
                    }
                    rs.close();
                } finally {
                    st.close();
                }
                return sb.append(']').toString();
            }
        });
    }

    /** Fretistas com produção na safra (código e nome), para escolher na tela de cadastro. Cache de 10 minutos. */
    String fornecedoresJson() throws Exception {
        List<Fretista> lista = fornecedoresCache;
        if (lista == null || System.currentTimeMillis() - fornecedoresEm > 10 * 60 * 1000L) {
            lista = dados.carregar(ontem(), null, false);
            fornecedoresCache = lista;
            fornecedoresEm = System.currentTimeMillis();
        }
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < lista.size(); i++) {
            Fretista f = lista.get(i);
            sb.append(i > 0 ? "," : "").append("{\"codFornecedor\":").append(f.codigo).append(",\"nome\":").append(Json.quote(f.nome)).append('}');
        }
        return sb.append(']').toString();
    }

    static String resultadoJson(Resultado r) {
        StringBuilder sb = new StringBuilder("{\"dataRef\":").append(Json.quote(r.dataRef))
            .append(",\"cadastros\":").append(r.cadastros).append(",\"enviados\":").append(r.enviados)
            .append(",\"jaEnviados\":").append(r.jaEnviados).append(",\"semProducao\":").append(r.semProducao)
            .append(",\"falhas\":").append(r.falhas).append(",\"detalhes\":[");
        for (int i = 0; i < r.detalhes.size(); i++) sb.append(i > 0 ? "," : "").append(Json.quote(r.detalhes.get(i)));
        return sb.append("]}").toString();
    }

    // ---------------------------------------------------------------- utilitários

    private static String texto(JsonObject o, String campo) {
        JsonElement e = o.get(campo);
        return e != null && e.isJsonPrimitive() ? e.getAsString() : "";
    }

    private static boolean booleano(JsonObject o, String campo) {
        JsonElement e = o.get(campo);
        return e != null && e.isJsonPrimitive() && e.getAsBoolean();
    }

    private static JsonObject objeto(JsonObject o, String campo) {
        JsonElement e = o.get(campo);
        return e != null && e.isJsonObject() ? e.getAsJsonObject() : null;
    }

    private static String nvl(String s) {
        return s == null ? "" : s;
    }

    private static String cortar(String s, int max) {
        return s == null ? null : (s.length() > max ? s.substring(0, max) : s);
    }

    private static String resumo(Throwable e) {
        String m = e.getClass().getSimpleName() + (e.getMessage() != null ? ": " + e.getMessage().trim() : "");
        return m.length() > 480 ? m.substring(0, 480) : m;
    }
}
