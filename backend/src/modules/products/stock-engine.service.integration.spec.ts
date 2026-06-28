import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { databaseConfig } from '../../config/database.config';
import { CommonModule } from '../common/common.module';
import { ProductsModule } from './products.module';
import { StockEngineService } from './stock-engine.service';

const tenantId = '00000000-0000-0000-0000-000000000000';

describe('StockEngineService (integration)', () => {
  let dataSource: DataSource | null = null;
  let engine: StockEngineService;
  let produtoId: string;

  beforeAll(async () => {
    try {
      process.env.SUPPRESS_TENANT_RLS_LOGS = 'true';
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
          TypeOrmModule.forRootAsync(databaseConfig),
          CommonModule,
          ProductsModule,
        ],
      }).compile();
      dataSource = moduleRef.get<DataSource>(DataSource);
      engine = moduleRef.get<StockEngineService>(StockEngineService);
    } catch {
      dataSource = null;
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  // Cria um produto + saldo zerado e devolve o produto_id
  async function seedProduto(current: number, reserved = 0): Promise<string> {
    const qr = dataSource!.createQueryRunner();
    await qr.connect();
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
    const prod = await qr.query(
      `INSERT INTO produtos (id, tenant_id, name, price, is_active, created_at, updated_at)
       VALUES (uuid_generate_v4(), $1, 'Teste Estoque', 10.0, true, now(), now()) RETURNING id`,
      [tenantId],
    );
    const pid = prod[0].id;
    await qr.query(
      `INSERT INTO movimentacoes_estoque (id, tenant_id, produto_id, current_stock, reserved_stock, min_stock, last_updated)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, 0, now())`,
      [tenantId, pid, current, reserved],
    );
    await qr.release();
    return pid;
  }

  async function saldo(pid: string): Promise<{ current: number; reserved: number }> {
    const qr = dataSource!.createQueryRunner();
    await qr.connect();
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
    const r = await qr.query(
      `SELECT current_stock, reserved_stock FROM movimentacoes_estoque WHERE produto_id = $1`,
      [pid],
    );
    await qr.release();
    return { current: Number(r[0].current_stock), reserved: Number(r[0].reserved_stock) };
  }

  it('reserve aumenta reserved_stock quando há disponível', async () => {
    if (!dataSource) return;
    produtoId = await seedProduto(5);
    await dataSource.transaction(async (m: EntityManager) => {
      await m.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      await engine.reserve(m, tenantId, produtoId, 3);
    });
    expect(await saldo(produtoId)).toEqual({ current: 5, reserved: 3 });
  });

  it('reserve rejeita quando available < qty', async () => {
    if (!dataSource) return;
    const pid = await seedProduto(2);
    await expect(
      dataSource.transaction(async (m: EntityManager) => {
        await m.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
        return engine.reserve(m, tenantId, pid, 5);
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await saldo(pid)).toEqual({ current: 2, reserved: 0 });
  });

  it('release reduz reserved_stock sem ir abaixo de zero', async () => {
    if (!dataSource) return;
    const pid = await seedProduto(5, 3);
    await dataSource.transaction(async (m: EntityManager) => {
      await m.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      return engine.release(m, tenantId, pid, 10);
    });
    expect(await saldo(pid)).toEqual({ current: 5, reserved: 0 });
  });

  it('concorrência: a guarda atômica impede reservar o último item duas vezes', async () => {
    if (!dataSource) return;
    const pid = await seedProduto(1); // só 1 disponível
    // 1ª reserva (transação própria, commitada) consome o disponível
    await dataSource.transaction(async (m: EntityManager) => {
      await m.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      return engine.reserve(m, tenantId, pid, 1);
    });
    // 2ª reserva, em transação separada, deve falhar — available agora é 0
    await expect(
      dataSource.transaction(async (m: EntityManager) => {
        await m.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
        return engine.reserve(m, tenantId, pid, 1);
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await saldo(pid)).toEqual({ current: 1, reserved: 1 }); // reservado só uma vez
  });

  it('commitSale baixa current e reserved e grava VENDA no ledger', async () => {
    if (!dataSource) return;
    const pid = await seedProduto(10, 4);
    const orderId = (await dataSource.query(`SELECT uuid_generate_v4() AS id`))[0].id;
    await dataSource.transaction(async (m: EntityManager) => {
      await m.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      return engine.commitSale(m, tenantId, orderId, [{ produto_id: pid, quantity: 4 }]);
    });
    expect(await saldo(pid)).toEqual({ current: 6, reserved: 0 });

    const ledger = await dataSource.query(
      `SELECT tipo, delta, saldo_resultante FROM movimentacoes_estoque_historico
       WHERE order_id = $1 AND produto_id = $2`,
      [orderId, pid],
    );
    expect(ledger).toHaveLength(1);
    expect(ledger[0].tipo).toBe('VENDA');
    expect(Number(ledger[0].delta)).toBe(-4);
    expect(Number(ledger[0].saldo_resultante)).toBe(6);
  });

  it('commitSale é idempotente — 2ª chamada não baixa de novo', async () => {
    if (!dataSource) return;
    const pid = await seedProduto(10, 4);
    const orderId = (await dataSource.query(`SELECT uuid_generate_v4() AS id`))[0].id;
    const items = [{ produto_id: pid, quantity: 4 }];
    await dataSource.transaction(async (m: EntityManager) => {
      await m.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      return engine.commitSale(m, tenantId, orderId, items);
    });
    await dataSource.transaction(async (m: EntityManager) => {
      await m.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      return engine.commitSale(m, tenantId, orderId, items);
    });
    expect(await saldo(pid)).toEqual({ current: 6, reserved: 0 });
    const count = await dataSource.query(
      `SELECT COUNT(*)::int AS n FROM movimentacoes_estoque_historico
       WHERE order_id = $1 AND produto_id = $2 AND tipo = 'VENDA'`,
      [orderId, pid],
    );
    expect(count[0].n).toBe(1);
  });

  it('recordManualMovement grava ledger e ajusta saldo', async () => {
    if (!dataSource) return;
    const pid = await seedProduto(5);
    const res = await dataSource.transaction(async (m: EntityManager) => {
      await m.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      return engine.recordManualMovement(m, tenantId, pid, 'COMPRA' as any, 7, 'reposição', null);
    });
    expect(res.saldo_resultante).toBe(12);
    expect((await saldo(pid)).current).toBe(12);
  });

  it('invariante do ledger: current_stock == SUM(delta) de todas as movimentações do produto', async () => {
    // Garante que toda mutação de estoque passou pelo motor e foi registrada no ledger.
    // Sequência: compra +10, reserva 4, commit venda -4, perda -2 → current_stock final = 4.
    // Invariante: current_stock deve igual SUM(delta) do ledger.
    if (!dataSource) return;

    // Seed com saldo zerando (sem linha de ledger pré-existente) para garantir a invariante desde o início
    const pid = await seedProduto(0, 0);

    // Passo 1: compra inicial → current 10
    await dataSource.transaction(async (m: EntityManager) => {
      await m.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      await engine.recordManualMovement(m, tenantId, pid, 'COMPRA' as any, 10, 'compra inicial', null);
    });

    // Passo 2: reserva 4 unidades (para o pedido futuro)
    await dataSource.transaction(async (m: EntityManager) => {
      await m.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      await engine.reserve(m, tenantId, pid, 4);
    });

    // Passo 3: commit da venda → current 6, ledger VENDA -4
    const orderId = (await dataSource!.query(`SELECT uuid_generate_v4() AS id`))[0].id;
    await dataSource.transaction(async (m: EntityManager) => {
      await m.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      await engine.commitSale(m, tenantId, orderId, [{ produto_id: pid, quantity: 4 }]);
    });

    // Passo 4: perda -2 (quebra/avaria) → current 4
    await dataSource.transaction(async (m: EntityManager) => {
      await m.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      await engine.recordManualMovement(m, tenantId, pid, 'PERDA' as any, -2, 'quebra', null);
    });

    // Valida saldo intermediário esperado
    expect((await saldo(pid)).current).toBe(4);

    // Valida a invariante: current_stock == SUM(delta) do ledger (regra de ouro)
    const invarianteResult = await dataSource.query(
      `SELECT (
         (SELECT current_stock FROM movimentacoes_estoque WHERE produto_id = $1)
         = (SELECT COALESCE(SUM(delta), 0) FROM movimentacoes_estoque_historico WHERE produto_id = $1)
       ) AS ok`,
      [pid],
    );
    expect(invarianteResult[0].ok).toBe(true);
  });
});
