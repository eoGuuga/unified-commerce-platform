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

@Entity('usage_logs')
@Index(['tenant_id', 'created_at'])
@Index(['tenant_id', 'service_type', 'created_at'])
@Index(['reference_id', 'reference_type'], { where: 'reference_id IS NOT NULL' })
export class UsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 50 })
  service_type: string; // 'openai_tokens', 'whatsapp_msg', etc

  @Column('integer')
  quantity: number;

  @Column('decimal', { precision: 12, scale: 4, default: 0 })
  cost_estimated: number;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  reference_id?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  reference_type?: string; // 'order', 'conversation', 'payment'

  @CreateDateColumn()
  created_at: Date;
}

