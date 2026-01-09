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

@Entity('idempotency_keys')
@Index(['tenant_id', 'operation_type', 'key_hash'], { unique: true })
@Index(['tenant_id', 'operation_type', 'created_at'])
@Index(['expires_at'])
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  key_hash: string;

  @Column({ type: 'varchar', length: 50 })
  operation_type: string; // 'create_order', 'process_payment', etc

  @Column('jsonb', { nullable: true })
  result: any; // TypeORM requer 'any' para JSONB genérico - tipado adequadamente nos serviços

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: 'pending' | 'completed' | 'failed';

  @CreateDateColumn()
  created_at: Date;

  @Column('timestamp')
  expires_at: Date;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>; // TypeORM requer 'any' para JSONB genérico
}

