# Capacita DC

Plataforma de capacitação comercial da InfoJr, com materiais, trilhas, jogos, entregas de atividades e correção de notas.

O frontend usa Next.js/React/TypeScript. A API usa FastAPI, SQLAlchemy e autenticação JWT. O banco de desenvolvimento é PostgreSQL; os testes usam SQLite descartável.

## Documentação

- [Funcionamento do sistema, permissões, notas e jogos](docs/SISTEMA.md)
- [Como executar os testes](docs/TESTES.md)

## Executar localmente

Pré-requisitos: Python 3.12, Node.js compatível com o Next.js instalado, npm e Docker Compose para o PostgreSQL. O gerenciador de pacotes do frontend é **npm**; execute seus comandos dentro de `frontend/`.

1. Suba o banco:

   ```bash
   docker compose up -d database
   ```

2. Prepare a API:

   ```bash
   python3 -m venv backend/.venv
   backend/.venv/bin/pip install -r backend/requirements.txt
   cp backend/.env.example backend/.env
   ```

   Edite `backend/.env` e defina `JWT_SECRET_KEY`. Gere uma chave com:

   ```bash
   python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
   ```

3. Inicie a API. As migrações são aplicadas na inicialização:

   ```bash
   backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
   ```

4. Em outro terminal, crie o administrador de desenvolvimento:

   ```bash
   cd backend
   .venv/bin/python -m app.seed
   ```

   O seed atual cria `admin@infojr.com.br` com senha `admin123` se essa conta não existir. Essas credenciais são apenas para desenvolvimento; altere-as antes de disponibilizar o sistema. O cadastro público sempre cria um trainee.

5. Inicie o frontend:

   ```bash
   cd frontend
   npm ci
   npm run dev
   ```

Abra `http://localhost:3000`. A documentação interativa da API fica em `http://127.0.0.1:8000/docs`.

Com o `.env` configurado, `./dev.sh` automatiza o banco, as dependências, o seed e os servidores locais.
Ele aguarda a API e a página de login responderem antes de solicitar a abertura do navegador padrão. Se o terminal não conseguir abrir uma janela, o endereço aparece nos logs para acesso manual. Para usar outra porta no frontend, execute `PORT=3017 ./dev.sh`; a porta escolhida precisa estar livre.

## Configuração

| Variável | Local | Função |
| --- | --- | --- |
| `DATABASE_URL` | API / `backend/.env` | Conexão PostgreSQL; SQLite também é usado nos testes. |
| `JWT_SECRET_KEY` | API / `backend/.env` | Chave de assinatura das sessões. |
| `JWT_ALGORITHM` | API | Padrão `HS256`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | API | Padrão 1440 minutos. |
| `API_BACKEND_URL` | Servidor Next.js | Endereço da API; padrão `http://127.0.0.1:8000`. |
| `NEXT_DIST_DIR` | Servidor Next.js, opcional | Cache de compilação separado para testes; padrão `.next`. |

O navegador chama caminhos relativos `/api/...` e `/uploads/...`. O Next.js encaminha essas requisições para `API_BACKEND_URL`. Essa variável é lida na configuração do servidor, não é uma variável `NEXT_PUBLIC_`; ao alterá-la em hospedagem, gere um novo build/deploy.

## Build e hospedagem

```bash
cd frontend
npm ci
npm run typecheck
npm run build
npm run start
```

Para hospedar o frontend, configure o diretório raiz como `frontend`, use o preset Next.js e informe `API_BACKEND_URL` apontando para a API acessível pelo servidor da hospedagem. A API Python e o PostgreSQL precisam de execução própria. Os materiais públicos ficam em `backend/uploads/` e os anexos privados de entregas em `backend/submission_uploads/`. Ambas as pastas exigem armazenamento persistente no host da API.

Antes de atualizar um banco existente, faça backup e confira as migrações descritas na documentação. O seed de desenvolvimento não deve ser executado automaticamente em produção.

O repositório mantém código, testes, o lockfile do npm e documentação do sistema. Arquivos `.env`, uploads, bancos locais, caches de build e planos pessoais não devem ser enviados ao GitHub.
