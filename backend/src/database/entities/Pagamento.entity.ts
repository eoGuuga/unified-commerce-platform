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
import { Pedido } from './Pedido.entity';

export enum PagamentoStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum MetodoPagamento {
  DINHEIRO = 'dinheiro',
  PIX = 'pix',
  DEBITO = 'debito',
  CREDITO = 'credito',
  BOLETO = 'boleto',
}

@Entity('pagamentos')
@Index(['tenant_id'])
@Index(['pedido_id'])
@Index(['status'])
@Index(['transaction_id'], { unique: true, where: 'transaction_id IS NOT NULL' })
export class Pagamento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column('uuid')
  pedido_id: string;

  @ManyToOne(() => Pedido)
  @JoinColumn({ name: 'pedido_id' })
  pedido: Pedido;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  transaction_id?: string; // Stripe payment intent ID ou ID do provider

  @Column({
    type: 'varchar',
    length: 50,
    enum: MetodoPagamento,
  })
  method: MetodoPagamento;

  @Column({
    type: 'varchar',
    length: 50,
    enum: PagamentoStatus,
    default: PagamentoStatus.PENDING,
  })
  status: PagamentoStatus;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripe_payment_id?: string; // Link Stripe

  @Column('jsonb', { default: {} })
  metadata: {
    pix_qr_code?: string; // QR Code Pix em base64 ou string
    pix_qr_code_url?: string; // URL do QR Code
    pix_copy_paste?: string; // Chave Pix para copiar e colar
    boleto_url?: string; // URL do boleto
    boleto_barcode?: string; // Código de barras do boleto
    [key: string]: unknown; // Outros metadados específicos do provider
  };

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
