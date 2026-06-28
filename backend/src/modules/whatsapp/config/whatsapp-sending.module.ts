import { Module } from '@nestjs/common';
import { TenantsModule } from '../../tenants/tenants.module';
import { CommonModule } from '../../common/common.module';
import { CloudApiProvider } from '../providers/cloud-api.provider';
import { EvolutionApiProvider } from '../providers/evolution-api.provider';
import { MockWhatsappProvider } from '../providers/mock-whatsapp.provider';
import { WhatsappConfigResolver } from './whatsapp-config.resolver';
import { WhatsappSender } from './whatsapp-sender.service';

/**
 * Modulo LEVE de envio de WhatsApp tenant-aware (R2).
 *
 * Isolado de proposito para ser importado tanto pelo WhatsappModule (bot)
 * quanto pelo NotificationsModule (notificacoes de pedido) SEM criar
 * dependencia circular — ele so depende de Tenants + Common, que sao folhas.
 *
 * Provê o `WhatsappSender`: ponto unico para enviar mensagem pelo canal do
 * tenant correto.
 */
@Module({
  imports: [TenantsModule, CommonModule],
  providers: [
    CloudApiProvider,
    EvolutionApiProvider,
    MockWhatsappProvider,
    WhatsappConfigResolver,
    WhatsappSender,
  ],
  exports: [WhatsappSender, WhatsappConfigResolver, CloudApiProvider],
})
export class WhatsappSendingModule {}
