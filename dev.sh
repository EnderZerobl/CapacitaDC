#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Iniciando ambiente de desenvolvimento do Capacita DC..."

# 1. Iniciar banco de dados no Docker
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "❌ Erro: docker compose ou docker-compose não está instalado."
    exit 1
fi

echo "📦 Iniciando contêiner do PostgreSQL..."
$DOCKER_COMPOSE up -d database

# 2. Aguardar o banco estar pronto para receber conexões
echo "⏳ Aguardando PostgreSQL iniciar na porta 5432..."
python3 -c "
import socket
import time
start_time = time.time()
while True:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1)
        s.connect(('127.0.0.1', 5432))
        s.close()
        print('✅ PostgreSQL está pronto!')
        break
    except Exception:
        if time.time() - start_time > 30:
            print('❌ Tempo esgotado esperando o PostgreSQL.')
            exit(1)
        time.sleep(1)
"

# 3. Configurar ambiente virtual do Python para o Backend
cd backend
if [ ! -d ".venv" ]; then
    echo "🐍 Criando ambiente virtual Python (.venv)..."
    python3 -m venv .venv
fi

echo "📥 Instalando dependências do backend..."
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

# 4. Criar tabelas e popular dados iniciais (seed)
echo "🌱 Inicializando e populando o banco de dados..."
.venv/bin/python -m app.seed

# 5. Iniciar o servidor Backend (uvicorn)
echo "⚡ Iniciando servidor Backend FastAPI na porta 8000..."
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!
cd ..

# 6. Configurar e iniciar Frontend
echo "📦 Instalando dependências do frontend..."
cd frontend
if command -v pnpm &> /dev/null; then
    pnpm install
    echo "⚡ Iniciando servidor Frontend Next.js na porta 3000..."
    pnpm run dev &
    FRONTEND_PID=$!
else
    npm install
    echo "⚡ Iniciando servidor Frontend Next.js na porta 3000..."
    npm run dev &
    FRONTEND_PID=$!
fi
cd ..

# Função para parar os processos em segundo plano ao sair
cleanup() {
    echo -e "\n🛑 Encerrando servidores backend e frontend..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

# Capturar sinais de saída para executar a limpeza
trap cleanup INT TERM EXIT

# 7. Abrir o navegador automaticamente
echo "🌐 Aguardando Next.js iniciar para abrir o navegador..."
sleep 5
python3 -c "import webbrowser; webbrowser.open('http://localhost:3000')"

echo "✨ Tudo pronto! O sistema foi aberto no seu navegador."
echo "Pressione Ctrl+C para encerrar o ambiente."

# Manter o script rodando para monitorar os logs dos servidores em segundo plano
wait
