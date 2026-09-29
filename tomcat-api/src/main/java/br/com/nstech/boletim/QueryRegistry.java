package br.com.nstech.boletim;

import br.com.nstech.boletim.Params.Spec;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Catálogo fechado das consultas expostas pela API. Os SQLs ficam em src/main/resources/sql e são
 * os mesmos do projeto Node original; nada além do que está aqui pode ser executado.
 */
final class QueryRegistry {

    interface SqlBuilder {
        String build(Map<String, Object> values);
    }

    static final class Query {
        final String name;
        final String description;
        final List<Spec> params;
        final boolean cacheable;
        /** Comando de escrita (INSERT/UPDATE/MERGE/DELETE): só via POST e nunca em cache. */
        final boolean write;
        final SqlBuilder builder;

        Query(String name, String description, boolean cacheable, SqlBuilder builder, Spec... params) {
            this(name, description, cacheable, false, builder, params);
        }

        Query(String name, String description, boolean cacheable, boolean write, SqlBuilder builder, Spec... params) {
            this.name = name;
            this.description = description;
            this.cacheable = cacheable && !write;
            this.write = write;
            this.builder = builder;
            this.params = Collections.unmodifiableList(Arrays.asList(params));
        }
    }

    private static final Pattern PESO_POSITIVO =
        Pattern.compile("AND\\s+iec\\.pesoliquido\\s*>\\s*0", Pattern.CASE_INSENSITIVE);

    private final Map<String, Query> queries = new LinkedHashMap<String, Query>();
    private final Map<String, String> sqlFiles = new ConcurrentHashMap<String, String>();
    private final Map<String, NamedSql> parsed = new ConcurrentHashMap<String, NamedSql>();

    QueryRegistry() throws IOException {
        Spec safra = Spec.integer("safra", false, 1, 9999, "código da safra (padrão: SAFRA_PADRAO)");
        Spec inicioSafra = Spec.date("inicioSafra", false, "data de início da safra (padrão: INICIO_SAFRA_PADRAO)");

        // --- AGRÍCOLA ---
        simple("agricola.dataHoraAtual", "Data/hora do servidor Oracle", false);
        add(new Query("agricola.resumo", "Resumo completo da moagem (Hoje/Ontem/Safra/Turnos/Horas)", true,
            v -> {
                String sql = sql("agricola_resumo");
                if (v.get("tipoCorte") != null) {
                    sql = PESO_POSITIVO.matcher(sql)
                        .replaceAll(Matcher.quoteReplacement("AND iec.pesoliquido > 0 AND oc.cod_tipocorte = :tipoCorte"));
                }
                return sql;
            },
            safra, Spec.integer("tipoCorte", false, 1, 2, "1 = manual, 2 = colhedora; omitido = todos")));
        simple("agricola.estimativaSafra", "Estimativa e previsão de término da safra", true, safra);
        simple("agricola.rendimentoTch", "TCH previsto x realizado", true, safra);
        simple("agricola.resumoMensal", "Resumo mensal e por tipo de fazenda", true, safra);
        simple("agricola.planejamentoColheita", "Estimado x planejado x colhido por lote (talhão)", true, safra);
        Spec[] detalhe = {
            safra,
            Spec.date("datini", true, "data inicial"),
            Spec.date("datfin", true, "data final"),
            Spec.integer("horini", false, 0, 23, "hora inicial (padrão 0)").orDefault(0),
            Spec.integer("horfin", false, 0, 23, "hora final (padrão 23)").orDefault(23),
            Spec.oneOf("tipcol", "T = todos, M = mecanizada, MAN = manual (padrão T)", "T", "M", "MAN").orDefault("T"),
            Spec.integer("tipo", false, 0, 99, "1, 2 ou 3 filtram o tipo de fazenda (padrão 0 = todos)").orDefault(0)
        };
        add(new Query("agricola.detalheFornecedor", "Detalhe por fornecedor/fazenda", true,
            v -> detalheAgricola("agricola_detalheFornecedor", v), detalhe));
        add(new Query("agricola.detalheVariedade", "Detalhe por variedade", true,
            v -> detalheAgricola("agricola_detalheVariedade", v), detalhe));

        // --- INDÚSTRIA ---
        simple("industria.statusFabrica", "Status das moendas A e B", true);
        simple("industria.boletimDiario", "Boletim diário de ontem (relatório 21)", true, safra);
        simple("industria.graficoHojeOntem", "Entrada de cana por hora: hoje x ontem", true, safra);
        simple("industria.graficoSafraComparativo", "Entrada de cana por mês: safra atual x anterior", true, safra);
        simple("industria.graficoProducaoMensal", "Produção mensal (açúcar, álcool) atual x anterior", true, safra);
        simple("industria.paradasRecentes", "Paradas das moendas nos últimos 15 dias", true);
        simple("industria.paradasPorCausa", "Minutos parados por causa em cada moenda: hoje, ontem e safra", true, inicioSafra);

        // --- PRODUÇÃO ---
        simple("producao.historicoDiario", "Histórico diário de produção", true, safra);
        simple("producao.horariaHidratado", "Produção horária de álcool hidratado (hoje)", true, safra);
        simple("producao.horariaAnidro", "Produção horária de álcool anidro (hoje)", true, safra);
        simple("producao.horariaAcucar", "Produção horária de açúcar (hoje)", true, safra);
        simple("producao.totalSafraAcucar", "Total acumulado de açúcar na safra", true, safra);
        simple("producao.semanal", "Tabela semanal de produção", true, safra, inicioSafra);

        // --- FROTA ---
        simple("frota.transportePorTipo", "Transporte por tipo de equipamento", true, safra);
        simple("frota.carregamentoPorTipo", "Carregamento por tipo de equipamento", true, safra);
        simple("frota.transportePorProprietario", "Transporte por proprietário", true, safra);
        add(new Query("frota.detalheEquipamentos", "Detalhe por equipamento", true,
            v -> {
                String sql = sql("C".equals(v.get("tipo")) ? "frota_detalheCarregamento" : "frota_detalheTransporte");
                return sql.replace("{{FILTRO_CODIGO}}",
                    v.get("codigo") != null ? "and d.cod_tipoequipamento = :codigo" : "");
            },
            safra,
            Spec.oneOf("tipo", "T = transporte, C = carregamento (padrão T)", "T", "C").orDefault("T"),
            Spec.integer("codigo", false, 0, 999999, "código do tipo de equipamento")));
        simple("frota.disponibilidade", "Disponibilidade da frota própria", true, safra, inicioSafra);

        // --- LABORATÓRIO ---
        simple("laboratorio.indicadores", "Indicadores industriais (ontem/hoje/safra)", true, safra);
        simple("laboratorio.moagemMedia", "Moagem média por hora", true, safra, inicioSafra);

        // --- CONTROLE DE ACESSO POR DISPOSITIVO (tabela NST_DISPOSITIVO_ACESSO) ---
        // Único ponto da API que grava no banco; os comandos só tocam nessa tabela.
        Spec hash = Spec.pattern("hash", true, "[0-9a-f]{64}", "SHA-256 (hex) do identificador do dispositivo");
        Spec id = Spec.integer("id", true, 1, 999999999, "ID do dispositivo");
        Spec por = Spec.text("por", true, 100, "quem executou a ação");
        Spec ip = Spec.pattern("ip", false, "[0-9A-Fa-f:.]{1,45}", "IP do cliente");
        simple("acesso.dispositivo", "Situação de um dispositivo pelo hash", false, hash);
        simple("acesso.listar", "Todos os dispositivos (painel de administração)", false);
        command("acesso.solicitar", "Registra (ou atualiza, se ainda pendente) um pedido de acesso",
            hash,
            Spec.text("nome", true, 100, "nome de quem solicita"),
            Spec.text("setor", false, 100, "setor/função"),
            Spec.text("contato", false, 100, "telefone ou e-mail"),
            Spec.text("descricao", true, 100, "identificação do dispositivo"),
            Spec.text("userAgent", false, 400, "navegador"),
            ip);
        command("acesso.liberarComCodigo", "Aprova o dispositivo como administrador (código de liberação)", hash);
        command("acesso.alterarStatus", "Aprova ou bloqueia um dispositivo", id,
            Spec.oneOf("status", "A = aprovado, B = bloqueado", "A", "B"), por);
        command("acesso.definirAdmin", "Concede/retira administração de um dispositivo aprovado", id,
            Spec.oneOf("admin", "S ou N", "S", "N"), por);
        command("acesso.excluir", "Remove um dispositivo da lista", id);
        command("acesso.registrarUso", "Atualiza a data/IP do último acesso", hash, ip);

        // Falha na subida (e não na primeira requisição) se algum SQL com variantes estiver faltando
        for (String f : new String[] {"agricola_resumo", "agricola_detalheFornecedor", "agricola_detalheVariedade",
                                      "frota_detalheCarregamento", "frota_detalheTransporte"}) {
            sql(f);
        }
    }

    Query get(String name) {
        return queries.get(name);
    }

    Collection<Query> all() {
        return queries.values();
    }

    NamedSql parse(String sql) {
        NamedSql n = parsed.get(sql);
        if (n == null) {
            n = NamedSql.parse(sql);
            if (parsed.size() < 500) parsed.put(sql, n);
        }
        return n;
    }

    private String detalheAgricola(String file, Map<String, Object> v) {
        String tipcol = (String) v.get("tipcol");
        String filtroTipcol = "M".equals(tipcol) ? " and tc.cod_tipocana in (3,4) "
            : "MAN".equals(tipcol) ? " and tc.cod_tipocana not in (3,4) " : "";
        int tipo = (Integer) v.get("tipo");
        String filtroTipo = (tipo >= 1 && tipo <= 3) ? " and htfz.cod_tipofazenda = :tipo " : "";
        return sql(file).replace("{{FILTRO_TIPCOL}}", filtroTipcol).replace("{{FILTRO_TIPO}}", filtroTipo);
    }

    private void simple(String name, String description, boolean cacheable, Spec... params) {
        final String file = name.replace('.', '_');
        sql(file);
        add(new Query(name, description, cacheable, v -> sql(file), params));
    }

    private void command(String name, String description, Spec... params) {
        final String file = name.replace('.', '_');
        sql(file);
        add(new Query(name, description, false, true, v -> sql(file), params));
    }

    private void add(Query q) {
        queries.put(q.name, q);
    }

    private String sql(String file) {
        String s = sqlFiles.get(file);
        if (s == null) {
            s = load("/sql/" + file + ".sql");
            sqlFiles.put(file, s);
        }
        return s;
    }

    private static String load(String resource) {
        InputStream in = QueryRegistry.class.getResourceAsStream(resource);
        if (in == null) throw new IllegalStateException("SQL não encontrado: " + resource);
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int r;
            while ((r = in.read(buf)) > 0) out.write(buf, 0, r);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Falha lendo " + resource, e);
        } finally {
            try { in.close(); } catch (IOException ignore) { }
        }
    }
}
