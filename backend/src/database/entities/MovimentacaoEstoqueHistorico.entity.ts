import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from './Tenant.entity';
import { Produto } from './Produto.entity';

export enum LedgerTipo {
  INVENTARIO_INICIAL = 'INVENTARIO_INICIAL',
  VENDA = 'VENDA',
  COMPRA = 'COMPRA',
  AJUSTE = 'AJUSTE',
  PERDA = 'PERDA',
  DEVOLUCAO = 'DEVOLUCAO',
}

/**
 * Ledger imutável de movimentações físicas de estoque (fonte da verdade).
 * Registra apenas mudanças de current_stock; reservas NÃO entram aqui.
 * Invariante: current_stock == soma(delta) por produto.
 */
@Entity('movimentacoes_estoque_historico')
@Index(['tenant_id', 'produto_id'])
export class MovimentacaoEstoqueHistorico {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column('uuid')
  produto_id: string;

  @ManyToOne(() => Produto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'produto_id' })
  produto: Produto;

  @Column({ type: 'enum', enum: LedgerTipo })
  tipo: LedgerTipo;

  @Column('int')
  delta: number;

  @Column('int')
  saldo_resultante: number;

  @Column('text', { nullable: true })
  motivo: string | null;

  @Column('uuid', { nullable: true })
  order_id: string | null;

  @Column('uuid', { nullable: true })
  usuario_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
