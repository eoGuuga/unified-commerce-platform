import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Tenant } from '../database/entities/Tenant.entity';
import { Usuario } from '../database/entities/Usuario.entity';
import { Produto } from '../database/entities/Produto.entity';
import { Pedido } from '../database/entities/Pedido.entity';
import { ItemPedido } from '../database/entities/ItemPedido.entity';
import { MovimentacaoEstoque } from '../database/entities/MovimentacaoEstoque.entity';
import { Categoria } from '../database/entities/Categoria.entity';

export const databaseConfig: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    url: config.get('DATABASE_URL'),
    entities: [
      Tenant,
      Usuario,
      Categoria,
      Produto,
      MovimentacaoEstoque,
      Pedido,
      ItemPedido,
    ],
    synchronize: config.get('NODE_ENV') === 'development',
    logging: config.get('NODE_ENV') === 'development',
    ssl: config.get('DATABASE_URL')?.includes('supabase') ? { rejectUnauthorized: false } : false,
  }),
};
