import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WhatsAppErrorHandler, ErrorContext } from './error-handler.service';

describe('WhatsAppErrorHandler', () => {
  let handler: WhatsAppErrorHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppErrorHandler,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(null),
          },
        },
      ],
    }).compile();

    handler = module.get<WhatsAppErrorHandler>(WhatsAppErrorHandler);
  });

  describe('handleError', () => {
    it('should handle connection refused error', () => {
      const error = new Error('ECONNREFUSED');
      const context: ErrorContext = { tenantId: 'tenant-1', customerPhone: '5511999999999' };

      const result = handler.handleError(error, context);

      expect(result.message).toContain('manutenção');
      expect(result.shouldRetry).toBe(true);
    });

    it('should handle timeout error', () => {
      const error = new Error('Connection timeout');
      const context: ErrorContext = { tenantId: 'tenant-1', customerPhone: '5511999999999' };

      const result = handler.handleError(error, context);

      expect(result.message).toContain('manutenção'); // copy atual do timeout
      expect(result.shouldRetry).toBe(true);
    });

    it('should handle out of stock error', () => {
      const error = new Error('Product out of stock');
      const context: ErrorContext = { tenantId: 'tenant-1', customerPhone: '5511999999999' };

      const result = handler.handleError(error, context);

      expect(result.message).toContain('fora de estoque');
      expect(result.shouldRetry).toBe(false);
    });

    it('should handle invalid input error', () => {
      const error = new Error('Validation error: invalid input');
      const context: ErrorContext = { tenantId: 'tenant-1', customerPhone: '5511999999999' };

      const result = handler.handleError(error, context);

      expect(result.message).toContain('Não entendi');
      expect(result.shouldRetry).toBe(false);
    });

    it('should handle AI timeout error', () => {
      const error = new Error('OpenAI timeout');
      const context: ErrorContext = { tenantId: 'tenant-1', customerPhone: '5511999999999' };

      const result = handler.handleError(error, context);

      expect(result.message).toContain('lenta'); // copy atual do AI-timeout: "A conexão está lenta…"
      expect(result.shouldRetry).toBe(true);
    });

    it('should handle payment failed error and escalate', () => {
      const error = new Error('Payment failed');
      const context: ErrorContext = { tenantId: 'tenant-1', customerPhone: '5511999999999' };

      const result = handler.handleError(error, context);

      expect(result.message).toContain('pagamento');
      expect(result.escalate).toBe(true);
    });

    it('should handle unknown error with fallback', () => {
      const error = new Error('Something went wrong');
      const context: ErrorContext = { tenantId: 'tenant-1', customerPhone: '5511999999999' };

      const result = handler.handleError(error, context);

      expect(result.message).toBeTruthy();
      expect(result.shouldRetry).toBe(false);
    });

    it('should include retry delay when shouldRetry is true', () => {
      const error = new Error('ECONNREFUSED');
      const context: ErrorContext = { tenantId: 'tenant-1', customerPhone: '5511999999999' };

      const result = handler.handleError(error, context);

      if (result.shouldRetry) {
        expect(result.retryAfterMs).toBeDefined();
        expect(result.retryAfterMs).toBeGreaterThan(0);
      }
    });
  });

  describe('executeWithRetry', () => {
    it('should return result on success', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const context: ErrorContext = { tenantId: 'tenant-1', customerPhone: '5511999999999' };

      const result = await handler.executeWithRetry(fn, context);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient error', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce('success');
      const context: ErrorContext = { tenantId: 'tenant-1', customerPhone: '5511999999999' };

      const result = await handler.executeWithRetry(fn, context);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const context: ErrorContext = { tenantId: 'tenant-1', customerPhone: '5511999999999' };

      await expect(handler.executeWithRetry(fn, context)).rejects.toThrow('ECONNREFUSED');
      expect(fn).toHaveBeenCalledTimes(3); // maxRetries = 3
    });

    it('should not retry non-transient errors', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Validation error'));
      const context: ErrorContext = { tenantId: 'tenant-1', customerPhone: '5511999999999' };

      await expect(handler.executeWithRetry(fn, context)).rejects.toThrow('Validation error');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce('success');
      const context: ErrorContext = { tenantId: 'tenant-1', customerPhone: '5511999999999' };
      const onRetry = jest.fn();

      await handler.executeWithRetry(fn, context, onRetry);

      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });
  });

  describe('executeWithFallback', () => {
    it('should return primary result on success', async () => {
      const primary = jest.fn().mockResolvedValue('primary');
      const fallback = jest.fn().mockResolvedValue('fallback');
      const context: ErrorContext = { tenantId: 'tenant-1', customerPhone: '5511999999999' };

      const result = await handler.executeWithFallback(primary, fallback, context);

      expect(result).toBe('primary');
      expect(fallback).not.toHaveBeenCalled();
    });

    it('should return fallback on error', async () => {
      const primary = jest.fn().mockRejectedValue(new Error('error'));
      const fallback = jest.fn().mockResolvedValue('fallback');
      const context: ErrorContext = { tenantId: 'tenant-1', customerPhone: '5511999999999' };

      const result = await handler.executeWithFallback(primary, fallback, context);

      expect(result).toBe('fallback');
      expect(fallback).toHaveBeenCalled();
    });
  });

  describe('generateFriendlyErrorMessage', () => {
    it('should generate friendly message for out of stock', () => {
      const message = handler.generateFriendlyErrorMessage('OUT_OF_STOCK');

      expect(message).toContain('fora de estoque'); // copy atual nao tem o CTA "cardápio" (obs. de produto registrada)
    });

    it('should generate friendly message for payment failed', () => {
      const message = handler.generateFriendlyErrorMessage('PAYMENT_FAILED');

      expect(message).toContain('pagamento');
      expect(message).toContain('outra forma');
    });

    it('should generate friendly message for rate limit', () => {
      const message = handler.generateFriendlyErrorMessage('RATE_LIMIT_EXCEEDED');

      expect(message).toContain('rápido');
    });
  });

  describe('error classification', () => {
    it('should classify network errors', () => {
      const errors = [
        new Error('connect ECONNREFUSED'),
        new Error('ETIMEDOUT'),
        new Error('Network error'),
      ];

      errors.forEach((error) => {
        const result = handler.handleError(error, {});
        expect(result.shouldRetry).toBe(true);
      });
    });

    it('should classify validation errors', () => {
      const errors = [
        new Error('validation failed'),
        new Error('invalid input'),
      ];

      errors.forEach((error) => {
        const result = handler.handleError(error, {});
        expect(result.shouldRetry).toBe(false);
      });
    });

    it('should classify coupon errors', () => {
      const errors = [
        new Error('coupon invalid'),
        new Error('coupon expired'),
        new Error('coupon already used'),
      ];

      errors.forEach((error) => {
        const result = handler.handleError(error, {});
        expect(result.shouldRetry).toBe(false);
      });
    });
  });
});