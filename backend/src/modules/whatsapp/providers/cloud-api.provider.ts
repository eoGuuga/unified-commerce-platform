import { Injectable, Logger } from '@nestjs/common';
import { maskPhone } from '../../../common/utils/mask.util';
import {
  CloudApiCredentials,
  DEFAULT_CLOUD_API_VERSION,
} from '../config/tenant-whatsapp-config';

/**
 * Provider da WhatsApp Business Cloud API (oficial da Meta).
 *
 * Diferente dos providers antigos, este e TENANT-AWARE: NAO guarda credenciais
 * no boot. Cada envio recebe as credenciais do tenant (`CloudApiCredentials`),
 * permitindo que cada cliente do SaaS use o proprio numero/token.
 *
 * Endpoint Meta: POST https://graph.facebook.com/{version}/{phoneNumberId}/messages
 */
@Injectable()
export class CloudApiProvider {
  private readonly logger = new Logger(CloudApiProvider.name);

  getProviderType(): 'cloud_api' {
    return 'cloud_api';
  }

  isUsable(creds?: CloudApiCredentials): boolean {
    return Boolean(creds?.phoneNumberId && creds?.accessToken);
  }

  /** Envia texto simples. Retorna o messageId da Meta. */
  async sendText(creds: CloudApiCredentials, to: string, body: string): Promise<string> {
    return this.post(creds, {
      messaging_product: 'whatsapp',
      to: this.formatPhone(to),
      type: 'text',
      text: { preview_url: false, body },
    });
  }

  /** Envia imagem por URL com legenda opcional (ex.: QR Code do PIX). */
  async sendImage(
    creds: CloudApiCredentials,
    to: string,
    imageUrl: string,
    caption?: string,
  ): Promise<string> {
    return this.post(creds, {
      messaging_product: 'whatsapp',
      to: this.formatPhone(to),
      type: 'image',
      image: { link: imageUrl, ...(caption ? { caption } : {}) },
    });
  }

  /**
   * Envia mensagem com botoes de resposta rapida (interactive reply buttons).
   * A Cloud API limita a 3 botoes; titulos a 20 chars.
   */
  async sendButtons(
    creds: CloudApiCredentials,
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>,
  ): Promise<string> {
    const actionButtons = buttons.slice(0, 3).map((b) => ({
      type: 'reply',
      reply: { id: b.id, title: b.title.slice(0, 20) },
    }));

    return this.post(creds, {
      messaging_product: 'whatsapp',
      to: this.formatPhone(to),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body },
        action: { buttons: actionButtons },
      },
    });
  }

  // ---- internals ----

  private async post(creds: CloudApiCredentials, payload: Record<string, unknown>): Promise<string> {
    if (!this.isUsable(creds)) {
      throw new Error('Cloud API: credenciais do tenant ausentes (phoneNumberId/accessToken).');
    }

    const version = creds.apiVersion || DEFAULT_CLOUD_API_VERSION;
    const url = `https://graph.facebook.com/${version}/${creds.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      // Sanitiza: nunca propagar token/credencial que por acaso volte no corpo do erro.
      const sanitized = errText
        .replace(/Bearer\s+[\w.\-]+/gi, 'Bearer [REDACTED]')
        .replace(/"access_token"\s*:\s*"[^"]*"/gi, '"access_token":"[REDACTED]"')
        .slice(0, 200);
      throw new Error(`Cloud API erro ${response.status}: ${sanitized}`);
    }

    const data = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
    };
    const messageId = data.messages?.[0]?.id || `cloud_${version}`;
    this.logger.log('Cloud API: mensagem enviada', { to: maskPhone(payload.to), messageId });
    return messageId;
  }

  /** Cloud API espera numero so com digitos, com codigo do pais (E.164 sem '+'). */
  private formatPhone(phone: string): string {
    return (phone || '').replace(/\D/g, '');
  }
}
