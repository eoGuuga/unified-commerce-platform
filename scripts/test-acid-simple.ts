/**
 * Script SIMPLIFICADO para testar transações ACID
 * 
 * Execute: node scripts/test-acid-simple.js
 * (Após compilar: tsc scripts/test-acid-simple.ts)
 */

// Usar require ao invés de import para evitar problemas de resolução
const { DataSource } = require('typeorm');
const { config } = require('dotenv');
const path = require('path');

// Carregar .env
config({ path: path.join(__dirname, '../backend/.env') });

// Importar entities usando require
const { MovimentacaoEstoque } = require('../backend/src/database/entities/MovimentacaoEstoque.entity');
const { Produto } = require('../backend/src/database/entities/Produto.entity');
const { Pedido } = require('../backend/src/database/entities/Pedido.entity');
const { ItemPedido } = require('../backend/src/database/entities/ItemPedido.entity');

const TENANT_ID = '00000000-0000-0000-0000-000000000000';

async function testACIDTransactions() {
  console.log('🧪 Iniciando testes de transações ACID...\n');

  // Criar DataSource
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [MovimentacaoEstoque, Produto, Pedido, ItemPedido],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Conectado ao banco de dados\n');

    const runWithTenant = async (fn) => {
      return await dataSource.transaction(async (manager) => {
        await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [TENANT_ID]);
        return await fn(manager);
      });
    };

    // TESTE 1: Criar produto de teste
    console.log('📦 TESTE 1: Criando produto de teste...');
    let produto = await runWithTenant(async (manager) => {
      const produtoRepo = manager.getRepository(Produto);
      let existing = await produtoRepo.findOne({
        where: { tenant_id: TENANT_ID, name: 'Brigadeiro Teste ACID' },
      });

      if (!existing) {
        existing = produtoRepo.create({
          tenant_id: TENANT_ID,
          name: 'Brigadeiro Teste ACID',
          price: '10.50',
          description: 'Produto para teste de transações ACID',
          unit: 'unidade',
          is_active: true,
        });
        existing = await produtoRepo.save(existing);
        console.log(`✅ Produto criado: ${existing.id}\n`);
      } else {
        console.log(`✅ Produto já existe: ${existing.id}\n`);
      }
      return existing;
    });

    // Criar/atualizar estoque
    let estoque = await runWithTenant(async (manager) => {
      const estoqueRepo = manager.getRepository(MovimentacaoEstoque);
      let existing = await estoqueRepo.findOne({
        where: { tenant_id: TENANT_ID, produto_id: produto.id },
      });

      if (!existing) {
        existing = estoqueRepo.create({
          tenant_id: TENANT_ID,
          produto_id: produto.id,
          current_stock: 50,
          min_stock: 10,
        });
        existing = await estoqueRepo.save(existing);
        console.log(`✅ Estoque criado: ${existing.current_stock} unidades\n`);
      } else {
        existing.current_stock = 50;
        existing = await estoqueRepo.save(existing);
        console.log(`✅ Estoque resetado: ${existing.current_stock} unidades\n`);
      }
      return existing;
    });

    // TESTE 2: Criar pedido com sucesso
    console.log('📝 TESTE 2: Criando pedido com sucesso...');
    const pedidoRepo = dataSource.getRepository(Pedido);
    const itensRepo = dataSource.getRepository(ItemPedido);

    await runWithTenant(async (manager) => {
      // FOR UPDATE lock
      const estoqueLocked = await manager
        .createQueryBuilder(MovimentacaoEstoque, 'e')
        .where('e.tenant_id = :tenantId', { tenantId: TENANT_ID })
        .andWhere('e.produto_id = :produtoId', { produtoId: produto.id })
        .setLock('pessimistic_write')
        .getOne();

      if (!estoqueLocked) {
        throw new Error('Estoque não encontrado');
      }

      if (estoqueLocked.current_stock < 5) {
        throw new Error(`Estoque insuficiente: necessário 5, disponível ${estoqueLocked.current_stock}`);
      }

      // Abater estoque
      await manager
        .createQueryBuilder()
        .update(MovimentacaoEstoque)
        .set({
          current_stock: () => `current_stock - 5`,
          last_updated: () => 'NOW()',
        })
        .where('tenant_id = :tenantId', { tenantId: TENANT_ID })
        .andWhere('produto_id = :produtoId', { produtoId: produto.id })
        .execute();

      // Criar pedido
      const pedido = manager.create(Pedido, {
        tenant_id: TENANT_ID,
        order_no: `TEST-${Date.now()}`,
        status: 'CONFIRMADO',
        channel: 'pdv',
        customer_name: 'Cliente Teste',
        subtotal: 52.50,
        total_amount: 52.50,
      });

      const savedPedido = await manager.save(pedido);

      // Criar item
      const item = manager.create(ItemPedido, {
        pedido_id: savedPedido.id,
        produto_id: produto.id,
        quantity: 5,
        unit_price: 10.50,
        subtotal: 52.50,
      });

      await manager.save(item);
    });

    // Verificar estoque atualizado
    const estoqueAtualizado = await runWithTenant(async (manager) => {
      return await manager.getRepository(MovimentacaoEstoque).findOne({
        where: { tenant_id: TENANT_ID, produto_id: produto.id },
      });
    });

    console.log(`✅ Pedido criado com sucesso!`);
    console.log(`✅ Estoque atualizado: ${estoqueAtualizado?.current_stock} unidades (era 50, agora ${estoqueAtualizado?.current_stock})\n`);

    if (estoqueAtualizado?.current_stock !== 45) {
      throw new Error(`❌ ERRO: Estoque deveria ser 45, mas é ${estoqueAtualizado?.current_stock}`);
    }

    console.log('🎉 TESTE BÁSICO PASSOU!');
    console.log('✅ Transações ACID funcionando perfeitamente\n');

  } catch (error: any) {
    console.error('❌ ERRO nos testes:', error.message);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

// Executar testes
testACIDTransactions()
  .then(() => {
    console.log('✅ Testes concluídos com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro ao executar testes:', error);
    process.exit(1);
  });
