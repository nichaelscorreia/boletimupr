package br.com.nstech.boletim;

import java.util.ArrayList;
import java.util.List;
import javax.servlet.ServletContext;

/**
 * Configuração da API. Cada chave é lida, nesta ordem, de:
 *   1. &lt;Parameter name="CHAVE"&gt; no context.xml do Tomcat (conf/Catalina/localhost/boletim-api.xml)
 *   2. variável de ambiente BOLETIM_CHAVE
 *   3. valor padrão
 */
final class ApiConfig {

    final String dbUrl;
    final String dbUser;
    final String dbPassword;
    final int poolSize;
    final int queryTimeoutSeconds;
    final int maxRows;

    final String secret;
    final IpAllowList allowedIps;
    final int rateLimitPerMinute;
    final int cacheSeconds;

    final int safraPadrao;
    final String inicioSafraPadrao;

    // Empresa (usada pelas rotinas de e-mail; os demais SQLs trazem esses códigos fixos)
    final int codGrupoEmpresa;
    final int codEmpresa;
    final int codFilial;

    // E-mail automático dos fretistas
    final boolean emailFretistasAtivo;
    final String emailFretistasHora;   // HH:mm no fuso emailFuso
    final String emailFuso;
    final String emailDestinoTeste;    // preenchido = TODOS os e-mails vão só para este endereço
    final String emailCopia;           // endereço(s) em cópia (CC) de todos os e-mails, em teste e em produção
    final boolean emailRegistrar;      // false = não usa NST_EMAIL_ENVIO (sem controle de duplicidade; só para testes)
    final String emailRemetenteNome;
    final String smtpHost;
    final int smtpPort;
    final String smtpUser;
    final String smtpPassword;

    /** Problemas de configuração que impedem a API de atender (lista vazia = OK). */
    final List<String> problems = new ArrayList<String>();

    private ApiConfig(ServletContext ctx) {
        dbUrl = get(ctx, "DB_URL", "jdbc:oracle:thin:@192.168.2.6:1521:csorcl");
        dbUser = get(ctx, "DB_USER", "");
        dbPassword = get(ctx, "DB_PASSWORD", "");
        poolSize = getInt(ctx, "DB_POOL_SIZE", 8, 1, 50);
        queryTimeoutSeconds = getInt(ctx, "DB_QUERY_TIMEOUT_SECONDS", 120, 5, 900);
        maxRows = getInt(ctx, "MAX_ROWS", 20000, 1, 1000000);

        secret = get(ctx, "API_SECRET", "");
        allowedIps = IpAllowList.parse(get(ctx, "ALLOWED_IPS", ""));
        rateLimitPerMinute = getInt(ctx, "RATE_LIMIT_PER_MINUTE", 600, 1, 100000);
        cacheSeconds = getInt(ctx, "CACHE_SECONDS", 20, 0, 3600);

        safraPadrao = getInt(ctx, "SAFRA_PADRAO", 54, 1, 9999);
        inicioSafraPadrao = get(ctx, "INICIO_SAFRA_PADRAO", "10/09/2026");

        codGrupoEmpresa = getInt(ctx, "COD_GRUPOEMPRESA", 2, 1, 9999);
        codEmpresa = getInt(ctx, "COD_EMPRESA", 1, 1, 9999);
        codFilial = getInt(ctx, "COD_FILIAL", 1, 1, 9999);

        emailFretistasAtivo = "S".equalsIgnoreCase(get(ctx, "EMAIL_FRETISTAS_ATIVO", "N"));
        emailFretistasHora = get(ctx, "EMAIL_FRETISTAS_HORA", "06:00");
        emailFuso = get(ctx, "EMAIL_FUSO", "America/Maceio");
        emailDestinoTeste = get(ctx, "EMAIL_DESTINO_TESTE", "");
        emailCopia = get(ctx, "EMAIL_COPIA", "");
        emailRegistrar = !"N".equalsIgnoreCase(get(ctx, "EMAIL_REGISTRAR", "S"));
        emailRemetenteNome = get(ctx, "EMAIL_REMETENTE_NOME", "Impacto Bioenergia");
        smtpHost = get(ctx, "SMTP_HOST", "smtp-mail.outlook.com");
        smtpPort = getInt(ctx, "SMTP_PORT", 587, 1, 65535);
        smtpUser = get(ctx, "SMTP_USER", "");
        smtpPassword = get(ctx, "SMTP_PASSWORD", "");

        if (dbUser.isEmpty() || dbPassword.isEmpty()) {
            problems.add("DB_USER/DB_PASSWORD não configurados");
        }
        if (secret.length() < 32 || secret.startsWith("TROQUE")) {
            problems.add("API_SECRET ausente ou fraco (mínimo 32 caracteres)");
        }
        if (!Params.isValidDate(inicioSafraPadrao)) {
            problems.add("INICIO_SAFRA_PADRAO inválido (use dd/mm/aaaa)");
        }
    }

    static ApiConfig load(ServletContext ctx) {
        return new ApiConfig(ctx);
    }

    private static String get(ServletContext ctx, String key, String def) {
        String v = ctx.getInitParameter(key);
        if (v == null || v.trim().isEmpty()) {
            v = System.getenv("BOLETIM_" + key);
        }
        return (v == null || v.trim().isEmpty()) ? def : v.trim();
    }

    private static int getInt(ServletContext ctx, String key, int def, int min, int max) {
        String v = get(ctx, key, null);
        if (v == null) return def;
        try {
            int n = Integer.parseInt(v);
            return Math.max(min, Math.min(max, n));
        } catch (NumberFormatException e) {
            return def;
        }
    }
}
