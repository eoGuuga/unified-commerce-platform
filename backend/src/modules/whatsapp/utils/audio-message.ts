/**
 * Helpers para mensagens de audio recebidas pelo bot. Quando o provider
 * (Evolution / Twilio) entrega transcricao automatica, o texto vem com
 * muitas muletas linguisticas que prejudicam o matching de intent.
 *
 * Funcoes puras.
 */

/**
 * Subset minimo da interface WhatsappMessage (definida em whatsapp.service.ts).
 * Mantemos local pra evitar dependencia circular entre util e service.
 */
type AudioMessageLike = {
  body?: string;
  messageType?: 'text' | 'image' | 'document' | 'button' | 'audio';
  metadata?: Record<string, unknown>;
};
type WhatsappMessage = AudioMessageLike;

/**
 * True se a mensagem foi originada de audio (ou marcada como tal pelo
 * provider via metadata).
 */
export function looksLikeAudioTranscription(
  message?: WhatsappMessage,
): boolean {
  if (!message) {
    return false;
  }

  if (message.messageType === 'audio') {
    return true;
  }

  const metadata = (message.metadata || {}) as Record<string, unknown>;
  return Boolean(
    metadata.audio === true ||
      metadata.voice === true ||
      metadata.transcript ||
      metadata.transcription ||
      metadata.transcriptionSource,
  );
}

const AUDIO_FILLER_WORDS_RE =
  /\b(aham|ahn|ahn?m|hum+|hmm+|eh+|ehh+|tipo|assim|entao|ta bom|beleza|visse|viu|ne|oxe|oxente|uai|eita|vixe|vish|rapaz|mano|minha fia|meu fi|meu filho|minha filha|kkk+|rs+|rsrs+|hein|seguinte|patrao|chefia|parceiro|meu rei|minha rainha|moca|moco)\b/gi;

const AUDIO_FILLER_PHRASES_RE =
  /\b(queria ver se tem como|queria ver se|ve se tem como|ve se|sera que tem como|sera que da pra|deixa eu ver|deixa eu|deixa eu te falar|to querendo|estou querendo|negocio e o seguinte|me ajuda ai|me ajuda ae|faz favor|se tiver como|tem como)\b/gi;

// Zero-width chars frequentes em transcricoes: U+200B..U+200D + BOM.
const ZERO_WIDTH_CHARS_RE = new RegExp(
  '[' +
    String.fromCharCode(0x200b) +
    '-' +
    String.fromCharCode(0x200d) +
    String.fromCharCode(0xfeff) +
    ']',
  'g',
);

/**
 * Devolve o body da mensagem, limpando muletas e zero-width chars quando
 * a mensagem eh audio. Se for texto normal, retorna o body como esta.
 */
export function normalizeIncomingMessageBody(
  message: WhatsappMessage,
): string {
  let normalized = message.body || '';

  if (looksLikeAudioTranscription(message)) {
    normalized = normalized
      .replace(ZERO_WIDTH_CHARS_RE, ' ')
      .replace(AUDIO_FILLER_WORDS_RE, ' ')
      .replace(AUDIO_FILLER_PHRASES_RE, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return normalized;
}
