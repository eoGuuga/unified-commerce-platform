import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { MovimentacaoEstoque } from '../../database/entities/MovimentacaoEstoque.entity';
import {
  MovimentacaoEstoqueHistorico,
  LedgerTipo,
} from '../../database/entities/MovimentacaoEstoqueHistorico.entity';

/**
 * Primitivas atômicas de estoque. Toda mutação é UPDATE guardado no banco,
 * com checagem de linhas afetadas — nunca ler-em-JS-e-gravar.
 * Os métodos recebem o EntityManager da transação do chamador.
 */
@Injectable()
export class StockEngineService {
  /**
   * Reserva `qty` se houver disponível (current - reserved >= qty). Atômico.
   */
  async reserve(
    manager: EntityManager,
    tenantId: string,
    produtoId: string,
    qty: number,
  ): Promise<void> {
    this.assertQty(qty);
    const result = await manager
      .createQueryBuilder()
      .update(MovimentacaoEstoque)
      .set({
        reserved_stock: () => 'reserved_stock + :qty',
        last_updated: () => 'NOW()',
      })
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('produto_id = :produtoId', { produtoId })
      .andWhere('current_stock - reserved_stock >= :qty')
      .setParameters({ qty })
      .execute();

    if (!result.affected || result.affected < 1) {
      throw new BadRequestException(
        `Estoque insuficiente para reservar produto ${produtoId} (qtd ${qty}).`,
      );
    }
  }

  /**
   * Libera `qty` de reserva. Nunca deixa reserved_stock negativo.
   */
  async release(
    manager: EntityManager,
    tenantId: string,
    produtoId: string,
    qty: number,
  ): Promise<void> {
    this.assertQty(qty);
    await manager
      .createQueryBuilder()
      .update(MovimentacaoEstoque)
      .set({
        reserved_stock: () => 'GREATEST(0, reserved_stock - :qty)',
        last_updated: () => 'NOW()',
      })
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('produto_id = :produtoId', { produtoId })
      .setParameters({ qty })
      .execute();
  }

  /**
   * Baixa real de venda: current -= qty e reserved -= qty, + ledger VENDA.
   * Idempotente: se já existe VENDA para (order_id, produto_id), pula o item.
   */
  async commitSale(
    manager: EntityManager,
    tenantId: string,
    orderId: string,
    items: Array<{ produto_id: string; quantity: number }>,
  ): Promise<void> {
    for (const item of items) {
      this.assertQty(item.quantity);

      // Gate de idempotência: tenta inserir o registro de VENDA primeiro.
      // ON CONFLICT no índice parcial (order_id, produto_id) WHERE tipo='VENDA'.
      // manager.query() com RETURNING retorna tupla [[linhas], rowCount] neste TypeORM+pg; unwrap obrigatorio antes de ler campos.
      const rawInsert = await manager.query(
        `INSERT INTO movimentacoes_estoque_historico
           (id, tenant_id, produto_id, tipo, delta, saldo_resultante, order_id, created_at)
         VALUES (uuid_generate_v4(), $1, $2, 'VENDA', $3, 0, $4, now())
         ON CONFLICT (order_id, produto_id) WHERE tipo = 'VENDA' DO NOTHING
         RETURNING id`,
        [tenantId, item.produto_id, -item.quantity, orderId],
      );
      // manager.query() com RETURNING retorna tupla [[linhas], rowCount] neste TypeORM+pg; unwrap obrigatorio antes de ler campos.
      const insertedRows: Array<{ id: string }> = Array.isArray(rawInsert[0])
        ? rawInsert[0]
        : rawInsert;

      // Já existia (retry) → no-op para este item.
      if (!insertedRows || insertedRows.length === 0) continue;
      const ledgerId = insertedRows[0].id;

      // Baixa guardada; RETURNING dá o saldo pós-update (sem ler memória).
      // manager.query() com RETURNING retorna tupla [[linhas], rowCount] neste TypeORM+pg; unwrap obrigatorio antes de ler campos.
      const rawUpdate = await manager.query(
        `UPDATE movimentacoes_estoque
         SET current_stock = current_stock - $3,
             reserved_stock = GREATEST(0, reserved_stock - $3),
             last_updated = now()
         WHERE tenant_id = $1 AND produto_id = $2 AND current_stock - $3 >= 0
         RETURNING current_stock`,
        [tenantId, item.produto_id, item.quantity],
      );
      // manager.query() com RETURNING retorna tupla [[linhas], rowCount] neste TypeORM+pg; unwrap obrigatorio antes de ler campos.
      const updatedRows: Array<{ current_stock: number }> = Array.isArray(rawUpdate[0])
        ? rawUpdate[0]
        : rawUpdate;

      if (!updatedRows || updatedRows.length === 0) {
        throw new BadRequestException(
          `Estoque insuficiente para baixar produto ${item.produto_id} (qtd ${item.quantity}).`,
        );
      }

      // Preenche o saldo_resultante real no ledger.
      await manager.query(
        `UPDATE movimentacoes_estoque_historico SET saldo_resultante = $2 WHERE id = $1`,
        [ledgerId, Number(updatedRows[0].current_stock)],
      );
    }
  }

  /**
   * Movimento manual (COMPRA/AJUSTE/PERDA/DEVOLUCAO). Ajusta current_stock e grava ledger.
   */
  async recordManualMovement(
    manager: EntityManager,
    tenantId: string,
    produtoId: string,
    tipo: LedgerTipo,
    delta: number,
    motivo: string | null,
    usuarioId: string | null,
  ): Promise<{ saldo_resultante: number }> {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new BadRequestException('Delta inválido para movimento manual.');
    }
    // Validacao sinal x tipo (chokepoint unico: cobre endpoint, criacao e callers internos).
    const exigePositivo = [LedgerTipo.COMPRA, LedgerTipo.DEVOLUCAO, LedgerTipo.INVENTARIO_INICIAL];
    if (exigePositivo.includes(tipo) && delta <= 0) {
      throw new BadRequestException(`Tipo ${tipo} exige delta positivo.`);
    }
    if (tipo === LedgerTipo.PERDA && delta >= 0) {
      throw new BadRequestException('PERDA exige delta negativo.');
    }
    // manager.query() com RETURNING retorna tupla [[linhas], rowCount] neste TypeORM+pg; unwrap obrigatorio antes de ler campos.
    const rawUpdate = await manager.query(
      `UPDATE movimentacoes_estoque
       SET current_stock = current_stock + $3, last_updated = now()
       WHERE tenant_id = $1 AND produto_id = $2 AND current_stock + $3 >= 0
       RETURNING current_stock`,
      [tenantId, produtoId, delta],
    );
    // manager.query() com RETURNING retorna tupla [[linhas], rowCount] neste TypeORM+pg; unwrap obrigatorio antes de ler campos.
    const updatedRows: Array<{ current_stock: number }> = Array.isArray(rawUpdate[0])
      ? rawUpdate[0]
      : rawUpdate;
    if (!updatedRows || updatedRows.length === 0) {
      throw new UnprocessableEntityException({
        code: 'INSUFFICIENT_STOCK',
        message: 'Estoque insuficiente para esta saída.',
      });
    }
    const saldo = Number(updatedRows[0].current_stock);
    await manager
      .getRepository(MovimentacaoEstoqueHistorico)
      .insert({
        tenant_id: tenantId,
        produto_id: produtoId,
        tipo,
        delta,
        saldo_resultante: saldo,
        motivo,
        order_id: null,
        usuario_id: usuarioId,
      });
    return { saldo_resultante: saldo };
  }

  private assertQty(qty: number): void {
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new BadRequestException('Quantidade inválida para operação de estoque.');
    }
  }
}
