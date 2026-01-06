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

@Entity('webhook_events')
@Index(['status', 'next_retry_at'], { where: "status IN ('pending', 'retrying')" })
@Index(['tenant_id', 'source', 'received_at'])
@Index(['source', 'event_type', 'status'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  tenant_id?: string;

  @ManyToOne(() => Tenant, { nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;

  @Column({ type: 'varchar', length: 50 })
  source: string; // 'stripe', 'twilio', 'whatsapp', 'custom'

  @Column({ type: 'varchar', length: 100 })
  event_type: string; // 'payment_intent.succeeded', 'message.received'

  @Column('jsonb')
  payload: Record<string, any>;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';

  @Column('integer', { default: 0 })
  attempt_count: number;

  @Column('integer', { default: 3 })
  max_attempts: number;

  @Column('text', { nullable: true })
  error_message?: string;

  @Column('text', { nullable: true })
  error_stack?: string;

  @CreateDateColumn()
  received_at: Date;

  @Column('timestamp', { nullable: true })
  processed_at?: Date;

  @Column('timestamp', { nullable: true })
  next_retry_at?: Date;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;
}

