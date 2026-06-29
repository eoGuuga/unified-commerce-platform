// E2E ao vivo do Admin (Produtos & Estoque) contra o backend rodando.
const BASE = 'http://localhost:3001/api/v1';
const TENANT = '00000000-0000-0000-0000-000000000000';
let token = '';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FALHA:', m); } };

async function api(method, path, body, extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', 'x-tenant-id': TENANT, ...extraHeaders };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

(async () => {
  console.log('\n=== LOGIN ===');
  const login = await api('POST', '/auth/login', { email: 'admin@exemplo.com', password: 'admin123' });
  ok(login.status === 201 && login.json.access_token, `login 201 + token (status ${login.status})`);
  token = login.json.access_token;

  const nome = `E2E Trufa ${Date.now().toString(36)}`;
  console.log(`\n=== CRIAR PRODUTO com estoque inicial (nome: ${nome}) ===`);
  const create = await api('POST', '/products', { name: nome, price: 8.5, category: 'E2E Doces', initial_stock: 20 });
  ok(create.status === 201, `criar 201 (status ${create.status})`);
  const pid = create.json?.id;
  ok(!!pid, `tem id: ${pid}`);
  ok(create.json?.category === 'E2E Doces', `category gravada: ${create.json?.category}`);
  ok(!!create.json?.sku, `SKU gerado: ${create.json?.sku}`);

  console.log('\n=== EXTRATO inicial: deve ter 1 INVENTARIO_INICIAL +20 ===');
  let hist = await api('GET', `/products/${pid}/stock-history`);
  ok(hist.status === 200, `extrato 200 (status ${hist.status})`);
  ok(hist.json?.items?.length === 1, `1 movimento (tem ${hist.json?.items?.length})`);
  ok(hist.json?.items?.[0]?.tipo === 'INVENTARIO_INICIAL', `tipo INVENTARIO_INICIAL (${hist.json?.items?.[0]?.tipo})`);
  ok(Number(hist.json?.items?.[0]?.delta) === 20, `delta +20 (${hist.json?.items?.[0]?.delta})`);
  ok(Number(hist.json?.items?.[0]?.saldo_resultante) === 20, `saldo 20 (${hist.json?.items?.[0]?.saldo_resultante})`);

  console.log('\n=== STOCK-SUMMARY: o produto aparece com saldo 20 ===');
  let sum = await api('GET', '/products/stock-summary');
  let p = (sum.json?.products || sum.json?.items || []).find(x => x.id === pid);
  ok(!!p, 'produto no summary');
  ok(Number(p?.current_stock) === 20 && Number(p?.available_stock) === 20, `current=20 available=20 (c=${p?.current_stock} a=${p?.available_stock})`);

  console.log('\n=== AJUSTE COMPRA +5 -> saldo 25 ===');
  let adj = await api('POST', `/products/${pid}/adjust-stock`, { tipo: 'COMPRA', delta: 5, motivo: 'reposicao e2e' });
  ok(adj.status === 201, `compra 201 (status ${adj.status})`);
  ok(Number(adj.json?.saldo_resultante) === 25, `saldo 25 (${adj.json?.saldo_resultante})`);

  console.log('\n=== AJUSTE PERDA -3 -> saldo 22 ===');
  adj = await api('POST', `/products/${pid}/adjust-stock`, { tipo: 'PERDA', delta: -3, motivo: 'quebra e2e' });
  ok(adj.status === 201, `perda 201 (status ${adj.status})`);
  ok(Number(adj.json?.saldo_resultante) === 22, `saldo 22 (${adj.json?.saldo_resultante})`);

  console.log('\n=== AJUSTE (Correção/modo-contagem) para 18: delta deve ser -4 -> saldo 18 ===');
  // modo-contagem: contado 18, atual 22 -> delta = 18 - 22 = -4
  adj = await api('POST', `/products/${pid}/adjust-stock`, { tipo: 'AJUSTE', delta: -4, motivo: 'contagem e2e' });
  ok(adj.status === 201, `correcao 201 (status ${adj.status})`);
  ok(Number(adj.json?.saldo_resultante) === 18, `saldo 18 (${adj.json?.saldo_resultante})`);

  console.log('\n=== VALIDACOES: sinal incoerente e tipo invalido no wire ===');
  let bad = await api('POST', `/products/${pid}/adjust-stock`, { tipo: 'COMPRA', delta: -5 });
  ok(bad.status === 400, `COMPRA negativo -> 400 (status ${bad.status})`);
  bad = await api('POST', `/products/${pid}/adjust-stock`, { tipo: 'INVENTARIO_INICIAL', delta: 5 });
  ok(bad.status === 400, `INVENTARIO_INICIAL no wire -> 400 (status ${bad.status})`);

  console.log('\n=== 422 INSUFFICIENT_STOCK: PERDA -999 (saldo 18) ===');
  let ins = await api('POST', `/products/${pid}/adjust-stock`, { tipo: 'PERDA', delta: -999 });
  ok(ins.status === 422, `status 422 (status ${ins.status})`);
  ok(ins.json?.code === 'INSUFFICIENT_STOCK', `code INSUFFICIENT_STOCK (${ins.json?.code})`);

  console.log('\n=== INVARIANTE: current_stock == soma(deltas) do extrato ===');
  hist = await api('GET', `/products/${pid}/stock-history?limit=100`);
  const soma = hist.json.items.reduce((s, i) => s + Number(i.delta), 0);
  sum = await api('GET', '/products/stock-summary');
  p = (sum.json?.products || sum.json?.items || []).find(x => x.id === pid);
  ok(soma === Number(p.current_stock), `soma(deltas)=${soma} == current_stock=${p.current_stock}`);
  // ordem: mais recente primeiro
  const datas = hist.json.items.map(i => new Date(i.created_at).getTime());
  ok(datas.every((d, i) => i === 0 || datas[i-1] >= d), 'extrato ordenado (recente primeiro)');

  console.log('\n=== CATEGORIES: "E2E Doces" aparece ===');
  const cats = await api('GET', '/products/categories');
  ok(cats.status === 200 && Array.isArray(cats.json), `200 + array (${cats.status})`);
  ok(cats.json.includes('E2E Doces'), `contem "E2E Doces"`);

  console.log('\n=== MIN-STOCK: setar 25 -> available(18) <= min(25) => low ===');
  const mn = await api('PATCH', `/products/${pid}/min-stock`, { min_stock: 25 });
  ok(mn.status === 200, `min-stock 200 (status ${mn.status})`);
  sum = await api('GET', '/products/stock-summary');
  p = (sum.json?.products || sum.json?.items || []).find(x => x.id === pid);
  ok(Number(p.min_stock) === 25, `min_stock=25 (${p?.min_stock})`);
  ok(p.status === 'low' || (Number(p.available_stock) <= Number(p.min_stock)), `status atencao (status=${p?.status}, avail=${p?.available_stock}, min=${p?.min_stock})`);

  console.log('\n=== INATIVOS: desativar -> some do default, aparece com include_inactive ===');
  await api('PATCH', `/products/${pid}`, { is_active: false });
  let def = await api('GET', '/products');
  let inDef = (Array.isArray(def.json) ? def.json : def.json?.data || []).some(x => x.id === pid);
  ok(!inDef, 'sumiu da lista default (so ativos)');
  let all = await api('GET', '/products?include_inactive=true');
  let inAll = (Array.isArray(all.json) ? all.json : all.json?.data || []).some(x => x.id === pid);
  ok(inAll, 'aparece com include_inactive=true (da pra reativar)');
  await api('PATCH', `/products/${pid}`, { is_active: true }); // reativa (limpeza)

  console.log(`\n========== RESULTADO: ${pass} PASS / ${fail} FAIL ==========`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.log('ERRO FATAL:', e.message); process.exit(2); });
