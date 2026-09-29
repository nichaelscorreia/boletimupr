# Boletim Online de Moagem — projetos por usina

Cada usina tem o seu projeto completo e independente numa subpasta:

| Pasta | Usina | Situação |
|---|---|---|
| [`UPR/`](UPR/) | Usina Porto Rico | Em produção |
| [`Impacto/`](Impacto/) | Usina Impacto | Empresa (2/1/1) e safra 16 configuradas; aguardando implantação da API |
| [`Taquari/`](Taquari/) | Usina Taquari | Empresa (1/1/1) e safra 19 configuradas; aguardando implantação da API |

Filtro de empresa usado nos SQLs de cada usina (`cod_grupoempresa / cod_empresa / cod_filial`):
UPR `1/20/1`, Impacto `2/1/1`, Taquari `1/1/1`.

Cada pasta contém as duas partes do sistema:

- **App Node** (`server/`, `public/`, `package.json`) — publicado no Render (um serviço por usina,
  configurado no [`render.yaml`](render.yaml) com `rootDir` apontando para a pasta).
- **Boletim API** (`tomcat-api/`) — WAR que roda no Tomcat da usina e acessa o Oracle dela.
  Veja o `tomcat-api/README.md` de cada pasta para implantação.

Correções feitas numa usina **não** passam automaticamente para as outras: as pastas são independentes.

## Segredos (nunca vão para o git)

Em cada pasta, ficam só na máquina/servidor:

- `.env` — URL e segredo da Boletim API, código de liberação de acesso;
- `tomcat-api/deploy/` — `boletim-api.xml` (usuário/senha do Oracle e `API_SECRET`) e o WAR gerado.

Cada usina deve ter o **seu próprio** `API_SECRET` e `ACESSO_CODIGO_LIBERACAO`.

## O que personalizar numa usina nova

Valores que hoje estão com os dados da Porto Rico e precisam ser revistos:

**Conexão e safra**
- Oracle da usina (host, porta, serviço, usuário, senha) e endereço do Tomcat onde a API vai rodar;
- Código da safra atual (`54` na UPR) e data de início (`10/09/2026` na UPR).

**Filtros das consultas** (`tomcat-api/src/main/resources/sql/`)
- Grupo/empresa/filial: `cod_grupoempresa = 1`, `cod_empresa = 20`, `cod_filial = 1` (usados em quase todos os SQLs);
- Grupos de cana dos cards de planejamento: Própria (`4093`), Triunfo (`6053`), Sinimbú (`6118`),
  Acionistas (`8682, 15088, 8482, 1534, 1558` ou tipo de fazenda `2`) — ver `agricola_planejamentoColheita.sql`
  e os nomes em `server/services/planejamentoColheita.js`;
- Tipos de fazenda próprias no resumo mensal: `1, 3, 4, 6, 8, 10`;
- Moendas (objetos do laboratório): Moenda A = `3`, Moenda B = `355`; causa ignorada `69` (Início de Safra);
- Objetos de produção: cana moída `2`, açúcar `23`, hidratado `47`, anidro `53`, equivalente `90`,
  vácuos de açúcar `278, 279, 366`;
- Produtos do faturamento: açúcar `3`, anidro `3, 150`, hidratado `4, 151`;
- Relatório do boletim diário: `21`;
- Tipos de cana mecanizada: `3, 4`;
- Nome do proprietário da frota própria: `INDUSTRIAL PORTO RICO S/A` (`frota_transportePorProprietario.sql`).

**Telas**
- Data de fim da entressafra da Moenda A (`server/services/moendas.js`);
- Quantidade/nomes das moendas, grupos de cana e KPIs exibidos.

**Controle de acesso**
- Criar a tabela `NST_DISPOSITIVO_ACESSO` no Oracle da usina (`tomcat-api/ddl/nst_dispositivo_acesso.sql`).
  Se duas usinas usarem o **mesmo** Oracle/usuário, elas compartilhariam essa tabela (um dispositivo liberado
  numa seria liberado na outra) — nesse caso, cada usina precisa de uma tabela própria.
