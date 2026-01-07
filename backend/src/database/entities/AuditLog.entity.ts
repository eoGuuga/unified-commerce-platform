import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_log')
@Index(['tenant_id', 'created_at'])
@Index(['user_id', 'created_at'])
@Index(['table_name', 'record_id'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column('uuid', { nullable: true })
  user_id?: string;

  @Column({ length: 100 })
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';

  @Column({ length: 50 })
  table_name: string;

  @Column('uuid', { nullable: true })
  record_id?: string;

  @Column('jsonb', { nullable: true })
  old_data?: Record<string, any>;

  @Column('jsonb', { nullable: true })
  new_data?: Record<string, any>;

  @Column({ length: 50, nullable: true })
  ip_address?: string;

  @Column('text', { nullable: true })
  user_agent?: string;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;
}
