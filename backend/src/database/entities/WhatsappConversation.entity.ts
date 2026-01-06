import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from './Tenant.entity';
import { Pedido } from './Pedido.entity';
import { WhatsappMessage } from './WhatsappMessage.entity';

@Entity('whatsapp_conversations')
@Index(['tenant_id', 'status'])
@Index(['customer_phone', 'tenant_id'])
@Index(['pedido_id'], { where: 'pedido_id IS NOT NULL' })
@Index(['tenant_id', 'status', 'last_message_at'], { 
  where: "status IN ('active', 'waiting_payment')" 
})
export class WhatsappConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 20 })
  customer_phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customer_name?: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: 'active' | 'waiting_payment' | 'order_placed' | 'completed' | 'abandoned';

  @Column('jsonb', { default: {} })
  context: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  pedido_id?: string;

  @ManyToOne(() => Pedido, { nullable: true })
  @JoinColumn({ name: 'pedido_id' })
  pedido?: Pedido;

  @CreateDateColumn()
  started_at: Date;

  @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
  last_message_at: Date;

  @Column('timestamp', { nullable: true })
  completed_at?: Date;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => WhatsappMessage, (message) => message.conversation)
  messages: WhatsappMessage[];
}

