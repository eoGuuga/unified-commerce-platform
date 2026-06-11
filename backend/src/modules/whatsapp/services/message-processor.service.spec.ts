import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MessageProcessorService, ProcessedMessage } from './message-processor.service';

describe('MessageProcessorService', () => {
  let service: MessageProcessorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageProcessorService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<MessageProcessorService>(MessageProcessorService);
  });

  describe('processMessage', () => {
    it('should normalize and sanitize message body', () => {
      const message = {
        body: '  Olá Mundo!  \n\n  Como vai?  ',
        from: '5511999999999',
      };

      const result = service.processMessage(message);

      expect(result.sanitizedBody).toBe('Olá Mundo! Como vai?');
      expect(result.normalizedBody).toContain('Olá');
    });

    it('should detect group or broadcast messages', () => {
      const groupMessage = {
        body: 'Hello from group',
        from: '5511999999999-123456@g.us',
      };

      const result = service.processMessage(groupMessage as any);

      expect(result.isGroupOrBroadcast).toBe(true);
    });

    it('should detect abusive language', () => {
      const abusiveMessage = {
        body: 'This is shit!',
        from: '5511999999999',
      };

      const result = service.processMessage(abusiveMessage as any);

      expect(result.containsAbusiveLanguage).toBe(true);
    });

    it('should detect phone number in message', () => {
      const message = {
        body: 'Meu número é 11999998888',
        from: '5511999999999',
      };

      const result = service.processMessage(message as any);

      expect(result.metadata.hasPhoneNumber).toBe(true);
    });

    it('should detect address keywords', () => {
      const message = {
        body: 'Entregar na rua das flores, 123, bairro Esperança',
        from: '5511999999999',
      };

      const result = service.processMessage(message as any);

      expect(result.metadata.hasAddressKeywords).toBe(true);
    });

    it('should build unique signature', () => {
      const message1 = { body: 'Olá', from: '5511999999999' };
      const message2 = { body: 'Olá', from: '5511999999999' };
      const message3 = { body: 'Oi', from: '5511999999999' };

      const result1 = service.processMessage(message1 as any);
      const result2 = service.processMessage(message2 as any);
      const result3 = service.processMessage(message3 as any);

      expect(result1.signature).toBe(result2.signature);
      expect(result1.signature).not.toBe(result3.signature);
    });
  });

  describe('validateMessage', () => {
    it('should return valid for non-empty message', () => {
      const result = service.validateMessage('Olá mundo');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for empty message', () => {
      const result = service.validateMessage('');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('vazia');
    });

    it('should return invalid for message exceeding max length', () => {
      const longMessage = 'a'.repeat(5000);
      const result = service.validateMessage(longMessage, 4096);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('muito longa');
    });
  });

  describe('shouldIgnore', () => {
    it('should not ignore regular messages', () => {
      const result = service.shouldIgnore(false, false, false);

      expect(result.ignore).toBe(false);
    });

    it('should ignore group messages', () => {
      const result = service.shouldIgnore(true, false, false);

      expect(result.ignore).toBe(true);
      expect(result.reason).toContain('grupo');
    });

    it('should ignore own messages', () => {
      const result = service.shouldIgnore(false, true, false);

      expect(result.ignore).toBe(true);
      expect(result.reason).toContain('própria');
    });

    it('should not ignore bot control from own message', () => {
      const result = service.shouldIgnore(false, true, true);

      expect(result.ignore).toBe(false);
    });
  });

  describe('isBotControlCommand', () => {
    it('should detect bot control commands', () => {
      expect(service.isBotControlCommand('#bot X on')).toBe(true);
      expect(service.isBotControlCommand('bot X off')).toBe(true);
      expect(service.isBotControlCommand('#bot ABC status')).toBe(true);
    });

    it('should reject non-bot commands', () => {
      expect(service.isBotControlCommand('Olá')).toBe(false);
      expect(service.isBotControlCommand('#bot')).toBe(false);
      expect(service.isBotControlCommand('on')).toBe(false);
    });
  });

  describe('parseBotControlCommand', () => {
    it('should parse on command', () => {
      const result = service.parseBotControlCommand('#bot SECRET ligar');

      expect(result.matched).toBe(true);
      expect(result.code).toBe('SECRET');
      expect(result.action).toBe('on');
    });

    it('should parse off command', () => {
      const result = service.parseBotControlCommand('bot SECRET desligar');

      expect(result.matched).toBe(true);
      expect(result.code).toBe('SECRET');
      expect(result.action).toBe('off');
    });

    it('should parse status command', () => {
      const result = service.parseBotControlCommand('#bot SECRET status');

      expect(result.matched).toBe(true);
      expect(result.code).toBe('SECRET');
      expect(result.action).toBe('status');
    });

    it('should return unmatched for invalid commands', () => {
      const result = service.parseBotControlCommand('Olá mundo');

      expect(result.matched).toBe(false);
    });
  });
});