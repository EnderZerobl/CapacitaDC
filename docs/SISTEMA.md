# Funcionamento do Capacita DC

## Papéis e públicos

| Papel | Responsabilidade |
| --- | --- |
| Administrador | Cadastra e gerencia pessoas, materiais, atividades, jogos e trilhas; consulta e corrige entregas de membros e trainees. |
| Organizador do PlugInfo | Cadastra e gerencia trainees e seu conteúdo; acompanha entregas e corrige atividades desse público. Não entrega atividades nem acumula progresso de participante. |
| Gerente | Vinculado a um único eixo comercial. Gerencia os membros, materiais, atividades, jogos e a trilha desse eixo e corrige as entregas dos seus membros. Também faz tudo o que o organizador do PlugInfo faz: trainees e conteúdo do eixo `trainee`. Não entrega atividades nem acumula progresso de participante. |
| Membro | Consome conteúdo comercial, joga, entrega atividades e acompanha seus resultados. |
| Trainee | Consome conteúdo para trainees, joga, entrega atividades e acompanha seus resultados. |

**PlugInfo é o nome da organização/papel, não um eixo de conteúdo.** Os eixos comerciais são Vendas, Conexões e Experiência do Consumidor. `trainee` identifica o público da capacitação inicial; `all` é o alcance compartilhado de um conteúdo, não outro eixo comercial. O organizador gerencia conteúdo de trainees; conteúdo compartilhado `all` é administrado pelo administrador.

A API verifica permissões também nas operações por ID. Ocultar botões na interface não é a única proteção. Contas administrativas usam a pré-visualização dos jogos, que não gera pontos.

### Gerentes por eixo

Somente o administrador nomeia gerentes, troca seu eixo ou os remove do cargo; o eixo é obrigatório e deve ser `vendas`, `conexoes` ou `experiencia`. Pode haver mais de um gerente no mesmo eixo. Papel e eixo são lidos do banco a cada requisição, então uma mudança feita pelo administrador vale também para sessões já abertas. Um gerente com eixo ausente ou desconhecido não tem acesso de gestão.

| Operação | Próprio eixo | PlugInfo (`trainee`) | Outros eixos e `all` |
| --- | --- | --- | --- |
| Listar, consultar, cadastrar, editar (inclusive senha) e excluir pessoas | Sim, membros do eixo | Sim, trainees (inclusive rotação) | Não |
| Promover, mudar perfil, cargo ou eixo de alguém | Não | Não (trainee continua trainee) | Não |
| Nomear ou editar gerentes, administradores e organizadores | Não | Não | Não |
| Materiais, documentos e vídeos | Sim, tipo membro | Sim, tipo trainee | Não |
| Etapas, ordem, liberação e agendamento da trilha | Sim | Sim | Não |
| Atividades e jogos | Sim | Sim | Não; conteúdo `all` fica visível, como para o organizador, mas não é editável |
| Consultar e corrigir entregas, baixar anexos | Sim, de membros do eixo em atividades do eixo | Sim, de trainees | Não |
| Notas, progresso, perfil e ranking | Membros contados só na trilha do eixo | Trainees como o organizador os vê | Não |

Os vínculos também são conferidos: não é possível ligar material, atividade, jogo ou pré-requisito de outro eixo, nem mover um recurso para fora do escopo do gerente (o eixo dele e o PlugInfo). Um gerente sem eixo válido perde também o acesso ao PlugInfo. Como membros enxergam as trilhas dos três eixos, uma atividade pode ter entregas de membros de outro eixo; nesse caso excluí-la ou mudar seu peso (o que alteraria notas de outras pessoas) fica com o administrador. O mesmo vale para conteúdos antigos compartilhados com a trilha de outro eixo.

Usuários antigos podem ter o eixo gravado pelo nome de exibição ("Vendas", "Conexões", "Experiência do Consumidor"). Esses nomes exatos produzem a mesma autorização que os códigos; valores desconhecidos negam o acesso em vez de serem adivinhados. Novas gravações usam o código, e a interface exibe o nome completo.

## Caminhos principais

- `/login` e `/cadastro`: autenticação e cadastro público de trainee.
- `/`: painel de administração, com pessoas, materiais, atividades, **Correções**, notas e trilhas. Para o gerente, o painel se identifica como **Gerente — <eixo>** e mostra apenas o seu escopo: o eixo e o PlugInfo.
- `/jogos`: biblioteca e autoria de jogos, acessível a administradores, organizadores e gerentes (estes, no próprio eixo e no PlugInfo).
- `/membros` e `/trainees`: consumo de conteúdo, trilhas e entregas.
- `/perfil/[id]`: consulta administrativa do progresso, entregas e média calculada. A média não é editada nesse perfil.
- `/recuperar-senha`: informa que a recuperação automática está indisponível e orienta procurar a administração; não simula envio de email.

## Atividades, entregas e correções

### Preparar a atividade

Na aba **Atividades**, cadastre título, descrição, público, exigência de arquivo/link, prazo opcional, material de apoio opcional e peso.

- Peso maior dá maior participação na média.
- **Peso 0 significa que a atividade não vale nota na média.** Ela ainda pode receber correção e feedback.
- Peso omitido usa 1. Pesos novos negativos ou não numéricos são rejeitados.
- Arquivo exigido: a entrega precisa incluir uma URL. Atividade sem arquivo exigido aceita um comentário; entregas completamente vazias são rejeitadas.

Atividades podem ser associadas a etapas da trilha. Uma entrega válida conclui a etapa correspondente no servidor; essa conclusão não depende de já existir uma nota e não atribui a bonificação dos jogos. A chamada de entrega informa o ID da etapa quando ocorre pela trilha.

### Corrigir uma entrega

1. Entre no painel administrativo e abra **Correções**.
2. Filtre por pendentes/corrigidas, tipo de participante, eixo ou atividade. A fila tem paginação.
3. Consulte a pessoa, a atividade, o peso, a data, o comentário e o link enviado. O link abre em outra aba.
4. Digite a **nota de 0 a 10**, acrescente feedback e salve. Uma nota zero é válida.
5. A média da pessoa é recalculada e a planilha de notas atualiza. No filtro de pendentes, a entrega corrigida sai da fila.

A mesma correção também pode ser feita na lista de envios dentro de uma atividade. O administrador acompanha membros e trainees; o organizador só recebe na fila os envios de trainees em atividades que pode gerenciar; o gerente, os envios de membros do próprio eixo em atividades desse eixo — estar numa atividade do eixo não basta — e os de trainees, como o organizador.

Ao reenviar conteúdo diferente, a correção anterior é retirada, a entrega volta a pendente e a média é recalculada. Repetir a mesma entrega não duplica seu registro nem remove uma correção sem mudança no conteúdo.

### Cálculo da nota da rotação

A nota é a média ponderada **das entregas já corrigidas** que possuem peso positivo:

```text
média = soma(nota da entrega × peso da atividade) / soma(dos pesos considerados)
```

Exemplo de cálculo: nota 10 com peso 2 e nota 4 com peso 1 resultam em `(10×2 + 4×1) / 3 = 8,00`.

Entregas pendentes e atividades com peso zero não reduzem a média. Sem notas corrigidas com peso positivo, a média fica ausente (`null`), não zero. O resultado é arredondado para duas casas decimais. Essa regra vale para membros e trainees.

O backend recalcula quando uma nota é salva, quando um reenvio retira a nota anterior, quando o peso muda e quando uma atividade é excluída. `users.nota_rotacao` é um cache calculado para manter compatibilidade com as respostas da API, e não um campo de lançamento manual. A rotação/ciclo do trainee (`rotacao`) continua sendo um dado administrativo separado.

Pontuação de jogos/ranking e nota de atividades são medidas diferentes. Os pontos dos jogos não entram na média de rotação.

## Trilhas e acesso ao conteúdo

O fluxo de autoria de conteúdo é **material → atividade → nó**: crie o material na biblioteca, selecione-o na atividade e vincule a atividade ao nó. Materiais também podem existir apenas na biblioteca, sem atividade ou nó. A criação de nós oferece atividade ou versão publicada de jogo; nós antigos de leitura continuam compatíveis. No gerenciamento da trilha é possível vincular ou trocar a atividade de um nó existente. Ao abrir a etapa, `GET /api/nodes/{id}/content` retorna sua atividade, o material dessa atividade (texto, documentos e vídeos) e a entrega do participante, depois de verificar as permissões e o desbloqueio. O leitor não depende da lista de materiais já carregada no navegador. A trilha é sequencial por eixo: a etapa anterior na ordem é o pré-requisito implícito. Quando existe um pré-requisito explícito, ele prevalece. As conexões visuais seguem a regra usada pela API.

O administrador pode liberar etapas imediatamente ou agendar a liberação. Participantes só abrem etapas liberadas e com pré-requisitos concluídos.

A biblioteca do participante mostra apenas materiais de etapas que ele já **alcançou**: a etapa pertence a uma trilha que ele pode ver, está liberada, o agendamento já passou e o pré-requisito efetivo foi concluído. Alcançar não é concluir: com as etapas 1 e 2 concluídas e a 3 aberta, os materiais das três aparecem. O vínculo é o mesmo usado na leitura da etapa (o material da atividade, ou a referência direta de etapas antigas de leitura); basta uma etapa alcançada para um material com vários vínculos, e ele aparece uma vez. Materiais sem etapa, ou ligados apenas a atividades fora da trilha, ficam restritos à autoria no painel. Bloquear de novo uma etapa ou remover o vínculo recalcula o acesso na consulta seguinte. Atividades fora da trilha continuam visíveis como antes.

URLs `http://` e `https://` no texto de um material viram links clicáveis na pré-visualização do editor, na biblioteca e na leitura pela trilha, inclusive em materiais já existentes. Os links abrem em nova aba; o texto nunca é interpretado como HTML e outros protocolos não viram link. Os vídeos cadastrados também são links clicáveis.

Reordenar muda a sequência implícita. Excluir ou alterar conteúdos já usados pode afetar acesso e progresso; confira os vínculos antes de fazê-lo. Conteúdo já concluído pode continuar sendo consultado conforme as regras de visibilidade.

## Anexos nas entregas

O formulário apresenta **anexos → links → comentários**. Cada entrega aceita até 5 anexos, com até 20 MB por arquivo, até 10 links HTTP/HTTPS e um comentário de até 5.000 caracteres. Os formatos aceitos são PDF, DOC/DOCX/ODT, XLS/XLSX/ODS, PPT/PPTX/ODP, PNG/JPG/JPEG/GIF/WEBP, TXT, CSV e ZIP. Se a atividade exige arquivo, um link não substitui o anexo obrigatório.

Os participantes enviam arquivos por `POST /api/activities/{id}/attachments` e informam seus IDs ao entregar a atividade. A API verifica o autor, a atividade, a liberação da etapa e os limites. Os anexos ficam num Vercel Blob privado (não em disco local, incompatível com o compute stateless da Vercel), e são baixados por uma rota autenticada pelo autor ou pelos gestores autorizados após a entrega. Eles aparecem na entrega, na fila de correções e no perfil. Alterar anexos, links ou comentário invalida a correção anterior, como já ocorria ao alterar a resposta.

A migração 5 adiciona a lista de links e a tabela de anexos, preservando links e notas das entregas antigas. A pasta privada de anexos também precisa de armazenamento persistente e backup.

## Documentos dos materiais

Documentos enviados por `POST /api/upload` ficam no mesmo Blob privado e são registrados com quem os enviou (e o eixo, no caso de gerentes) na tabela `material_uploads`. `GET /api/uploads/{pathname}` só entrega o arquivo por meio do material que o lista: o participante precisa ter alcançado uma etapa desse material, e a equipe precisa ter o material no próprio escopo. Antes de ser vinculado, o arquivo só é aberto por quem o enviou, por outro gerente do mesmo eixo ou pelo administrador. Arquivos antigos, sem registro de envio, são autorizados pelos documentos já cadastrados; arquivos sem associação verificável são negados. Ao salvar um material, documentos internos precisam ter sido enviados pela pessoa ou pertencer a um material do seu escopo, inclusive quando informados por URL absoluta. Links externos de documentos e vídeos abrem diretamente, sem o token da sessão, e não são controlados pelo aplicativo.

## Jogos disponíveis

O autor cria rascunhos vazios e fornece o conteúdo. A plataforma não gera atividades comerciais específicas automaticamente.

| Formato | Como funciona |
| --- | --- |
| Questionário | Perguntas de escolha única ou múltipla, pesos e explicações. A seleção múltipla exige o conjunto correto de alternativas. |
| Cenário situacional | Contexto e decisões que conduzem a outros passos ou encerram o caminho. Cada decisão tem pontos e feedback; ciclos e passos inalcançáveis são rejeitados na publicação. |
| Associação | Relacionar itens de duas listas, com possibilidade de alternativas distratoras. |
| Ordenação | Colocar cartões na sequência correta. |
| Classificação | Distribuir itens entre categorias definidas pelo autor. |

Fluxo de autoria: **criar → salvar rascunho → pré-visualizar → publicar → selecionar a versão na etapa da trilha**. A pré-visualização não grava resultados de participantes.

Publicações são versões imutáveis. Editar um rascunho e publicar outra versão não substitui silenciosamente a versão de etapas existentes. É possível duplicar um jogo para adaptar seu conteúdo. O eixo de um jogo já publicado é preservado; use uma cópia para outro público.

O servidor recebe respostas/decisões e calcula o resultado. Não aceita uma pontuação arbitrária calculada no navegador nem entrega o gabarito antes da avaliação. Os formatos da biblioteca são normalizados para até 100 pontos por etapa; vale o melhor resultado e só a melhora acrescenta pontos ao ranking. Repetir uma requisição de conclusão não pontua novamente.

Cenários salvam as decisões no servidor. Os demais formatos mantêm as escolhas em andamento no navegador para retomada da tentativa; a avaliação é enviada ao concluir. Essa retomada local depende do mesmo navegador. Quizzes antigos continuam funcionando pelo fluxo legado de respostas avaliadas no servidor, com os pesos originais.

### Outros formatos possíveis, ainda não implementados

| Ideia | Aproveitamento e uso genérico |
| --- | --- |
| Verdadeiro ou falso com justificativa | Variação do questionário para revisar conceitos. |
| Preencher lacunas | Completar frases/termos, com regras de tolerância a acentos e maiúsculas. |
| Identificação de erros | Marcar problemas em um texto ou fluxo de atendimento. |
| Priorização com acerto parcial | Evoluir a ordenação para comparar prioridades, sem exigir uma única sequência rígida. |
| Jogo da memória | Outra interface para associação de conceitos. |
| Simulação de tempo e orçamento | Distribuir recursos e analisar consequências de decisões comerciais. Exige novo motor de avaliação. |
| Flashcards | Revisão e autoavaliação, em modo de prática separado do ranking avaliado. |
| Grau de confiança | Combinar respostas com a confiança declarada para identificar lacunas de conhecimento. |
| Imagem interativa | Identificar regiões ou elementos em diagramas/imagens; exige editor de regiões. |

Diálogos com ramificações já podem ser representados pelo cenário; uma versão com estado, recursos ou negociação dinâmica seria uma evolução desse formato. Cronômetro, embaralhamento, limite de tentativas e medalhas são recursos compartilhados, não tipos de jogo.

## Arquitetura e contratos

- `frontend/app/`: páginas e composição dos fluxos.
- `frontend/features/`: tipos, chamadas de API e hooks de cada recurso.
- `frontend/components/`: formulários, fila de correções, trilhas e jogos.
- `backend/app/api/`: rotas HTTP.
- `backend/app/services/roles.py`: papéis e normalização dos eixos de membros.
- `backend/app/services/access.py`: escopo de acesso, gestão de pessoas, vínculos entre eixos e pré-requisitos.
- `backend/app/services/node_service.py`: trilha, desbloqueio e conteúdos alcançados pelo participante.
- `backend/app/services/material_files.py`: autorização dos documentos dos materiais.
- `backend/app/services/activity_service.py`: média ponderada e serialização de entregas.
- `backend/app/services/game_service.py`: publicações, tentativas e avaliação.
- `backend/app/models.py`, `schemas.py` e `game_schemas.py`: persistência e validação.
- `backend/app/migrations.py`: evolução versionada do banco.

Rotas principais (consulte `/docs` na API para o contrato completo):

| Recurso | Rotas |
| --- | --- |
| Sessão | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me` |
| Pessoas | `GET/POST /api/users`, `PUT/DELETE /api/users/{id}`, `GET /api/users/{id}/profile` |
| Materiais | `GET/POST /api/materials`, `PUT/DELETE /api/materials/{id}` |
| Atividades | `GET/POST /api/activities`, `PATCH/DELETE /api/activities/{id}` |
| Entregas | `POST /api/activities/{id}/submit`, `GET /api/activities/{id}/submissions` |
| Correção | `PATCH /api/activities/{id}/submissions/{submission_id}` |
| Fila | `GET /api/submissions`, com filtros de situação, pessoa, tipo, eixo, atividade e paginação |
| Notas e ranking | `GET /api/grades`, `GET /api/leaderboard` |
| Trilhas | `GET/POST /api/nodes`, liberação, ordenação, conclusão e exclusão por ID |
| Conteúdo da etapa | `GET /api/nodes/{id}/content`, `PATCH /api/nodes/{id}/activity` |
| Jogos | `GET/POST /api/games`, edição, duplicação, publicação e versões por ID |
| Tentativas | `POST /api/nodes/{id}/attempts`, leitura e respostas/conclusão em `/api/game-attempts/{id}` |
| Arquivos | `POST /api/upload`, leitura autorizada pelo material em `GET /api/uploads/{pathname}` |

As coleções aceitam as formas de URL utilizadas no frontend sem redirecionar a autenticação. As sessões novas usam ID de usuário estável no token. Respostas 401 significam sessão inválida, 403 falta de permissão, 422 erro de validação e 5xx falha do servidor. Erro temporário de `/auth/me` não apaga a sessão. A interface mostra o motivo de uma recusa 403 e confere a sessão de novo (também ao voltar para a aba); se papel ou eixo mudaram, o painel se recria sem manter dados do escopo anterior.

## Migrações e manutenção

As migrações rodam na inicialização da API e registram versões em `schema_migrations`:

1. Tabelas da biblioteca/tentativas e referência à versão de jogo nos nós; quizzes legados são preservados.
2. Unicidade do progresso por pessoa/etapa; registros duplicados antigos são consolidados preservando melhor resultado e conclusão, sem recalcular os pontos históricos.
3. Conversão do antigo conteúdo `pluginfo` para `trainee`. Etapas convertidas são colocadas após as existentes e bloqueadas; o papel organizador é preservado.
4. Garantia da coluna de peso, backup das notas manuais antigas em `nota_rotacao_backup_v4` e recálculo das médias pelas entregas corrigidas.
5. Lista de links e tabela de anexos das entregas.

O papel de gerente reaproveita as colunas `users.type` e `users.eixo` e não exige migração de dados: nomes de eixo antigos são normalizados na leitura e convertidos para o código na próxima gravação. A tabela `material_uploads` é criada na inicialização como as demais tabelas novas.

Antes de atualizar uma instalação, faça backup do PostgreSQL; os uploads vivem num Vercel Blob privado, fora do banco. Bancos, senhas, tokens e caches não pertencem ao Git. Os testes automatizados exercitam as migrações em SQLite; a migração do ambiente PostgreSQL deve ser validada em uma cópia antes de aplicar em produção.

A recuperação automática de senha ainda não está implementada. A plataforma não envia emails de recuperação. A configuração de hospedagem e os comandos de desenvolvimento ficam no [README](../README.md); os procedimentos de verificação estão em [TESTES.md](TESTES.md).
