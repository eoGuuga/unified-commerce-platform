# Estrutura e Organização do Projeto — 2026

> **Status:** ✅ **100% Organizado**  
> **Data:** 09/01/2026

---

## 📁 Estrutura de Diretórios

```
unified-commerce-platform/
├── README.md                          # README principal
├── COMO-INICIAR-AMBIENTE.md           # Guia rápido
├── TUTORIAL-INSTALACAO-COMPLETA.md    # Tutorial completo
├── ESTRUTURA-PROJETO-ORGANIZADA.md    # Estrutura detalhada
├── ORGANIZACAO-FINAL-2026.md          # Organização final
├── ARQUIVOS-PARA-DEV-INICIANTE.md     # Lista de arquivos permitidos
│
├── backend/                            # API NestJS
│   └── src/
│
├── frontend/                           # Next.js (ÁREA DO DEV INICIANTE)
│   ├── AREA-DEV-INICIANTE/            # Pasta separada com guia
│   ├── CONTRIBUICAO-FRONTEND-INICIANTE.md
│   ├── app/                           # Páginas (pode mexer)
│   └── components/                    # Componentes (pode mexer)
│
├── deploy/                             # Produção (NÃO mexer - dev iniciante)
│   ├── RUNBOOK-OPERACAO.md
│   ├── CHECKLIST-DE-RELEASE.md
│   ├── ONBOARDING-SEGUNDO-DEV.md
│   └── scripts/                       # Scripts de operação
│
├── scripts/                            # Scripts de dev/teste
│   ├── migrations/                    # SQL migrations
│   ├── setup/                         # Setup local
│   └── test/                          # Testes E2E
│
├── config/                             # Docker Compose (dev)
│
└── docs/                               # Documentação completa
    ├── 00-projeto/                     # Visão do projeto
    ├── 01-tecnico/                     # Arquitetura/DB/Security
    ├── 02-implementacao/               # Planos de implementação
    ├── 03-comercial/                   # Material comercial
    ├── 04-status/                      # Status atual
    ├── 05-correcoes/                   # Correções implementadas
    ├── 06-implementacoes/               # Implementações concluídas
    ├── 07-setup/                       # Guias de setup
    ├── 08-testes/                      # Documentação de testes
    ├── 09-proximos-passos/             # Próximos passos
    └── 10-historico/                   # Arquivos históricos
```

---

## 📚 Documentos Essenciais (Hierarquia)

### Nível 1 (Leitura Obrigatória)
1. **`README.md`** (raiz)
2. **`docs/00-projeto/00-DOCUMENTO-MESTRE-LEIA-PRIMEIRO.md`**
3. **`docs/00-projeto/RELATORIO-COMPLETO-DO-PROJETO-2026.md`**

### Nível 2 (Por Perfil)

**Dev Iniciante (Frontend):**
- `frontend/CONTRIBUICAO-FRONTEND-INICIANTE.md`
- `frontend/AREA-DEV-INICIANTE/README.md`
- `docs/07-setup/ARQUIVOS-PARA-DEV-INICIANTE.md`
- `docs/07-setup/COMO-INICIAR-AMBIENTE.md`

**Operação/Produção:**
- `deploy/RUNBOOK-OPERACAO.md`
- `deploy/CHECKLIST-DE-RELEASE.md`
- `deploy/README-PRODUCAO.md`

**Onboarding:**
- `deploy/ONBOARDING-SEGUNDO-DEV.md`

### Nível 3 (Referência)
- `docs/INDICE-DOCUMENTACAO.md`
- `docs/01-tecnico/`
- `docs/02-implementacao/`

---

## 🗂️ Categorias

### ✅ Úteis e Ativos
- `docs/00-projeto/` — Todos úteis
- `docs/01-tecnico/` — Todos úteis
- `docs/02-implementacao/` — Úteis para roadmap
- `docs/03-comercial/` — Úteis
- `docs/04-status/` — Úteis (manter 2–3 principais)
- `docs/05-correcoes/` — Úteis para histórico
- `docs/06-implementacoes/` — Úteis para histórico
- `docs/07-setup/` — Úteis
- `docs/08-testes/` — Úteis (manter 3–5 principais)
- `docs/09-proximos-passos/` — Úteis
- `deploy/` — Todos úteis
- `frontend/CONTRIBUICAO-FRONTEND-INICIANTE.md` — Útil

### 📜 Históricos
- `docs/10-historico/` — Arquivos históricos

---

**Última atualização:** 09/01/2026
