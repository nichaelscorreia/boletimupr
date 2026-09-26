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
 *   /api/queries         autenticado, lista as consultas e parâmetros aceitos
 *   /api/q/{consulta}    autenticado, executa uma consulta do catálogo e devolve um array JSON
 *                        (chaves em MAIÚSCULAS e valores como texto, igual ao antigo OracleBridge)
 */
public class ApiServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;

    private transient ApiConfig cfg;
    private transient QueryRegistry registry;
    private transient ConnectionPool pool;
    private transient Security security;
    private transient ResultCache cache;

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
        log("Boletim API ativa: " + registry.all().size() + " consultas, pool=" + cfg.poolSize
            + ", cache=" + cfg.cacheSeconds + "s, IPs permitidos="
            + (cfg.allowedIps.isEmpty() ? "todos" : "restrito"));
    }

    @Override
    public void destroy() {
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

        if ("/ping".equals(path)) {
            ping(resp);
        } else if ("/queries".equals(path)) {
            listQueries(resp);
        } else if (path.startsWith("/q/")) {
            runQuery(req, resp, path.substring(3));
        } else {
            send(resp, 404, error("Endpoint inexistente"));
        }
    }

    private void runQuery(HttpServletRequest req, HttpServletResponse resp, String name) throws IOException {
        final Query q = registry.get(name);
        if (q == null) {
            send(resp, 404, error("Consulta inexistente: " + name));
            return;
        }

        final Map<String, Object> values;
        try {
            values = bindValues(q, req);
        } catch (IllegalArgumentException e) {
            send(resp, 400, error(e.getMessage()));
            return;
        }

        final NamedSql sql = registry.parse(q.builder.build(values));
        long start = System.currentTimeMillis();
        try {
            byte[] body = cache.get(q.name + values, q.cacheable, () -> execute(sql, values));
            long ms = System.currentTimeMillis() - start;
            if (ms > 5000) log("Consulta lenta " + q.name + " " + values + ": " + ms + " ms");
            send(resp, 200, body);
        } catch (Exception e) {
            String ref = UUID.randomUUID().toString().substring(0, 8);
            log("Erro [" + ref + "] na consulta " + q.name + " " + values, e);
            String msg = e instanceof SQLException ? e.getMessage() : "Erro interno";
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
            }
        }
        if (values.containsKey("safra")) {
            values.put("safraAnt", (Integer) values.get("safra") - 1);
        }
        return values;
    }

    private byte[] execute(NamedSql sql, Map<String, Object> values) throws Exception {
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
            send(resp, 503, error("Oracle indisponível"));
        }
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
