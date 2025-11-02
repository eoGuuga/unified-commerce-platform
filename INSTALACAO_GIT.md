# Instalacao do Git no Windows

## Passo 1: Instalar Git

1. Acesse: https://git-scm.com/download/win
2. Baixe a versao mais recente para Windows
3. Execute o instalador
4. Use as configuracoes padrao (Next, Next, Install)
5. Marque "Launch Git Bash" na conclusao (opcional)
6. Reinicie o terminal

## Passo 2: Verificar Instalacao

Abra um novo terminal PowerShell e execute:

```
git --version
```

Deve mostrar algo como: git version 2.42.0

## Passo 3: Configurar Git

Execute estes comandos (substitua pelos seus dados):

```
git config --global user.name "Seu Nome"
git config --global user.email "seu.email@exemplo.com"
```

## Passo 4: Voltar para o Projeto

Apos instalar o Git, volte para o terminal do projeto e execute:

```
cd "C:\Users\gusta\Desktop\Nova pasta"
```

Depois execute o comando para inicializar o repositorio.
