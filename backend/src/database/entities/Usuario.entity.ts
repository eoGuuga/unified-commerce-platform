import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from './Tenant.entity';

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  SELLER = 'seller',
  SUPPORT = 'support',
}

@Entity('usuarios')
@Index(['tenant_id'])
@Index(['tenant_id', 'email'], { unique: true })
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.usuarios, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ length: 255 })
  email: string;

  @Column({ length: 255 })
  encrypted_password: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: UserRole.SELLER,
  })
  role: UserRole;

  @Column({ length: 255, nullable: true })
  full_name?: string;

  @Column({ length: 20, nullable: true })
  phone?: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_login?: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
