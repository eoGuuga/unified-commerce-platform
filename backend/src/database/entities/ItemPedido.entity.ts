import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { Pedido } from './Pedido.entity';
import { Produto } from './Produto.entity';

@Entity('itens_pedido')
@Index(['pedido_id'])
@Index(['produto_id'])
export class ItemPedido {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  pedido_id: string;

  @ManyToOne(() => Pedido, (pedido) => pedido.itens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pedido_id' })
  pedido: Pedido;

  @Column('uuid')
  produto_id: string;

  @ManyToOne(() => Produto, (produto) => produto.itens_pedido)
  @JoinColumn({ name: 'produto_id' })
  produto: Produto;

  @Column('int')
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unit_price: number;

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  @CreateDateColumn()
  created_at: Date;
}
