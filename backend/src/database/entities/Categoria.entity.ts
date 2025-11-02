import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Produto } from './Produto.entity';

@Entity('categorias')
@Index(['tenant_id'])
export class Categoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column({ length: 255 })
  name: string;

  @Column('text', { nullable: true })
  description?: string;

  @CreateDateColumn()
  created_at: Date;

  // Relações
  @OneToMany(() => Produto, (produto) => produto.categoria)
  produtos: Produto[];
}
