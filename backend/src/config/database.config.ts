import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Tenant } from '../database/entities/Tenant.entity';
import { Usuario } from '../database/entities/Usuario.entity';
import { Produto } from '../database/entities/Produto.entity';
import { Pedido } from '../database/entities/Pedido.entity';
import { ItemPedido } from '../database/entities/ItemPedido.entity';
import { MovimentacaoEstoque } from '../database/entities/MovimentacaoEstoque.entity';
import { Categoria } from '../database/entities/Categoria.entity';
import { UsageLog } from '../database/entities/UsageLog.entity';
import { IdempotencyKey } from '../database/entities/IdempotencyKey.entity';
import { WebhookEvent } from '../database/entities/WebhookEvent.entity';
import { WhatsappConversation } from '../database/entities/WhatsappConversation.entity';
import { WhatsappMessage } from '../database/entities/WhatsappMessage.entity';
import { AuditLog } from '../database/entities/AuditLog.entity';
import { Pagamento } from '../database/entities/Pagamento.entity';
import { CupomDesconto } from '../database/entities/CupomDesconto.entity';

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
      UsageLog,
      IdempotencyKey,
      WebhookEvent,
      WhatsappConversation,
      WhatsappMessage,
      AuditLog,
      Pagamento,
      CupomDesconto,
    ],
    synchronize: false, // Desabilitado - usar migrations
    logging: config.get('NODE_ENV') === 'development',
    ssl: config.get('DATABASE_URL')?.includes('supabase') ? { rejectUnauthorized: false } : false,
    extra: {
      statement_timeout: 30000, // 30 segundos
      query_timeout: 30000,
    },
  }),
};
