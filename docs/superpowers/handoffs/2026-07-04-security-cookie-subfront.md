# Sub-frente de segurança — JWT: `localStorage` → httpOnly cookie (NÃO iniciada)

**Status:** registrada, **não iniciada**. É a mais **delicada** da frente de auth — mexe em COMO o token é armazenado e enviado, exige proteção CSRF, e pode quebrar o login inteiro. Atacar só com **investigação dedicada + cuidado extra** (spec própria), porque o custo de quebrar auth é alto.

## O problema
O JWT vive em `localStorage['token']` no frontend ([useAuth.ts:121](../../frontend/hooks/useAuth.ts), [api-client.ts:167-188](../../frontend/lib/api-client.ts)) e é enviado como `Authorization: Bearer`. `localStorage` é legível por qualquer JS na página → **um XSS exfiltra o token**. Mover pra **httpOnly cookie** tira o token do alcance do JS (imune a roubo por XSS).

## Por que é delicada (as sutilezas que travam um conserto ingênuo)
1. **Cookie httpOnly é ambiente (enviado automático) → CSRF passa a existir.** Hoje CSRF é *moot* porque o token vai no header (não em cookie). Com cookie, **é obrigatório implementar CSRF**: o backend tem `CsrfGuard` + `GET /csrf`, mas o **frontend não manda nada** (sem `x-csrf-token`, e nem envia cookies — sem `credentials:'include'`). Migrar sem CSRF = trocar XSS por CSRF.
2. **Quebra a extração client-side do `tenant_id`.** Hoje o front **decodifica o JWT no cliente** pra pegar `tenant_id` ([useAuth.ts:123-130](../../frontend/hooks/useAuth.ts)) e reenvia como `x-tenant-id` em cada request. Com httpOnly, o JS **não consegue mais** decodificar o token → precisa de outro canal (cookie legível separado só com o tenant, ou um `/me` que devolve o tenant).
3. **Reescreve o transporte de auth dos DOIS apps:** backend (login faz `Set-Cookie` em vez de devolver o token no body; a `JwtStrategy` passa a extrair do cookie; logout limpa o cookie) + frontend (tira o storage, liga `credentials:'include'`, liga CSRF, refaz o fluxo do `x-tenant-id`). Muitos pontos de falha.

## O que já mitiga o risco (por isso dá pra adiar com tranquilidade)
- **CSP conservador já deployado** (Bloco 1 de segurança) — reduz a superfície de XSS que tornaria o roubo do `localStorage` explorável.
- **Revogação de token no logout** (Bloco A, 2026-07-04) — um token roubado do `localStorage` agora é **matável** (denylist por jti); antes não era.
- **TTL de 15min** no access token — limita a janela de um token roubado.
- React escapa por padrão — sem `dangerouslySetInnerHTML`/script de terceiro hostil, o XSS não é trivial.

Ou seja: o pior do `localStorage` (token roubado e imortal) já foi abrandado. A migração pra cookie é **defesa-em-profundidade**, não um buraco aberto sangrando.

## Desenho provável (quando for atacar — a validar na investigação dedicada)
- Login: `Set-Cookie` httpOnly + `Secure` + `SameSite=Strict` (ou `Lax`) com o access token; parar de devolver o token no body.
- `JwtStrategy`: extrair o token do cookie (`ExtractJwt.fromExtractors([cookieExtractor, fromAuthHeader])` — manter o header por transição/API).
- `tenant_id`: cookie legível separado (não-httpOnly, só o UUID do tenant, sem segredo) OU derivar via `/auth/me`.
- CSRF: `GET /csrf` no boot do app → guardar o token → mandar `x-csrf-token` em todo request não-GET; `credentials:'include'` no fetch; ligar `CSRF_ENABLED=true`.
- Logout: limpar o cookie (além da denylist que já existe).
- **Transição:** aceitar header E cookie por um período (dual) pra não deslogar todo mundo no deploy.
- **Testes:** provar (a) token não fica acessível ao JS; (b) CSRF bloqueia POST sem token; (c) login/logout/rota autenticada funcionam via cookie; (d) o `tenant_id` continua chegando.

## Prioridade
Média-baixa **agora** (mitigado por CSP + revogação + TTL). Sobe se aparecer qualquer vetor de XSS real. Fazer com investigação própria + spec, sem pressa, em cima de tudo verde.
