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
import { Usuario } from './Usuario.entity';
import { ItemPedido } from './ItemPedido.entity';

export enum PedidoStatus {
  PENDENTE_PAGAMENTO = 'pendente_pagamento',
  CONFIRMADO = 'confirmado',
  EM_PRODUCAO = 'em_producao',
  PRONTO = 'pronto',
  EM_TRANSITO = 'em_transito',
  ENTREGUE = 'entregue',
  CANCELADO = 'cancelado',
}

export enum CanalVenda {
  PDV = 'pdv',
  ECOMMERCE = 'ecommerce',
  WHATSAPP = 'whatsapp',
}

@Entity('pedidos')
@Index(['tenant_id'])
@Index(['order_no'], { unique: true })
@Index(['status'])
@Index(['created_at'])
export class Pedido {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ length: 50, unique: true })
  order_no: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: PedidoStatus.PENDENTE_PAGAMENTO,
  })
  status: PedidoStatus;

  @Column({
    type: 'varchar',
    length: 50,
  })
  channel: CanalVenda;

  @Column({ type: 'uuid', nullable: true })
  seller_id?: string;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'seller_id' })
  seller?: Usuario;

  // Dados do cliente
  @Column({ length: 255, nullable: true })
  customer_name?: string;

  @Column({ length: 255, nullable: true })
  customer_email?: string;

  @Column({ length: 20, nullable: true })
  customer_phone?: string;

  // Valores
  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discount_amount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  shipping_amount: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  coupon_code?: string;

  @Column('decimal', { precision: 10, scale: 2 })
  total_amount: number;

  // Entrega
  @Column('jsonb', { nullable: true })
  delivery_address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipcode: string;
  };

  @Column({ length: 50, nullable: true })
  delivery_type?: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relações
  @OneToMany(() => ItemPedido, (item) => item.pedido)
  itens: ItemPedido[];
}
