import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn } from 'typeorm';

export enum TipoDesconto {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

@Entity('cupons_desconto')
@Index(['tenant_id'])
@Index(['code'])
export class CupomDesconto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column({ length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 20 })
  discount_type: TipoDesconto;

  @Column('decimal', { precision: 10, scale: 2 })
  discount_value: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  min_purchase_amount?: number | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  max_discount_amount?: number | null;

  @Column('int', { nullable: true })
  usage_limit?: number | null;

  @Column('int', { default: 0 })
  used_count: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', nullable: true })
  valid_from?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  valid_until?: Date | null;

  @CreateDateColumn()
  created_at: Date;
}

