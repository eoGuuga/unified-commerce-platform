# Instalacao do Node.js

## Situacao Atual

O Node.js nao esta instalado no seu sistema. Ele e necessario para rodar o backend e frontend da plataforma UCM.

## Opcao 1: Instalacao Automatica (Windows - Winget)

Execute no PowerShell (como Administrador):

```powershell
winget install OpenJS.NodeJS.LTS
```

Depois de instalar, **feche e abra novamente o PowerShell** para que as variaveis de ambiente sejam atualizadas.

## Opcao 2: Instalacao Manual

1. Acesse: https://nodejs.org/
2. Baixe a versao LTS (Long Term Support)
3. Execute o instalador
4. Siga as instrucoes (Next, Next, Install)
5. **Feche e abra novamente o PowerShell**

## Verificacao

Apos instalar, execute:

```powershell
node --version
npm --version
```

Voce deve ver algo como:
- node: v20.x.x
- npm: 10.x.x

## Apos Instalar

Depois de instalar o Node.js, rode novamente:

```powershell
.\setup.ps1
```

O script agora vai instalar automaticamente todas as dependencias do backend e frontend.

