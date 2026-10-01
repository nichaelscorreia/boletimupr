package br.com.nstech.boletim;

import br.com.nstech.boletim.ConnectionPool.Pooled;
import br.com.nstech.boletim.Params.Spec;
import br.com.nstech.boletim.QueryRegistry.Query;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.Driver;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * Endpoints (todos GET):
 *   /api/health          sem autenticação, não toca no banco
 *   /api/ping            autenticado, executa SELECT 1 FROM DUAL
 *   /api/email/fretistas/previa?data=&fornecedor=   autenticado, o que seria enviado (sem enviar)
 *   POST /api/email/fretistas/enviar?data=&fornecedor=&reenviar=S   autenticado, dispara o envio agora
 *   /api/diag            autenticado, versões (Java/Tomcat/driver/Oracle), erro completo de conexão e
 *                        situação da tabela de dispositivos — para suporte remoto sem acesso ao servidor
 *   /api/queries         autenticado, lista as consultas e parâmetros aceitos
 *   /api/q/{consulta}    autenticado, executa uma consulta do catálogo e devolve um array JSON
 *                        (chaves em MAIÚSCULAS e valores como texto, igual ao antigo OracleBridge)
 *   POST /api/q/{comando} autenticado, executa um comando de escrita do catálogo (parâmetros na
 *                        query string, cobertos pela assinatura; corpo não é aceito) e devolve {"linhas":n}
 */
public class ApiServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;

    private transient ApiConfig cfg;
    private transient QueryRegistry registry;
    private transient ConnectionPool pool;
    private transient Security security;
    private transient ResultCache cache;
    private transient EmailFretistas emailFretistas;
    private transient java.util.concurrent.ScheduledExecutorService agendador;
    private volatile String ultimoDiaEmail = "";
    private int tentativasEmail;

    @Override
    public void init() throws ServletException {
        cfg = ApiConfig.load(getServletContext());
        try {
            registry = new QueryRegistry();
        } catch (IOException e) {
            throw new ServletException(e);
        }
        if (!cfg.problems.isEmpty()) {
            log("Boletim API NÃO configurada: " + cfg.problems + ". Respondendo 503 até corrigir.");
            return;
        }
        try {
            pool = new ConnectionPool(cfg);
        } catch (ClassNotFoundException e) {
            throw new ServletException("Driver Oracle (ojdbc) não encontrado", e);
        }
        security = new Security(cfg.secret, cfg.rateLimitPerMinute);
        cache = new ResultCache(cfg.cacheSeconds);
        try {
            emailFretistas = new EmailFretistas(cfg, pool, getServletContext());
        } catch (IOException e) {
            throw new ServletException(e);
        }
        iniciarAgendadorEmail();
        log("Boletim API ativa: " + registry.all().size() + " consultas, pool=" + cfg.poolSize
            + ", cache=" + cfg.cacheSeconds + "s, IPs permitidos="
            + (cfg.allowedIps.isEmpty() ? "todos" : "restrito"));
    }

    /** E-mail diário dos fretistas: confere a cada 5 minutos se já passou do horário e ainda não foi enviado hoje. */
    private void iniciarAgendadorEmail() {
        if (!cfg.emailFretistasAtivo) {
            log("E-mail fretistas: agendamento desativado (EMAIL_FRETISTAS_ATIVO != S)");
            return;
        }
        if (!emailFretistas.smtpConfigurado()) {
            log("E-mail fretistas: SMTP_USER/SMTP_PASSWORD não configurados; agendamento não iniciado");
            return;
        }
        final java.time.ZoneId zona;
        final java.time.LocalTime hora;
        try {
            zona = java.time.ZoneId.of(cfg.emailFuso);
            hora = java.time.LocalTime.parse(cfg.emailFretistasHora);
        } catch (RuntimeException e) {
            log("E-mail fretistas: EMAIL_FRETISTAS_HORA (HH:mm) ou EMAIL_FUSO inválido; agendamento não iniciado");
            return;
        }
        agendador = java.util.concurrent.Executors.newSingleThreadScheduledExecutor(new java.util.concurrent.ThreadFactory() {
            @Override
            public Thread newThread(Runnable r) {
                Thread t = new Thread(r, "boletim-email-fretistas");
                t.setDaemon(true);
                return t;
            }
        });
        agendador.scheduleWithFixedDelay(new Runnable() {
            @Override
            public void run() {
                try {
                    verificarEnvioDiario(zona, hora);
                } catch (Throwable t) {
                    log("E-mail fretistas: erro no agendador", t);
                }
            }
        }, 1, 5, java.util.concurrent.TimeUnit.MINUTES);
        log("E-mail fretistas: agendado para " + hora + " (" + zona + ")"
            + (emailFretistas.modoTeste() ? " em MODO DE TESTE -> " + cfg.emailDestinoTeste : ""));
    }

    private void verificarEnvioDiario(java.time.ZoneId zona, java.time.LocalTime hora) {
        java.time.ZonedDateTime agora = java.time.ZonedDateTime.now(zona);
        String hoje = agora.toLocalDate().toString();
        java.time.LocalTime t = agora.toLocalTime();
        // Só dentro da janela [hora, hora + 12h): se o Tomcat estava fora do ar às 6h, envia ao voltar
        if (hoje.equals(ultimoDiaEmail) || t.isBefore(hora) || java.time.Duration.between(hora, t).toHours() >= 12) return;
        String ontem = agora.toLocalDate().minusDays(1).format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        boolean concluido;
        try {
            concluido = emailFretistas.enviar(ontem, false, null).falhas == 0;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return;
        } catch (Exception e) {
            log("E-mail fretistas: envio do dia " + ontem + " falhou", e);
            concluido = false;
        }
        // Com falhas, tenta de novo nas próximas verificações (até 4 vezes no dia); quem já recebeu não recebe de novo
        if (concluido || ++tentativasEmail >= 4) {
            ultimoDiaEmail = hoje;
            tentativasEmail = 0;
        }
    }

    @Override
    public void destroy() {
        if (agendador != null) agendador.shutdownNow();
        if (pool != null) pool.close();
        // Evita vazamento de memória do driver Oracle em redeploys
        ClassLoader cl = getClass().getClassLoader();
        Enumeration<Driver> drivers = DriverManager.getDrivers();
        while (drivers.hasMoreElements()) {
            Driver d = drivers.nextElement();
            if (d.getClass().getClassLoader() == cl) {
                try {
                    DriverManager.deregisterDriver(d);
                } catch (SQLException ignore) {
                }
            }
        }
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        handle(req, resp, false);
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        handle(req, resp, true);
    }

    private void handle(HttpServletRequest req, HttpServletResponse resp, boolean post) throws IOException {
        resp.setHeader("Cache-Control", "no-store");
        resp.setHeader("X-Content-Type-Options", "nosniff");

        String path = req.getPathInfo() == null ? "/" : req.getPathInfo();
        if ("/health".equals(path)) {
            send(resp, 200, "{\"status\":\"ok\"}");
            return;
        }
        if (pool == null) {
            send(resp, 503, error("API não configurada no servidor"));
            return;
        }

        String ip = req.getRemoteAddr();
        if (!cfg.allowedIps.allows(ip)) {
            log("Acesso negado (IP fora de ALLOWED_IPS): " + ip);
            send(resp, 403, error("Acesso negado"));
            return;
        }
        if (security.isLockedOut(ip)) {
            send(resp, 429, error("Muitas falhas de autenticação; tente mais tarde"));
            return;
        }
        if (!security.verifySignature(req)) {
            security.recordAuthFailure(ip);
            log("Assinatura inválida de " + ip + " em " + req.getRequestURI());
            send(resp, 401, error("Não autorizado"));
            return;
        }
        if (!security.allowRequest(ip)) {
            send(resp, 429, error("Limite de requisições excedido"));
            return;
        }

        if (post) {
            // Parâmetros de corpo não são cobertos pela assinatura: recusa qualquer corpo
            if (req.getContentLength() > 0 || req.getHeader("Transfer-Encoding") != null) {
                send(resp, 400, error("Envie os parâmetros na query string"));
            } else if (path.startsWith("/q/")) {
                runQuery(req, resp, path.substring(3), true);
            } else if ("/email/fretistas/enviar".equals(path)) {
                emailFretistas(req, resp, true);
            } else {
                send(resp, 405, error("Método não permitido"));
            }
        } else if ("/ping".equals(path)) {
            ping(resp);
        } else if ("/diag".equals(path)) {
            diag(resp);
        } else if ("/email/fretistas/previa".equals(path)) {
            emailFretistas(req, resp, false);
        } else if ("/queries".equals(path)) {
            listQueries(resp);
        } else if (path.startsWith("/q/")) {
            runQuery(req, resp, path.substring(3), false);
        } else {
            send(resp, 404, error("Endpoint inexistente"));
        }
    }

    private void runQuery(HttpServletRequest req, HttpServletResponse resp, String name, boolean post) throws IOException {
        final Query q = registry.get(name);
        if (q == null) {
            send(resp, 404, error("Consulta inexistente: " + name));
            return;
        }
        if (q.write != post) {
            send(resp, 405, error(q.write ? "Comando exige POST" : "Consulta exige GET"));
            return;
        }

        final Map<String, Object> values;
        try {
            values = bindValues(q, req);
        } catch (IllegalArgumentException e) {
            send(resp, 400, error(e.getMessage()));
            return;
        }

        if (q.name.startsWith("acesso.")) {
            try {
                garantirTabelaAcesso();
            } catch (Exception e) {
                log("Não foi possível preparar a tabela de dispositivos", e);
                send(resp, 500, error("Tabela de dispositivos indisponível: " + causas(e)));
                return;
            }
        }

        final NamedSql sql = registry.parse(q.builder.build(values));
        long start = System.currentTimeMillis();
        try {
            byte[] body = q.write
                ? execute(sql, values, true)
                : cache.get(q.name + values, q.cacheable, () -> execute(sql, values));
            long ms = System.currentTimeMillis() - start;
            if (ms > 5000) log("Consulta lenta " + q.name + " " + values + ": " + ms + " ms");
            send(resp, 200, body);
        } catch (Exception e) {
            String ref = UUID.randomUUID().toString().substring(0, 8);
            log("Erro [" + ref + "] na consulta " + q.name + " " + values, e);
            String msg = e instanceof SQLException ? causas(e) : "Erro interno";
            send(resp, 500, "{\"error\":" + Json.quote(msg == null ? "Erro interno" : msg.trim())
                + ",\"ref\":\"" + ref + "\"}");
        }
    }

    /** Valida os parâmetros da requisição contra o catálogo e aplica padrões. */
    private Map<String, Object> bindValues(Query q, HttpServletRequest req) {
        Map<String, String[]> raw = req.getParameterMap();
        for (String key : raw.keySet()) {
            boolean known = false;
            for (Spec s : q.params) known |= s.name.equals(key);
            if (!known) throw new IllegalArgumentException("Parâmetro desconhecido: " + key);
            if (raw.get(key).length > 1) throw new IllegalArgumentException("Parâmetro repetido: " + key);
        }

        Map<String, Object> values = new LinkedHashMap<String, Object>();
        for (Spec s : q.params) {
            String v = req.getParameter(s.name);
            if (v != null && !v.trim().isEmpty()) {
                values.put(s.name, s.parse(v.trim()));
            } else if (s.required) {
                throw new IllegalArgumentException("Parâmetro obrigatório ausente: " + s.name);
            } else if (s.def != null) {
                values.put(s.name, s.def);
            } else if ("safra".equals(s.name)) {
                values.put(s.name, cfg.safraPadrao);
            } else if ("inicioSafra".equals(s.name)) {
                values.put(s.name, cfg.inicioSafraPadrao);
            } else {
                values.put(s.name, null); // opcional sem padrão: vai como NULL (builders devem testar o valor, não containsKey)
            }
        }
        if (values.containsKey("safra")) {
            values.put("safraAnt", (Integer) values.get("safra") - 1);
        }
        return values;
    }

    private byte[] execute(NamedSql sql, Map<String, Object> values) throws Exception {
        return execute(sql, values, false);
    }

    private byte[] execute(NamedSql sql, Map<String, Object> values, boolean write) throws Exception {
        Pooled p = pool.borrow();
        boolean broken = false;
        try {
            Connection con = p.con;
            PreparedStatement ps = con.prepareStatement(sql.jdbcSql);
            try {
                ps.setQueryTimeout(cfg.queryTimeoutSeconds);
                ps.setMaxRows(cfg.maxRows);
                ps.setFetchSize(500);
                for (int i = 0; i < sql.paramNames.size(); i++) {
                    String n = sql.paramNames.get(i);
                    if (!values.containsKey(n)) throw new IllegalStateException("Parâmetro sem valor no SQL: " + n);
                    Object v = values.get(n);
                    if (v instanceof Integer) ps.setInt(i + 1, (Integer) v);
                    else ps.setString(i + 1, (String) v);
                }
                if (write) {
                    return ("{\"linhas\":" + ps.executeUpdate() + "}").getBytes(StandardCharsets.UTF_8);
                }
                ResultSet rs = ps.executeQuery();
                try {
                    return toJson(rs);
                } finally {
                    rs.close();
                }
            } finally {
                ps.close();
            }
        } catch (SQLException e) {
            broken = !isAlive(p.con);
            throw e;
        } finally {
            pool.release(p, broken);
        }
    }

    private static byte[] toJson(ResultSet rs) throws SQLException {
        ResultSetMetaData md = rs.getMetaData();
        int cols = md.getColumnCount();
        String[] keys = new String[cols];
        for (int i = 0; i < cols; i++) {
            keys[i] = Json.quote(md.getColumnLabel(i + 1).toUpperCase()) + ":";
        }
        StringBuilder sb = new StringBuilder(4096).append('[');
        boolean first = true;
        while (rs.next()) {
            if (!first) sb.append(',');
            first = false;
            sb.append('{');
            for (int i = 0; i < cols; i++) {
                if (i > 0) sb.append(',');
                String v = rs.getString(i + 1);
                sb.append(keys[i]).append(v == null ? "null" : Json.quote(v));
            }
            sb.append('}');
        }
        return sb.append(']').toString().getBytes(StandardCharsets.UTF_8);
    }

    private void ping(HttpServletResponse resp) throws IOException {
        try {
            byte[] body = execute(NamedSql.parse("SELECT 1 AS OK FROM DUAL"), new LinkedHashMap<String, Object>());
            send(resp, 200, "{\"status\":\"ok\",\"db\":" + new String(body, StandardCharsets.UTF_8) + "}");
        } catch (Exception e) {
            log("Ping ao Oracle falhou", e);
            send(resp, 503, error("Oracle indisponível: " + causas(e)));
        }
    }

    /** Prévia (GET) ou envio manual (POST) do e-mail dos fretistas. data = dd/mm/aaaa (padrão: ontem). */
    private void emailFretistas(HttpServletRequest req, HttpServletResponse resp, boolean enviar) throws IOException {
        String data = req.getParameter("data");
        if (data == null || data.trim().isEmpty()) {
            data = java.time.ZonedDateTime.now(java.time.ZoneId.of(cfg.emailFuso)).toLocalDate().minusDays(1)
                .format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        } else if (!Params.isValidDate(data.trim())) {
            send(resp, 400, error("Parâmetro 'data' deve ser dd/mm/aaaa"));
            return;
        }
        Integer fornecedor = null;
        String f = req.getParameter("fornecedor");
        if (f != null && !f.trim().isEmpty()) {
            if (!f.trim().matches("\\d{1,9}")) {
                send(resp, 400, error("Parâmetro 'fornecedor' deve ser inteiro"));
                return;
            }
            fornecedor = Integer.valueOf(f.trim());
        }
        try {
            if (enviar) {
                boolean reenviar = "S".equalsIgnoreCase(req.getParameter("reenviar"));
                send(resp, 200, EmailFretistas.resultadoJson(emailFretistas.enviar(data.trim(), reenviar, fornecedor)));
            } else {
                send(resp, 200, emailFretistas.previaJson(data.trim(), fornecedor));
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            send(resp, 503, error("Envio interrompido"));
        } catch (Exception e) {
            log("E-mail fretistas: erro em " + (enviar ? "envio manual" : "prévia"), e);
            send(resp, 500, error(causas(e)));
        }
    }

    /** Situação completa para suporte remoto (nunca devolve usuário/senha do banco). */
    private void diag(HttpServletResponse resp) throws IOException {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"java\":").append(Json.quote(System.getProperty("java.version") + " (" + System.getProperty("java.vendor") + ")"));
        sb.append(",\"tomcat\":").append(Json.quote(getServletContext().getServerInfo()));
        long t0 = System.currentTimeMillis();
        Pooled p = null;
        boolean broken = false;
        try {
            p = pool.borrow();
            java.sql.DatabaseMetaData md = p.con.getMetaData();
            sb.append(",\"driver\":").append(Json.quote(md.getDriverName() + " " + md.getDriverVersion()));
            sb.append(",\"conexao\":\"ok\",\"tempoMs\":").append(System.currentTimeMillis() - t0);
            sb.append(",\"oracle\":").append(Json.quote(md.getDatabaseProductVersion().replace('\n', ' ')));
            sb.append(",\"usuarioBanco\":").append(Json.quote(md.getUserName()));
        } catch (Exception e) {
            broken = true;
            sb.append(",\"conexao\":\"erro\",\"tempoMs\":").append(System.currentTimeMillis() - t0);
            sb.append(",\"erro\":").append(Json.quote(causas(e)));
        } finally {
            if (p != null) pool.release(p, broken);
        }
        String tabela;
        try {
            garantirTabelaAcesso();
            tabela = "ok";
        } catch (Exception e) {
            tabela = "erro: " + causas(e);
        }
        sb.append(",\"tabelaDispositivos\":").append(Json.quote(tabela));
        sb.append(",\"safraPadrao\":").append(cfg.safraPadrao);
        sb.append(",\"inicioSafraPadrao\":").append(Json.quote(cfg.inicioSafraPadrao));
        send(resp, 200, sb.append('}').toString());
    }

    /** Mensagens de toda a cadeia de causas (o erro útil do driver costuma estar lá no fundo). */
    private static String causas(Throwable e) {
        StringBuilder sb = new StringBuilder();
        java.util.Set<Throwable> vistos = new java.util.HashSet<Throwable>();
        for (Throwable t = e; t != null && vistos.add(t); t = t.getCause()) {
            if (sb.length() > 0) sb.append(" <- ");
            sb.append(t.getClass().getSimpleName());
            if (t.getMessage() != null) sb.append(": ").append(t.getMessage().trim());
        }
        return sb.length() > 1500 ? sb.substring(0, 1500) + "…" : sb.toString();
    }

    // --- Tabela de dispositivos: criada automaticamente se não existir (a usina não tem acesso ao banco) ---

    private volatile boolean tabelaAcessoOk;

    private synchronized void garantirTabelaAcesso() throws Exception {
        if (tabelaAcessoOk) return;
        Pooled p = pool.borrow();
        boolean broken = false;
        try {
            java.sql.Statement st = p.con.createStatement();
            try {
                boolean temTabela = conta(st, "select count(*) from user_tables where table_name = 'NST_DISPOSITIVO_ACESSO'") > 0;
                boolean temSequencia = conta(st, "select count(*) from user_sequences where sequence_name = 'NST_DISPOSITIVO_ACESSO_SEQ'") > 0;
                if (!temTabela || !temSequencia) {
                    for (String cmd : ddlAcesso()) {
                        String c = cmd.toLowerCase();
                        boolean executar = (c.startsWith("create table") && !temTabela)
                            || (c.startsWith("comment") && !temTabela)
                            || (c.startsWith("create sequence") && !temSequencia);
                        if (executar) st.execute(cmd);
                    }
                    log("Tabela de dispositivos criada/completada (tabela existia: " + temTabela + ", sequência existia: " + temSequencia + ")");
                }
                tabelaAcessoOk = true;
            } finally {
                st.close();
            }
        } catch (SQLException e) {
            broken = !isAlive(p.con);
            throw e;
        } finally {
            pool.release(p, broken);
        }
    }

    private static int conta(java.sql.Statement st, String sql) throws SQLException {
        ResultSet rs = st.executeQuery(sql);
        try {
            rs.next();
            return rs.getInt(1);
        } finally {
            rs.close();
        }
    }

    /** Comandos do script ddl/nst_dispositivo_acesso.sql (sem comentários, separados por ";"). */
    private static java.util.List<String> ddlAcesso() throws IOException {
        java.io.InputStream in = ApiServlet.class.getResourceAsStream("/ddl/nst_dispositivo_acesso.sql");
        if (in == null) throw new IOException("Script da tabela de dispositivos não encontrado no WAR");
        StringBuilder sb = new StringBuilder();
        java.io.BufferedReader r = new java.io.BufferedReader(new java.io.InputStreamReader(in, StandardCharsets.UTF_8));
        try {
            String linha;
            while ((linha = r.readLine()) != null) {
                if (!linha.trim().startsWith("--")) sb.append(linha).append('\n');
            }
        } finally {
            r.close();
        }
        java.util.List<String> cmds = new java.util.ArrayList<String>();
        for (String c : sb.toString().split(";\\s*\n")) {
            if (!c.trim().isEmpty()) cmds.add(c.trim());
        }
        return cmds;
    }

    private void listQueries(HttpServletResponse resp) throws IOException {
        StringBuilder sb = new StringBuilder("[");
        boolean first = true;
        for (Query q : registry.all()) {
            if (!first) sb.append(',');
            first = false;
            sb.append("{\"name\":").append(Json.quote(q.name))
              .append(",\"description\":").append(Json.quote(q.description))
              .append(",\"params\":[");
            for (int i = 0; i < q.params.size(); i++) {
                if (i > 0) sb.append(',');
                sb.append(Json.quote(q.params.get(i).describe()));
            }
            sb.append("]}");
        }
        send(resp, 200, sb.append(']').toString());
    }

    private static boolean isAlive(Connection c) {
        try {
            return c.isValid(3);
        } catch (Throwable t) {
            return false;
        }
    }

    private static String error(String msg) {
        return "{\"error\":" + Json.quote(msg) + "}";
    }

    private static void send(HttpServletResponse resp, int status, String json) throws IOException {
        send(resp, status, json.getBytes(StandardCharsets.UTF_8));
    }

    private static void send(HttpServletResponse resp, int status, byte[] body) throws IOException {
        resp.setStatus(status);
        resp.setContentType("application/json; charset=UTF-8");
        resp.setContentLength(body.length);
        OutputStream os = resp.getOutputStream();
        os.write(body);
        os.flush();
    }
}
