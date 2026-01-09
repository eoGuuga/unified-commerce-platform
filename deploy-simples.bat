@echo off
echo ============================================
echo DEPLOY SIMPLES PARA SERVIDOR
echo ============================================
echo.

echo 1. Criando novo arquivo tar.gz...
cd /d "%~dp0"
if exist "ucm-deploy.tar.gz" del "ucm-deploy.tar.gz"

echo Compactando arquivos...
tar -czf ucm-deploy.tar.gz --exclude=".git" --exclude="node_modules" --exclude=".next" --exclude="backups" --exclude="*.log" --exclude="*.tar.gz" ./

if exist "ucm-deploy.tar.gz" (
    for %%A in ("ucm-deploy.tar.gz") do echo Arquivo criado: %%~zA bytes
) else (
    echo ERRO: Falha ao criar arquivo tar.gz
    pause
    exit /b 1
)

echo.
echo 2. Enviando para servidor...
scp ucm-deploy.tar.gz ubuntu@37.59.118.210:/home/ubuntu/

if %errorlevel% neq 0 (
    echo ERRO: Falha no upload
    pause
    exit /b 1
)

echo.
echo 3. Extraindo no servidor...
ssh ubuntu@37.59.118.210 "cd /home/ubuntu && tar -xzf ucm-deploy.tar.gz && ls -la | grep unified-commerce-platform"

echo.
echo 4. Limpando arquivo local...
del "ucm-deploy.tar.gz"

echo.
echo ============================================
echo DEPLOY CONCLUIDO!
echo ============================================
echo.
echo Proximos passos no servidor:
echo   cd unified-commerce-platform
echo   ./INICIAR-DEV.ps1
echo.
echo Ambientes:
echo   Frontend DEV: http://37.59.118.210:3003
echo   Backend DEV:  http://37.59.118.210:3002
echo.
pause