import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from './Tenant.entity';
import { Categoria } from './Categoria.entity';
import { ItemPedido } from './ItemPedido.entity';
import { MovimentacaoEstoque } from './MovimentacaoEstoque.entity';

@Entity('produtos')
@Index(['tenant_id', 'sku'], { unique: true })
@Index(['tenant_id', 'is_active'])
export class Produto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'uuid', nullable: true })
  categoria_id?: string;

  @ManyToOne(() => Categoria, { nullable: true })
  @JoinColumn({ name: 'categoria_id' })
  categoria?: Categoria;

  @Column({ length: 100, nullable: true })
  sku?: string;

  @Column({ length: 255 })
  name: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  cost_price?: number;

  @Column({ length: 50, default: 'unidade' })
  unit: string;

  @Column({ default: true })
  is_active: boolean;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relações
  @OneToMany(() => ItemPedido, (item) => item.produto)
  itens_pedido: ItemPedido[];

  @OneToMany(() => MovimentacaoEstoque, (estoque) => estoque.produto)
  estoque: MovimentacaoEstoque[];
}
