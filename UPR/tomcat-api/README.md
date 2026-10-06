# Boletim API (Tomcat)

API Java que roda no Tomcat da rede interna e expõe **somente** as consultas Oracle usadas pelo
Boletim Online de Moagem. O app Node (Render) consome esta API em vez de acessar o banco.

```
Render (Node)  --HTTP + assinatura HMAC-->  Tomcat :8086 /boletim-api  --JDBC-->  Oracle 192.168.2.6
```

## Implantação no Tomcat (8.5)

1. Copie `deploy/boletim-api.xml` para `$CATALINA_BASE/conf/Catalina/localhost/boletim-api.xml`
   (contém usuário/senha do Oracle e o `API_SECRET`; esse arquivo fica só no servidor).
2. Copie `deploy/boletim-api.war` para `$CATALINA_BASE/webapps/`.
3. Teste: `http://nstech.ddns.net:8086/boletim-api/api/health` deve retornar `{"status":"ok"}`.
4. No Render, defina `BOLETIM_API_SECRET` com o mesmo valor de `API_SECRET`.

O driver Oracle (ojdbc6) já vai dentro do WAR; não é preciso mexer em `lib/` nem reiniciar o Tomcat.
Se o log mostrar `Boletim API NÃO configurada`, confira o passo 1 (a API responde 503 até corrigir).

## Endpoints (GET)

| Caminho | Autenticação | O que faz |
|---|---|---|
| `/api/health` | não | Confirma que a aplicação está no ar (não toca no banco) |
| `/api/ping` | sim | `SELECT 1 FROM DUAL` |
| `/api/queries` | sim | Lista as consultas e os parâmetros aceitos |
| `/api/q/{consulta}?param=...` | sim | Executa uma consulta do catálogo e devolve um array JSON |

## Segurança

- **Sem SQL livre**: só as consultas de `src/main/resources/sql` podem ser executadas, com parâmetros
  validados (tipo, faixa, formato de data) e ligados por `PreparedStatement`. Parâmetro desconhecido = 400.
- **Assinatura HMAC-SHA256** em cada requisição (`X-Boletim-Timestamp` + `X-Boletim-Signature`).
  O segredo não trafega; uma assinatura só vale para a mesma URL por 5 minutos.
- **Bloqueio** de IP por 10 min após 20 falhas de autenticação; limite de requisições por minuto.
- **Cache de 20s** + deduplicação de consultas idênticas simultâneas, para poupar o Oracle.
- **Restrição por IP (recomendado)**: preencha `ALLOWED_IPS` com os IPs de saída do Render
  (painel do serviço → *Connect* → *Outbound*).
- **Recomendado**: use um usuário Oracle só com permissão de `SELECT` nas tabelas usadas, e HTTPS no
  Tomcat (a assinatura protege o acesso, mas sem HTTPS os dados de resposta trafegam sem criptografia).

## Controle de acesso por dispositivo

A API também guarda os dispositivos liberados na tabela `NST_DISPOSITIVO_ACESSO`
(script em [`ddl/nst_dispositivo_acesso.sql`](ddl/nst_dispositivo_acesso.sql)). É o **único** ponto que
grava no banco: comandos `acesso.*` via `POST /api/q/{comando}`, com os parâmetros na query string
(cobertos pela assinatura; requisição com corpo é recusada), e só sobre essa tabela.
Se trocar `DB_USER` por um usuário somente leitura, conceda a ele `SELECT, INSERT, UPDATE, DELETE`
nessa tabela e `SELECT` na sequência `NST_DISPOSITIVO_ACESSO_SEQ`.

## AgroMaps (usuários e planejamento de colheita)

O backend do AgroMaps (Flask, no Render) usa esta mesma API para guardar no Oracle os usuários do sistema
(`NST_AGROMAPS_USUARIO`) e o planejamento de colheita (`NST_AGROMAPS_PLAN_COLHEITA`), com os comandos
`agromaps.*`. As tabelas são criadas no primeiro uso (script equivalente em
[`ddl/nst_agromaps.sql`](ddl/nst_agromaps.sql)). No AgroMaps, defina `BOLETIM_API_URL` e `BOLETIM_API_SECRET`
com os mesmos valores usados pelo Boletim. Da senha só trafega o hash SHA-256, que vai na query string do
cadastro: sem HTTPS no Tomcat ele passa em claro na rede e pode ficar no log de acesso.

## Configuração (`boletim-api.xml`)

| Parâmetro | Padrão | Descrição |
|---|---|---|
| `DB_URL` | `jdbc:oracle:thin:@192.168.2.6:1521:csorcl` | URL JDBC |
| `DB_USER` / `DB_PASSWORD` | — | Obrigatórios |
| `API_SECRET` | — | Obrigatório, mínimo 32 caracteres (`openssl rand -hex 32`) |
| `ALLOWED_IPS` | vazio (todos) | IPs/faixas IPv4 separados por vírgula |
| `DB_POOL_SIZE` | 8 | Conexões simultâneas com o Oracle |
| `DB_QUERY_TIMEOUT_SECONDS` | 120 | Tempo máximo por consulta |
| `RATE_LIMIT_PER_MINUTE` | 600 | Requisições por IP por minuto |
| `CACHE_SECONDS` | 20 | 0 desativa o cache |
| `SAFRA_PADRAO` | 54 | Safra quando o cliente não envia `safra` |
| `INICIO_SAFRA_PADRAO` | 10/09/2026 | Início da safra quando o cliente não envia `inicioSafra` |

Cada parâmetro também pode vir de variável de ambiente `BOLETIM_<NOME>`.

## Build

```
mvn package      # gera target/boletim-api.war (Java 8+)
```

Para adicionar uma consulta: crie o `.sql` em `src/main/resources/sql` (parâmetros como `:safra`),
registre em `QueryRegistry.java` e adicione o descritor em `server/db/queries.js`.
