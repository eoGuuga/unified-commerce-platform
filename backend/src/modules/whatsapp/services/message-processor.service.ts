import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Tenant } from '../../../database/entities/Tenant.entity';

export interface ProcessedMessage {
  normalizedBody: string;
  sanitizedBody: string;
  isGroupOrBroadcast: boolean;
  containsAbusiveLanguage: boolean;
  isAudioTranscription: boolean;
  signature: string;
  metadata: {
    hasPhoneNumber: boolean;
    hasAddressKeywords: boolean;
    hasStateReference: boolean;
    isStandalonePhone: boolean;
  };
}

const ABUSE_PATTERNS = [
  /\b(piroca|caralho|merda|puta|filha da puta|cacete|bosta|foda|desgraça)\b/i,
  /\b(vai se foder|vsf|vsfdp)\b/i,
];

const ADDRESS_KEYWORDS = [
  'rua', 'avenida', 'av.', 'travessa', 'alameda', 'praça', 'praca',
  'bairro', 'cep', 'endereço', 'endereco', 'complemento',
];

const STATE_PATTERNS = /\b(SP|RJ|MG|ES|BA|PE|CE|PR|SC|RS|MT|DF|GO|MA|PI|PI|TO|AL|SE|AM|PA|AC|RO|RR|AP)\b/i;

@Injectable()
export class MessageProcessorService {
  private readonly logger = new Logger(MessageProcessorService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Processa mensagem de entrada e extrai informações
   */
  processMessage(message: { body: string; from: string; metadata?: Record<string, unknown> }): ProcessedMessage {
    const normalizedBody = this.normalizeIncomingMessageBody(message as any);
    const sanitizedBody = this.sanitizeInput(normalizedBody);

    return {
      normalizedBody,
      sanitizedBody,
      isGroupOrBroadcast: this.isGroupOrBroadcastMessage(message as any),
      containsAbusiveLanguage: this.containsAbusiveLanguage(sanitizedBody.toLowerCase()),
      isAudioTranscription: this.looksLikeAudioTranscription(message as any),
      signature: this.buildInboundSignature(sanitizedBody),
      metadata: {
        hasPhoneNumber: this.extractPhoneDigitsCandidate(sanitizedBody).length >= 10,
        hasAddressKeywords: this.hasAddressKeyword(sanitizedBody),
        hasStateReference: this.containsStateReference(sanitizedBody),
        isStandalonePhone: this.looksLikeStandalonePhoneMessage(sanitizedBody),
      },
    };
  }

  /**
   * Valida mensagem
   */
  validateMessage(sanitizedBody: string, maxLength: number = 4096): { valid: boolean; error?: string } {
    if (!sanitizedBody) {
      return { valid: false, error: 'Mensagem vazia ou inválida.' };
    }

    if (sanitizedBody.length > maxLength) {
      return {
        valid: false,
        error: `Mensagem muito longa. Máximo ${maxLength} caracteres.`,
      };
    }

    return { valid: true };
  }

  /**
   * Verifica se deve ignorar mensagem
   */
  shouldIgnore(
    isGroupOrBroadcast: boolean,
    isOwnMessage: boolean,
    isBotControlCommand: boolean,
  ): { ignore: boolean; reason?: string } {
    if (isGroupOrBroadcast) {
      return { ignore: true, reason: 'grupo ou broadcast ignorado' };
    }

    if (isOwnMessage && !isBotControlCommand) {
      return { ignore: true, reason: 'mensagem própria ignorada' };
    }

    return { ignore: false };
  }

  /**
   * Verifica se é comando de controle do bot
   */
  isBotControlCommand(messageBody: string): boolean {
    const normalized = String(messageBody || '').trim().toLowerCase();
    return /^#?bot\s+\S+\s+(ligar|desligar|status|on|off)$/i.test(normalized);
  }

  /**
   * Parse comando de controle do bot
   */
  parseBotControlCommand(message: string): {
    matched: boolean;
    code?: string;
    action?: 'status' | 'on' | 'off';
  } {
    const normalized = String(message || '').trim();
    const match = normalized.match(/^#?bot\s+(\S+)\s+(ligar|desligar|status|on|off)$/i);

    if (!match) {
      return { matched: false };
    }

    const actionToken = match[2].toLowerCase();
    const action =
      actionToken === 'ligar' || actionToken === 'on'
        ? 'on'
        : actionToken === 'desligar' || actionToken === 'off'
          ? 'off'
          : 'status';

    return {
      matched: true,
      code: match[1],
      action,
    };
  }

  // ============== MÉTODOS PRIVADOS ==============

  private normalizeIncomingMessageBody(message: any): string {
    // Check for audio transcription
    const transcriptionSources = [
      message.body,
      message.transcript,
      message.transcription,
      message.audioTranscription,
      message.audio?.transcription,
      message.media?.transcription,
    ].filter(Boolean);

    for (const source of transcriptionSources) {
      if (typeof source === 'string' && source.trim()) {
        return this.applyCommonChatNormalizations(source.trim());
      }
    }

    return this.applyCommonChatNormalizations(
      message.body ||
      message.text ||
      ''
    );
  }

  private applyCommonChatNormalizations(value: string): string {
    return value
      .replace(/[​-‍﻿]/g, '') // Zero-width chars
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private sanitizeInput(input: string, maxLength: number = 4096): string {
    return input
      .substring(0, maxLength)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
      .trim();
  }

  private isGroupOrBroadcastMessage(message: any): boolean {
    const chatType = this.readMetadataString(message, 'chatType').toLowerCase();
    const candidateJids = [
      String(message.from || '').trim(),
      this.readMetadataString(message, 'sourceJid'),
      this.readMetadataString(message, 'remoteJid'),
    ].filter(Boolean);

    const explicitGroupFlag =
      this.readMetadataBoolean(message, 'isGroupMessage') ||
      this.readMetadataBoolean(message, 'isGroup') ||
      chatType === 'group';
    const explicitBroadcastFlag =
      this.readMetadataBoolean(message, 'isBroadcastMessage') ||
      chatType === 'broadcast';

    return (
      explicitGroupFlag ||
      explicitBroadcastFlag ||
      candidateJids.some((jid) => jid.endsWith('@g.us') || jid === 'status@broadcast')
    );
  }

  private containsAbusiveLanguage(lowerMessage: string): boolean {
    for (const pattern of ABUSE_PATTERNS) {
      if (pattern.test(lowerMessage)) {
        return true;
      }
    }
    return false;
  }

  private looksLikeAudioTranscription(message: any): boolean {
    const body = String(message.body || '').toLowerCase();
    return (
      message.messageType === 'audio' ||
      message.metadata?.transcriptionSource === 'audio' ||
      (body.length > 0 && body.length < 500 && /[.!?]$/.test(body))
    );
  }

  private buildInboundSignature(value: string): string {
    const trimmed = (value || '').trim().toLowerCase();
    // Simple hash for deduplication
    let hash = 0;
    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private extractPhoneDigitsCandidate(message: string): string {
    const digitsOnly = message.replace(/\D/g, '');
    // Extract sequences of 10-11 digits (Brazilian phone)
    const match = digitsOnly.match(/\d{10,11}/);
    return match ? match[0] : '';
  }

  private hasAddressKeyword(text: string): boolean {
    const lower = text.toLowerCase();
    return ADDRESS_KEYWORDS.some((keyword) => lower.includes(keyword));
  }

  private containsStateReference(value: string): boolean {
    return STATE_PATTERNS.test(value);
  }

  private looksLikeStandalonePhoneMessage(message: string): boolean {
    const digitsOnly = message.replace(/\D/g, '');
    return (
      digitsOnly.length >= 10 &&
      digitsOnly.length <= 13 &&
      !/\D/.test(digitsOnly.slice(-11))
    );
  }

  private readMetadataString(message: any, key: string): string {
    const value = message.metadata?.[key];
    return typeof value === 'string' ? value.trim() : '';
  }

  private readMetadataBoolean(message: any, key: string): boolean {
    const value = message.metadata?.[key];
    return value === true || value === 'true' || value === 1 || value === '1';
  }
}