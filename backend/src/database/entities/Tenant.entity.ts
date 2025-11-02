import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Usuario } from './Usuario.entity';
import { Produto } from './Produto.entity';

@Entity('tenants')
@Index(['slug'], { unique: true })
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100, unique: true })
  slug: string;

  @Column({ type: 'uuid', nullable: true })
  owner_id?: string;

  @Column('jsonb', { default: {} })
  settings: Record<string, any>;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relações
  @OneToMany(() => Usuario, (usuario) => usuario.tenant)
  usuarios: Usuario[];

  @OneToMany(() => Produto, (produto) => produto.tenant)
  produtos: Produto[];
}
