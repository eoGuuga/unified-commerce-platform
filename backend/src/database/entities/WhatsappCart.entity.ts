import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export interface CartItem {
  produto_id: string;
  produto_name: string;
  quantity: number;
  unit_price: number;
}

@Entity('whatsapp_carts')
@Index(['tenant_id', 'customer_phone', 'status'])
@Index(['expires_at'], { where: "status = 'active'" })
export class WhatsAppCart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column({ type: 'varchar', length: 20 })
  customer_phone: string;

  @Column('jsonb', { default: [] })
  items: CartItem[];

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  coupon_code?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  shipping_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_amount: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: 'active' | 'converted' | 'abandoned' | 'expired';

  @Column('timestamp')
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

// Entidade para métricas de mensagens
@Entity('whatsapp_message_metrics')
@Index(['tenant_id', 'created_at'])
@Index(['customer_phone', 'created_at'])
export class WhatsAppMessageMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column({ type: 'varchar', length: 20 })
  customer_phone: string;

  @Column({ type: 'varchar', length: 100 })
  message_id: string;

  @Column({ type: 'varchar', length: 10 })
  direction: 'inbound' | 'outbound';

  @Column({ type: 'varchar', length: 20 })
  message_type: string;

  @Column({ type: 'int' })
  processing_time_ms: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  intent?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  action?: string;

  @Column({ type: 'boolean', default: true })
  success: boolean;

  @Column({ type: 'text', nullable: true })
  error_message?: string;

  @Column('timestamp')
  created_at: Date;
}

// Entidade para métricas de conversas
@Entity('whatsapp_conversation_metrics')
@Index(['tenant_id', 'started_at'])
export class WhatsAppConversationMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  conversation_id: string;

  @Column('uuid')
  tenant_id: string;

  @Column({ type: 'varchar', length: 20 })
  customer_phone: string;

  @Column('timestamp')
  started_at: Date;

  @Column('timestamp', { nullable: true })
  ended_at?: Date;

  @Column({ type: 'int', default: 0 })
  message_count: number;

  @Column({ type: 'int', default: 0 })
  inbound_count: number;

  @Column({ type: 'int', default: 0 })
  outbound_count: number;

  @Column('jsonb', { default: {} })
  intent_distribution: Record<string, number>;

  @Column('jsonb', { default: {} })
  action_distribution: Record<string, number>;

  @Column('jsonb', { default: [] })
  conversion_events: string[];

  @Column({ type: 'varchar', length: 100, nullable: true })
  abandonment_point?: string;

  @Column({ type: 'int', default: 0 })
  average_response_time_ms: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

// Entidade para eventos de conversão
@Entity('whatsapp_conversion_events')
@Index(['tenant_id', 'converted_at'])
export class WhatsAppConversionEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column({ type: 'varchar', length: 20 })
  customer_phone: string;

  @Column({ type: 'varchar', length: 100 })
  cart_id: string;

  @Column({ type: 'uuid' })
  order_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  conversion_value: number;

  @Column('timestamp')
  converted_at: Date;

  @CreateDateColumn()
  created_at: Date;
}

// Entidade para eventos de abandono
@Entity('whatsapp_abandonment_events')
@Index(['tenant_id', 'abandoned_at'])
export class WhatsAppAbandonmentEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column({ type: 'varchar', length: 20 })
  customer_phone: string;

  @Column({ type: 'varchar', length: 100 })
  cart_id: string;

  @Column({ type: 'varchar', length: 100 })
  abandonment_point: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  cart_value: number;

  @Column('timestamp')
  abandoned_at: Date;

  @CreateDateColumn()
  created_at: Date;
}