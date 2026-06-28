import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { MovimentacaoEstoque } from '../../database/entities/MovimentacaoEstoque.entity';

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

  private assertQty(qty: number): void {
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new BadRequestException('Quantidade inválida para operação de estoque.');
    }
  }
}
