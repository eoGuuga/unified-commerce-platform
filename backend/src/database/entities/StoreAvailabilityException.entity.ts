import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
  Index,
  Check,
} from 'typeorm';
import { Tenant } from './Tenant.entity';

export enum StoreExceptionKind {
  CLOSED = 'closed',
  CUSTOM_HOURS = 'custom_hours',
}

/**
 * Camada 2 — exceçao pontual de disponibilidade da loja (por-data).
 * Sobrepoe a Camada 1 (business_hours recorrente do tenant) SO na data indicada:
 *  - `closed`       => a loja nao atende retirada nessa data (open/close NULL).
 *  - `custom_hours` => horario especial (open/close obrigatorios).
 * `date` e a DATA CIVIL no fuso da loja (nao UTC) — chave de junçao com o loop do bot.
 */
@Entity('store_availability_exceptions')
@Unique('uq_exception_tenant_date', ['tenant_id', 'date'])
@Index(['tenant_id'])
@Check(
  'chk_exception_hours',
  `("kind" = 'closed' AND "open" IS NULL AND "close" IS NULL) OR ` +
    `("kind" = 'custom_hours' AND "open" IS NOT NULL AND "close" IS NOT NULL)`,
)
export class StoreAvailabilityException {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column('date')
  date: string;

  @Column({ type: 'enum', enum: StoreExceptionKind })
  kind: StoreExceptionKind;

  @Column('time', { nullable: true })
  open: string | null;

  @Column('time', { nullable: true })
  close: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
