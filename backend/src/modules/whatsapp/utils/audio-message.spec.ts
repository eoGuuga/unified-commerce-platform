import {
  looksLikeAudioTranscription,
  normalizeIncomingMessageBody,
} from './audio-message';

describe('audio-message utils', () => {
  describe('looksLikeAudioTranscription', () => {
    it('true se messageType=audio', () => {
      expect(
        looksLikeAudioTranscription({
          body: 'oi',
          messageType: 'audio',
        }),
      ).toBe(true);
    });

    it('true via metadata.audio=true', () => {
      expect(
        looksLikeAudioTranscription({
          body: 'oi',
          metadata: { audio: true },
        }),
      ).toBe(true);
    });

    it('true via metadata.voice=true', () => {
      expect(
        looksLikeAudioTranscription({
          body: 'oi',
          metadata: { voice: true },
        }),
      ).toBe(true);
    });

    it('true via metadata.transcript / transcription / transcriptionSource', () => {
      expect(
        looksLikeAudioTranscription({
          body: 'oi',
          metadata: { transcript: 'whatever' },
        }),
      ).toBe(true);
      expect(
        looksLikeAudioTranscription({
          body: 'oi',
          metadata: { transcription: 'whatever' },
        }),
      ).toBe(true);
      expect(
        looksLikeAudioTranscription({
          body: 'oi',
          metadata: { transcriptionSource: 'whisper' },
        }),
      ).toBe(true);
    });

    it('false para mensagem de texto normal', () => {
      expect(
        looksLikeAudioTranscription({
          body: 'oi',
          messageType: 'text',
        }),
      ).toBe(false);
    });

    it('false para mensagem undefined', () => {
      expect(looksLikeAudioTranscription(undefined)).toBe(false);
    });

    it('false quando metadata existe mas nao tem flag relevante', () => {
      expect(
        looksLikeAudioTranscription({
          body: 'oi',
          metadata: { other: 'value' },
        }),
      ).toBe(false);
    });
  });

  describe('normalizeIncomingMessageBody', () => {
    it('retorna body inalterado para mensagem de texto', () => {
      expect(
        normalizeIncomingMessageBody({
          body: 'quero brigadeiro',
          messageType: 'text',
        }),
      ).toBe('quero brigadeiro');
    });

    it('retorna string vazia quando body ausente', () => {
      expect(normalizeIncomingMessageBody({ messageType: 'text' })).toBe('');
    });

    it('remove fillers de audio (aham, tipo, beleza, viu)', () => {
      const out = normalizeIncomingMessageBody({
        body: 'aham tipo queria brigadeiro beleza viu',
        messageType: 'audio',
      });
      expect(out).not.toContain('aham');
      expect(out).not.toContain('tipo');
      expect(out).not.toContain('beleza');
      expect(out).not.toContain('viu');
      expect(out).toContain('queria brigadeiro');
    });

    it('remove fillers de frase ("deixa eu ver", "tem como")', () => {
      const out = normalizeIncomingMessageBody({
        body: 'deixa eu ver, tem como mandar brigadeiro',
        messageType: 'audio',
      });
      expect(out).not.toContain('deixa eu ver');
      expect(out).not.toContain('tem como');
      expect(out).toContain('brigadeiro');
    });

    it('remove zero-width chars na transcricao', () => {
      const zwsp = String.fromCharCode(0x200b);
      const out = normalizeIncomingMessageBody({
        body: `quero${zwsp}brigadeiro`,
        messageType: 'audio',
      });
      expect(out).toBe('quero brigadeiro');
    });

    it('NAO aplica limpeza se nao for audio', () => {
      // texto normal mantem fillers (sao validos em mensagens digitadas)
      const out = normalizeIncomingMessageBody({
        body: 'aham, tipo, quero brigadeiro',
        messageType: 'text',
      });
      expect(out).toContain('aham');
    });

    it('colapsa whitespace depois de remover fillers', () => {
      const out = normalizeIncomingMessageBody({
        body: 'aham   tipo   brigadeiro',
        messageType: 'audio',
      });
      expect(out).not.toMatch(/\s{2,}/);
    });
  });
});
