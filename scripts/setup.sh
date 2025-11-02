#!/bin/bash

# Script de setup automático do projeto

echo "🚀 Iniciando setup do UCM..."

# Instalar dependências backend
echo "📦 Instalando dependências backend..."
cd backend && npm install && cd ..

# Instalar dependências frontend
echo "📦 Instalando dependências frontend..."
cd frontend && npm install && cd ..

# Criar arquivos .env
echo "⚙️  Criando arquivos .env..."
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

echo "✅ Setup concluído! Execute:"
echo "   Backend:  cd backend && npm run start:dev"
echo "   Frontend: cd frontend && npm run dev"
