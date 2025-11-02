import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  UpdateDateColumn,
  JoinColumn,
  Unique,
  Index,
  Check,
} from 'typeorm';
import { Tenant } from './Tenant.entity';
import { Produto } from './Produto.entity';

@Entity('movimentacoes_estoque')
@Unique(['tenant_id', 'produto_id'])
@Index(['tenant_id'])
@Check('current_stock >= 0')
@Check('reserved_stock >= 0')
export class MovimentacaoEstoque {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column('uuid')
  produto_id: string;

  @ManyToOne(() => Produto, (produto) => produto.estoque, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'produto_id' })
  produto: Produto;

  @Column('int', { default: 0 })
  current_stock: number;

  @Column('int', { default: 0 })
  reserved_stock: number;

  @Column('int', { default: 0 })
  min_stock: number;

  @UpdateDateColumn()
  last_updated: Date;
}
