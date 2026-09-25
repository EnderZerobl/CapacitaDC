# Testes e verificação

Execute os comandos a partir da raiz do repositório, exceto quando indicado. Os testes de backend usam SQLite temporário. As jornadas de navegador devem ser executadas com o servidor descartável abaixo, nunca com o banco de uma instalação em uso.

## Backend e TypeScript

```bash
backend/.venv/bin/python -m unittest discover -s backend/tests -v
cd frontend
npm ci
npm run typecheck -- --incremental false
npm run build
```

As suítes cobrem autenticação, permissões, criação e contratos das rotas, conteúdo bloqueado, conclusão das etapas, avaliação dos cinco formatos de jogos, tentativas repetidas, publicações, migrações, média ponderada e fila de correção.

`test_managers.py` cobre o gerente por eixo com dados descartáveis para os três eixos: nomeação pelo administrador e eixo obrigatório; gestão do PlugInfo (trainees, rotação, conteúdo e correções do eixo `trainee`) sem promoção de trainees; cada gerente contra os outros dois eixos, por listagem e por ID; requisições manipuladas (promoção, troca de eixo ou cargo, edição de outros gerentes); conteúdo `all`/`trainee` e vínculos cruzados; vínculos antigos compartilhados; correções que exigem membro e atividade do eixo; notas, perfil e ranking contados só no eixo; nomes de eixo antigos equivalentes aos códigos e eixo desconhecido sem acesso; mudança de papel valendo para a sessão aberta; biblioteca com três etapas alcançadas de dez, agendamento, pré-requisito pendente, múltiplos vínculos e trilha não autorizada; e download de documentos por URL direta.

## Preparar testes no navegador

Os scripts usam Playwright. Se ele não estiver instalado, prepare-o apenas no ambiente de testes:

```bash
cd frontend
npm install --no-save --package-lock=false playwright@1.57.0
npx playwright install chromium
```

Alternativamente, `PLAYWRIGHT_PACKAGE` pode apontar para uma instalação de Playwright já disponível, e `PLAYWRIGHT_BROWSERS_PATH` para seus navegadores. Esses caminhos são configuração da máquina, não devem ser versionados.

Abra dois terminais:

```bash
# Terminal 1 — API real, com banco e uploads descartáveis.
backend/.venv/bin/python backend/tests/serve.py --port 8021
```

```bash
# Terminal 2 — frontend com cache independente do servidor habitual.
cd frontend
NEXT_DIST_DIR=.next-qa API_BACKEND_URL=http://127.0.0.1:8021 npm run dev -- --port 3017
```

O servidor de teste cria as contas `admin@example.com`, `organizador@example.com`, `membro@example.com` e `trainee@example.com`, além de um gerente e um membro por eixo (`gerente-vendas@example.com`, `membro-vendas@example.com`, e o mesmo para `conexoes` e `experiencia`), todas com senha `qa-test-password`. Essas contas existem somente no banco descartável; nenhuma conta de gerente é criada em produção. Ao encerrar a API, os dados temporários são removidos.

## Interface e sessão

Só precisa do frontend; as respostas da API são simuladas:

```bash
BASE_URL=http://127.0.0.1:3017 node frontend/tests/stabilization.cjs
```

Verifica sessão expirada, indisponibilidade temporária, preservação de formulários após falha, reenvio de atividades, autoria e vínculo material → atividade → nó, leitura de texto e recursos pelo nó, abertura de conteúdo após desbloquear etapas, atualização ao abrir nós, recuperação de falhas de carregamento, conteúdo ausente e recuperação de senha indisponível.

## Fila de correções e notas

Com os dois servidores preparados:

```bash
BASE_URL=http://127.0.0.1:3017 ADMIN_EMAIL=admin@example.com \
  TRAINEE_EMAIL=trainee@example.com PASSWORD=qa-test-password \
  node frontend/tests/corrections_journey.cjs
```

Cria entregas na API de teste e usa o navegador para lançar notas, consultar a média ponderada e filtrar pendentes/corrigidas. Verifica a atualização da média sem lançamento manual no perfil.

## Biblioteca e trilhas

Reinicie a API de teste para começar com um banco limpo, pois a trilha sequencial pode bloquear etapas novas após dados deixados por outra execução:

```bash
BASE_URL=http://127.0.0.1:3017 ADMIN_EMAIL=admin@example.com \
  TRAINEE_EMAIL=trainee@example.com PASSWORD=qa-test-password \
  node frontend/tests/games_journey.cjs
```

Percorre autoria, pré-visualização, publicação, vínculo com a trilha, liberação, jogo e atualização do progresso.

## Entregas com anexos

Com uma API descartável nova e o frontend conectado a ela:

```bash
BASE_URL=http://127.0.0.1:3017 node frontend/tests/submission_attachments_journey.cjs
```

Verifica PDF e CSV via multipart, limites de quantidade/tamanho/formato, campos de links e comentários, preservação após falha, conclusão da etapa, reenvio que invalida a nota, download autenticado e exibição na correção. A suíte `test_submission_attachments.py` cobre também propriedade dos anexos, atividade bloqueada/fechada e migração de entregas antigas.

## Gerente por eixo

Com uma API descartável nova (a trilha é sequencial) e o frontend conectado a ela:

```bash
BASE_URL=http://127.0.0.1:3017 PASSWORD=qa-test-password node frontend/tests/manager_journey.cjs
```

O administrador nomeia um gerente pela interface (o eixo é obrigatório); o gerente de Conexões vê o painel identificado, os membros e materiais do eixo e os trainees, cria um material com eixo travado e link clicável na pré-visualização e um material do PlugInfo, e tem recusadas pela API as tentativas de alterar Vendas, promover membros ou criar gerentes. Um membro vê na biblioteca só os materiais alcançados, com links clicáveis. Por fim, o administrador troca o eixo do gerente com a sessão aberta e o painel passa a refletir o novo eixo.

## Upload e proxy

`backend/tests/live_smoke.py` verifica a API através do proxy Next.js, incluindo upload multipart e leitura do arquivo. O upload grava num Vercel Blob privado de verdade, então o processo da API também precisa de `BLOB_READ_WRITE_TOKEN` no ambiente. Ele recebe o caminho SQLite que o servidor de teste imprime:

```bash
backend/.venv/bin/python backend/tests/live_smoke.py /tmp/caminho-impresso/database.db http://127.0.0.1:3017
```

Use uma execução nova do servidor descartável para esse roteiro. Ele altera apenas contas do banco de teste para preparar os perfis necessários.

## Limites da validação

SQLite verifica regras e migrações sem depender do PostgreSQL. Isso não substitui validar a atualização de uma cópia do banco PostgreSQL antes de produção. Testes com API simulada verificam a interface; as jornadas reais e o teste do proxy verificam a integração.

Não publique relatórios temporários, bancos, capturas de tela, caches de navegador ou planos pessoais junto com o código.
