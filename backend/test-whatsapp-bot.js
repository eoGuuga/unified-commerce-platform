/**
 * Script de testes E2E para o WhatsApp Bot
 * Executar: node test-whatsapp-bot.js
 */

const API_BASE = process.env.API_URL || 'http://localhost:3001/api/v1';
const TENANT_ID = process.env.TEST_TENANT_ID || '00000000-0000-0000-0000-000000000000';

async function test(message, expectedContains = null) {
  try {
    const response = await fetch(`${API_BASE}/whatsapp/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, tenantId: TENANT_ID }),
    });

    const data = await response.json();
    const responseText = typeof data.response === 'string' ? data.response : JSON.stringify(data.response);

    console.log(`\n📤 Mensagem: "${message}"`);
    console.log(`📥 Resposta: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);

    if (expectedContains) {
      const passed = responseText.includes(expectedContains);
      console.log(`✅ ${passed ? 'PASSOU' : 'FALHOU'} - Esperado: "${expectedContains}"`);
      return passed;
    }

    return true;
  } catch (error) {
    console.error(`❌ Erro: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🧪 INICIANDO TESTES E2E DO WHATSAPP BOT');
  console.log('=' .repeat(50));

  let passed = 0;
  let failed = 0;

  // Teste 1: Saudação
  console.log('\n--- Teste 1: Saudação ---');
  if (await test('oi')) passed++; else failed++;

  // Teste 2: Ver produtos
  console.log('\n--- Teste 2: Ver produtos ---');
  const produtos = await test('ver produtos', 'Cardápio');
  if (produtos) passed++; else failed++;

  // Teste 3: Ver carrinho vazio
  console.log('\n--- Teste 3: Carrinho vazio ---');
  if (await test('carrinho', 'vazio')) passed++; else failed++;

  // Teste 4: Adicionar produto
  console.log('\n--- Teste 4: Adicionar produto ---');
  if (await test('adicionar brigadeiro gourmet', 'Adicionado')) passed++; else failed++;

  // Teste 5: Ver carrinho com item
  console.log('\n--- Teste 5: Carrinho com item ---');
  if (await test('carrinho', 'Brigadeiro Gourmet')) passed++; else failed++;

  // Teste 6: Help
  console.log('\n--- Teste 6: Ajuda ---');
  if (await test('ajuda', 'Comandos')) passed++; else failed++;

  // Teste 7: Preço
  console.log('\n--- Teste 7: Buscar preço ---');
  if (await test('brigadeiro', 'R$')) passed++; else failed++;

  // Resumo
  console.log('\n' + '=' .repeat(50));
  console.log(`📊 RESULTADO: ${passed} passaram, ${failed} falharam`);

  if (failed === 0) {
    console.log('🎉 TODOS OS TESTES PASSARAM!');
  } else {
    console.log('⚠️ Alguns testes falharam. Verifique o log acima.');
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests();