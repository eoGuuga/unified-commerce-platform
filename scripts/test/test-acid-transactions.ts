/**
 * Script para testar transaÃ§Ãµes ACID e validar FOR UPDATE locks
 * 
 * Este script testa:
 * 1. CriaÃ§Ã£o de pedido com sucesso
 * 2. ValidaÃ§Ã£o de estoque insuficiente
 * 3. Race condition (2 pedidos simultÃ¢neos)
 * 
 * Execute: npx ts-node scripts/test/test-acid-transactions.ts
 */

import { DataSource, EntityManager } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

// Carregar .env
config({ path: path.join(__dirname, '../../backend/.env') });

// Importar entities
import { Tenant } from '../../backend/src/database/entities/Tenant.entity';
import { Usuario } from '../../backend/src/database/entities/Usuario.entity';
import { Categoria } from '../../backend/src/database/entities/Categoria.entity';
import { MovimentacaoEstoque } from '../../backend/src/database/entities/MovimentacaoEstoque.entity';
import { Produto } from '../../backend/src/database/entities/Produto.entity';
import { Pedido } from '../../backend/src/database/entities/Pedido.entity';
import { ItemPedido } from '../../backend/src/database/entities/ItemPedido.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000000';

async function testACIDTransactions() {
  console.log('ðŸ§ª Iniciando testes de transaÃ§Ãµes ACID...\n');

  // Criar DataSource
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [Tenant, Usuario, Categoria, MovimentacaoEstoque, Produto, Pedido, ItemPedido],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('âœ… Conectado ao banco de dados\n');

    const runWithTenant = async <T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> => {
      return await dataSource.transaction(async (manager) => {
        await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [TENANT_ID]);
        return await fn(manager);
      });
    };

    // TESTE 1: Criar produto de teste
    console.log('ðŸ“¦ TESTE 1: Criando produto de teste...');
    let produto = await runWithTenant(async (manager) => {
      const produtoRepo = manager.getRepository(Produto);
      let existing = await produtoRepo.findOne({
        where: { tenant_id: TENANT_ID, name: 'Brigadeiro Teste ACID' },
      });

      if (!existing) {
        existing = produtoRepo.create({
          tenant_id: TENANT_ID,
          name: 'Brigadeiro Teste ACID',
          price: 10.50,
          description: 'Produto para teste de transaÃ§Ãµes ACID',
          unit: 'unidade',
          is_active: true,
        });
        existing = await produtoRepo.save(existing);
        console.log(`âœ… Produto criado: ${existing.id}\n`);
      } else {
        console.log(`âœ… Produto jÃ¡ existe: ${existing.id}\n`);
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
        console.log(`âœ… Estoque criado: ${existing.current_stock} unidades\n`);
      } else {
        existing.current_stock = 50;
        existing = await estoqueRepo.save(existing);
        console.log(`âœ… Estoque resetado: ${existing.current_stock} unidades\n`);
      }
      return existing;
    });

    // TESTE 2: Criar pedido com sucesso
    console.log('ðŸ“ TESTE 2: Criando pedido com sucesso...');
    const pedidoRepo = dataSource.getRepository(Pedido);
    const itensRepo = dataSource.getRepository(ItemPedido);

    await runWithTenant(async (manager: EntityManager) => {
      // FOR UPDATE lock
      const estoqueLocked = await manager
        .createQueryBuilder(MovimentacaoEstoque, 'e')
        .where('e.tenant_id = :tenantId', { tenantId: TENANT_ID })
        .andWhere('e.produto_id = :produtoId', { produtoId: produto.id })
        .setLock('pessimistic_write')
        .getOne();

      if (!estoqueLocked) {
        throw new Error('Estoque nÃ£o encontrado');
      }

      if (estoqueLocked.current_stock < 5) {
        throw new Error(`Estoque insuficiente: necessÃ¡rio 5, disponÃ­vel ${estoqueLocked.current_stock}`);
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
        status: 'confirmado' as any,
        channel: 'pdv' as any,
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

    console.log(`âœ… Pedido criado com sucesso!`);
    console.log(`âœ… Estoque atualizado: ${estoqueAtualizado?.current_stock} unidades (era 50, agora ${estoqueAtualizado?.current_stock})\n`);

    if (estoqueAtualizado?.current_stock !== 45) {
      throw new Error(`âŒ ERRO: Estoque deveria ser 45, mas Ã© ${estoqueAtualizado?.current_stock}`);
    }

    // TESTE 3: Tentar overselling (deve falhar)
    console.log('ðŸš« TESTE 3: Tentando overselling (deve falhar)...');
    try {
      await runWithTenant(async (manager: EntityManager) => {
        const estoqueLocked = await manager
          .createQueryBuilder(MovimentacaoEstoque, 'e')
          .where('e.tenant_id = :tenantId', { tenantId: TENANT_ID })
          .andWhere('e.produto_id = :produtoId', { produtoId: produto.id })
          .setLock('pessimistic_write')
          .getOne();

        if (!estoqueLocked) {
          throw new Error('Estoque nÃ£o encontrado');
        }

        if (estoqueLocked.current_stock < 100) {
          throw new Error(`Estoque insuficiente: necessÃ¡rio 100, disponÃ­vel ${estoqueLocked.current_stock}`);
        }

        // NÃ£o deve chegar aqui
        throw new Error('ERRO: Deveria ter falhado antes');
      });

      throw new Error('âŒ ERRO: TransaÃ§Ã£o deveria ter falhado!');
    } catch (error: any) {
      if (error.message.includes('Estoque insuficiente')) {
        console.log(`âœ… Overselling bloqueado corretamente: ${error.message}\n`);
      } else {
        throw error;
      }
    }

    // TESTE 4: Race condition (simulaÃ§Ã£o)
    console.log('âš¡ TESTE 4: Simulando race condition (2 pedidos simultÃ¢neos)...');
    
    // Resetar estoque para 40
    estoque = await runWithTenant(async (manager) => {
      const estoqueRepo = manager.getRepository(MovimentacaoEstoque);
      const existing = await estoqueRepo.findOne({
        where: { tenant_id: TENANT_ID, produto_id: produto.id },
      });
      if (!existing) {
        throw new Error('Estoque nao encontrado para reset');
      }
      existing.current_stock = 40;
      const saved = await estoqueRepo.save(existing);
      console.log(`âœ… Estoque resetado: 40 unidades\n`);
      return saved;
    });

    // Criar 2 pedidos simultÃ¢neos (cada um tenta comprar 30 unidades)
    const promises = [
      runWithTenant(async (manager: EntityManager) => {
        const estoqueLocked = await manager
          .createQueryBuilder(MovimentacaoEstoque, 'e')
          .where('e.tenant_id = :tenantId', { tenantId: TENANT_ID })
          .andWhere('e.produto_id = :produtoId', { produtoId: produto.id })
          .setLock('pessimistic_write')
          .getOne();

        if (!estoqueLocked || estoqueLocked.current_stock < 30) {
          throw new Error(`Estoque insuficiente: necessÃ¡rio 30, disponÃ­vel ${estoqueLocked?.current_stock || 0}`);
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
      runWithTenant(async (manager: EntityManager) => {
        // Pequeno delay para simular simultaneidade
        await new Promise((resolve) => setTimeout(resolve, 10));

        const estoqueLocked = await manager
          .createQueryBuilder(MovimentacaoEstoque, 'e')
          .where('e.tenant_id = :tenantId', { tenantId: TENANT_ID })
          .andWhere('e.produto_id = :produtoId', { produtoId: produto.id })
          .setLock('pessimistic_write')
          .getOne();

        if (!estoqueLocked || estoqueLocked.current_stock < 30) {
          throw new Error(`Estoque insuficiente: necessÃ¡rio 30, disponÃ­vel ${estoqueLocked?.current_stock || 0}`);
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

    console.log(`âœ… Race condition testada:`);
    console.log(`   - Sucessos: ${sucessos}`);
    console.log(`   - Falhas: ${falhas}`);

    if (sucessos !== 1 || falhas !== 1) {
      throw new Error(`âŒ ERRO: Deveria ter 1 sucesso e 1 falha, mas teve ${sucessos} sucessos e ${falhas} falhas`);
    }

    // Verificar estoque final
    const estoqueFinal = await runWithTenant(async (manager) => {
      return await manager.getRepository(MovimentacaoEstoque).findOne({
        where: { tenant_id: TENANT_ID, produto_id: produto.id },
      });
    });

    console.log(`âœ… Estoque final: ${estoqueFinal?.current_stock} unidades\n`);

    if (estoqueFinal?.current_stock !== 10) {
      throw new Error(`âŒ ERRO: Estoque deveria ser 10, mas Ã© ${estoqueFinal?.current_stock}`);
    }

    console.log('ðŸŽ‰ TODOS OS TESTES PASSARAM!');
    console.log('âœ… TransaÃ§Ãµes ACID funcionando perfeitamente');
    console.log('âœ… FOR UPDATE locks prevenindo overselling');
    console.log('âœ… Race conditions tratadas corretamente\n');

  } catch (error: any) {
    console.error('âŒ ERRO nos testes:', error.message);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

// Executar testes
testACIDTransactions()
  .then(() => {
    console.log('âœ… Testes concluÃ­dos com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('âŒ Erro ao executar testes:', error);
    process.exit(1);
  });
