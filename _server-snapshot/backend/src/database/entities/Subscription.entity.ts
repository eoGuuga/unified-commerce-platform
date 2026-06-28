import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum PlanType {
  FREE = 'free',
  STARTER = 'starter',
  GROW = 'grow',
  SCALE = 'scale',
}

@Entity('subscriptions')
export class Subscription {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  tenant_id: string;

  @Column({ type: 'enum', enum: PlanType, default: PlanType.FREE })
  plan: PlanType;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'date', nullable: true })
  expires_at: Date;

  @Column({ type: 'int', default: 0 })
  products_count: number;

  @Column({ type: 'int', default: 0 })
  users_count: number;

  @Column({ type: 'int', default: 0 })
  orders_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
