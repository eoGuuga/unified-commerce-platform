/**
 * Script para testar transações ACID e validar FOR UPDATE locks
 * 
 * Este script testa:
 * 1. Criação de pedido com sucesso
 * 2. Validação de estoque insuficiente
 * 3. Race condition (2 pedidos simultâneos)
 * 
 * Execute: npx ts-node scripts/test-acid-transactions.ts
 */

import { DataSource, EntityManager } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

// Carregar .env
config({ path: path.join(__dirname, '../backend/.env') });

// Importar entities
import { MovimentacaoEstoque } from '../backend/src/database/entities/MovimentacaoEstoque.entity';
import { Produto } from '../backend/src/database/entities/Produto.entity';
import { Pedido } from '../backend/src/database/entities/Pedido.entity';
import { ItemPedido } from '../backend/src/database/entities/ItemPedido.entity';

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

    // TESTE 1: Criar produto de teste
    console.log('📦 TESTE 1: Criando produto de teste...');
    const produtoRepo = dataSource.getRepository(Produto);
    let produto = await produtoRepo.findOne({
      where: { tenant_id: TENANT_ID, name: 'Brigadeiro Teste ACID' },
    });

    if (!produto) {
      produto = produtoRepo.create({
        tenant_id: TENANT_ID,
        name: 'Brigadeiro Teste ACID',
        price: '10.50',
        description: 'Produto para teste de transações ACID',
        unit: 'unidade',
        is_active: true,
      });
      produto = await produtoRepo.save(produto);
      console.log(`✅ Produto criado: ${produto.id}\n`);
    } else {
      console.log(`✅ Produto já existe: ${produto.id}\n`);
    }

    // Criar/atualizar estoque
    const estoqueRepo = dataSource.getRepository(MovimentacaoEstoque);
    let estoque = await estoqueRepo.findOne({
      where: { tenant_id: TENANT_ID, produto_id: produto.id },
    });

    if (!estoque) {
      estoque = estoqueRepo.create({
        tenant_id: TENANT_ID,
        produto_id: produto.id,
        current_stock: 50,
        min_stock: 10,
      });
      estoque = await estoqueRepo.save(estoque);
      console.log(`✅ Estoque criado: ${estoque.current_stock} unidades\n`);
    } else {
      // Resetar estoque para 50
      estoque.current_stock = 50;
      await estoqueRepo.save(estoque);
      console.log(`✅ Estoque resetado: ${estoque.current_stock} unidades\n`);
    }

    // TESTE 2: Criar pedido com sucesso
    console.log('📝 TESTE 2: Criando pedido com sucesso...');
    const pedidoRepo = dataSource.getRepository(Pedido);
    const itensRepo = dataSource.getRepository(ItemPedido);

    await dataSource.transaction(async (manager: EntityManager) => {
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
        subtotal: '52.50',
        total_amount: '52.50',
      });

      const savedPedido = await manager.save(pedido);

      // Criar item
      const item = manager.create(ItemPedido, {
        pedido_id: savedPedido.id,
        produto_id: produto.id,
        quantity: 5,
        unit_price: '10.50',
        subtotal: '52.50',
      });

      await manager.save(item);
    });

    // Verificar estoque atualizado
    const estoqueAtualizado = await estoqueRepo.findOne({
      where: { tenant_id: TENANT_ID, produto_id: produto.id },
    });

    console.log(`✅ Pedido criado com sucesso!`);
    console.log(`✅ Estoque atualizado: ${estoqueAtualizado?.current_stock} unidades (era 50, agora ${estoqueAtualizado?.current_stock})\n`);

    if (estoqueAtualizado?.current_stock !== 45) {
      throw new Error(`❌ ERRO: Estoque deveria ser 45, mas é ${estoqueAtualizado?.current_stock}`);
    }

    // TESTE 3: Tentar overselling (deve falhar)
    console.log('🚫 TESTE 3: Tentando overselling (deve falhar)...');
    try {
      await dataSource.transaction(async (manager: EntityManager) => {
        const estoqueLocked = await manager
          .createQueryBuilder(MovimentacaoEstoque, 'e')
          .where('e.tenant_id = :tenantId', { tenantId: TENANT_ID })
          .andWhere('e.produto_id = :produtoId', { produtoId: produto.id })
          .setLock('pessimistic_write')
          .getOne();

        if (!estoqueLocked) {
          throw new Error('Estoque não encontrado');
        }

        if (estoqueLocked.current_stock < 100) {
          throw new Error(`Estoque insuficiente: necessário 100, disponível ${estoqueLocked.current_stock}`);
        }

        // Não deve chegar aqui
        throw new Error('ERRO: Deveria ter falhado antes');
      });

      throw new Error('❌ ERRO: Transação deveria ter falhado!');
    } catch (error: any) {
      if (error.message.includes('Estoque insuficiente')) {
        console.log(`✅ Overselling bloqueado corretamente: ${error.message}\n`);
      } else {
        throw error;
      }
    }

    // TESTE 4: Race condition (simulação)
    console.log('⚡ TESTE 4: Simulando race condition (2 pedidos simultâneos)...');
    
    // Resetar estoque para 40
    estoque.current_stock = 40;
    await estoqueRepo.save(estoque);
    console.log(`✅ Estoque resetado: 40 unidades\n`);

    // Criar 2 pedidos simultâneos (cada um tenta comprar 30 unidades)
    const promises = [
      dataSource.transaction(async (manager) => {
        const estoqueLocked = await manager
          .createQueryBuilder(MovimentacaoEstoque, 'e')
          .where('e.tenant_id = :tenantId', { tenantId: TENANT_ID })
          .andWhere('e.produto_id = :produtoId', { produtoId: produto.id })
          .setLock('pessimistic_write')
          .getOne();

        if (!estoqueLocked || estoqueLocked.current_stock < 30) {
          throw new Error(`Estoque insuficiente: necessário 30, disponível ${estoqueLocked?.current_stock || 0}`);
        }

        await manager
          .createQueryBuilder()
          .update(MovimentacaoEstoque)
          .set({
            current_stock: () => `current_stock - 30`,
            last_updated: () => 'NOW()',
          })
          .where('tenant_id = :tenantId', { tenantId: TENANT_ID })
          .andWhere('produto_id = :produtoId', { produtoId: produto.id })
          .execute();

        return 'SUCESSO';
      }),
      dataSource.transaction(async (manager) => {
        // Pequeno delay para simular simultaneidade
        await new Promise((resolve) => setTimeout(resolve, 10));

        const estoqueLocked = await manager
          .createQueryBuilder(MovimentacaoEstoque, 'e')
          .where('e.tenant_id = :tenantId', { tenantId: TENANT_ID })
          .andWhere('e.produto_id = :produtoId', { produtoId: produto.id })
          .setLock('pessimistic_write')
          .getOne();

        if (!estoqueLocked || estoqueLocked.current_stock < 30) {
          throw new Error(`Estoque insuficiente: necessário 30, disponível ${estoqueLocked?.current_stock || 0}`);
        }

        await manager
          .createQueryBuilder()
          .update(MovimentacaoEstoque)
          .set({
            current_stock: () => `current_stock - 30`,
            last_updated: () => 'NOW()',
          })
          .where('tenant_id = :tenantId', { tenantId: TENANT_ID })
          .andWhere('produto_id = :produtoId', { produtoId: produto.id })
          .execute();

        return 'SUCESSO';
      }),
    ];

    const results = await Promise.allSettled(promises);
    const sucessos = results.filter((r) => r.status === 'fulfilled').length;
    const falhas = results.filter((r) => r.status === 'rejected').length;

    console.log(`✅ Race condition testada:`);
    console.log(`   - Sucessos: ${sucessos}`);
    console.log(`   - Falhas: ${falhas}`);

    if (sucessos !== 1 || falhas !== 1) {
      throw new Error(`❌ ERRO: Deveria ter 1 sucesso e 1 falha, mas teve ${sucessos} sucessos e ${falhas} falhas`);
    }

    // Verificar estoque final
    const estoqueFinal = await estoqueRepo.findOne({
      where: { tenant_id: TENANT_ID, produto_id: produto.id },
    });

    console.log(`✅ Estoque final: ${estoqueFinal?.current_stock} unidades\n`);

    if (estoqueFinal?.current_stock !== 10) {
      throw new Error(`❌ ERRO: Estoque deveria ser 10, mas é ${estoqueFinal?.current_stock}`);
    }

    console.log('🎉 TODOS OS TESTES PASSARAM!');
    console.log('✅ Transações ACID funcionando perfeitamente');
    console.log('✅ FOR UPDATE locks prevenindo overselling');
    console.log('✅ Race conditions tratadas corretamente\n');

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
