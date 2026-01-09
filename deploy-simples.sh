#!/bin/bash

echo "🚀 DEPLOY SIMPLES - EXTRAÇÃO DIRETA"
echo "==================================="
echo ""

# Verificar se arquivo existe
if [ ! -f "ucm.tar.gz" ]; then
    echo "❌ ERRO: Arquivo ucm.tar.gz não encontrado!"
    echo "   Verifique se o arquivo foi enviado para o servidor."
    exit 1
fi

echo "📦 Arquivo encontrado:"
ls -lh ucm.tar.gz
echo ""

# Remover pasta antiga se existir
if [ -d "unified-commerce-platform" ]; then
    echo "🧹 Removendo pasta antiga..."
    rm -rf unified-commerce-platform
fi

# Extrair arquivo
echo "📤 Extraindo arquivo..."
tar -xzf ucm.tar.gz

# Verificar se foi extraído
if [ -d "unified-commerce-platform" ]; then
    echo ""
    echo "✅ EXTRAÇÃO BEM SUCEDIDA!"
    echo "=========================="
    echo ""
    echo "📂 Pasta criada:"
    ls -ld unified-commerce-platform
    echo ""
    echo "📋 Scripts disponíveis:"
    ls -la unified-commerce-platform/*.ps1 2>/dev/null || echo "Nenhum script .ps1 encontrado"
    echo ""
    echo "🚀 PARA INICIAR:"
    echo "cd unified-commerce-platform"
    echo "./INICIAR-DEV.ps1"
    echo ""
    echo "🎯 Ambiente pronto para desenvolvimento!"
else
    echo ""
    echo "❌ EXTRAÇÃO FALHOU!"
    echo "==================="
    echo ""
    echo "Verifique o arquivo ucm.tar.gz"
    exit 1
fi