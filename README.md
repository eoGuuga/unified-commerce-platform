# Unified Commerce Platform (UCM)

Plataforma SaaS para vendas omnichannel (WhatsApp + PDV + loja online) com estoque consistente e pagamentos integrados.

## Documentacao oficial
- `docs/CONSOLIDADO/README.md`
- `docs/INDICE-DOCUMENTACAO.md`
- Legado: `docs/LEGADO/README.md`

## Status rapido (2026-02-22)
- Producao: https://gtsofthub.com.br (stack em /opt/ucm)
- DEV/TESTE: https://dev.gtsofthub.com.br (stack em /opt/ucm-test-repo)
- Testes backend (unit/integration/acid) PASS em 2026-02-22 (ver Testes_com_sucesso.txt)
- WhatsApp PIX E2E validado em DEV/TESTE (2026-02-13 e 2026-02-14)
- WhatsApp /whatsapp/test validado em DEV/TESTE (2026-02-22)
- Pendencias: e-commerce completo e dashboard avancado

## Stack
- Backend: NestJS + TypeORM
- Frontend: Next.js
- Banco: Postgres
- Cache: Redis
- Auth: JWT
- Pagamentos: Mercado Pago (PIX, credito, debito, boleto) + mock
- WhatsApp: Twilio ou Evolution API
- IA: OpenAI ou Ollama (opcional)

## Execucao local (dev rapido)
1. Iniciar containers
```
.\INICIAR-AMBIENTE.ps1
```
2. Setup inicial
```
.\setup.ps1
```
3. Rodar backend
```
cd backend
npm run start:dev
```
4. Rodar frontend
```
cd frontend
npm run dev
```
5. Testes
```
.\test-backend.ps1
```

## Estrutura
- backend/
- frontend/
- deploy/
- docs/
- scripts/
- config/

## Observacao
- A documentacao antiga foi movida para `docs/LEGADO`.
- Para detalhes operacionais e tecnicos, use o consolidado.

Ultima atualizacao: 2026-02-22
