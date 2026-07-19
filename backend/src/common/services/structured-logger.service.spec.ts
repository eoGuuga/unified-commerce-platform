import { StructuredLogger } from './structured-logger.service';

/**
 * O StructuredLogger e o logger da app (main.ts). Em producao ele emite JSON
 * ({"level":...}) pro stdout/stderr. O contrato que estes testes travam:
 *  - debug/verbose NAO poluem prod por padrao (eram a fonte das ~8.6k linhas/7d);
 *  - LOG_LEVEL=debug religa debug/verbose em prod (para investigar);
 *  - error/warn/log seguem INTACTOS em prod — o app-alert Tier-1 grepa
 *    "level":"error", entao nao pode regredir.
 */
describe('StructuredLogger', () => {
  const OLD_ENV = process.env;
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.restoreAllMocks();
  });

  const parse = (spy: jest.SpyInstance, call = 0) =>
    JSON.parse((spy.mock.calls[call][0] as string).trim());

  describe('debug/verbose em producao', () => {
    it('(a) NAO emite debug em prod sem LOG_LEVEL', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.LOG_LEVEL;
      const logger = new StructuredLogger();

      logger.debug('Sweeper: 0 carrinho(s) expirado(s) em 0 tenant(s)');

      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    it('(a) NAO emite verbose em prod sem LOG_LEVEL', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.LOG_LEVEL;
      const logger = new StructuredLogger();

      logger.verbose('trace detalhado');

      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    it('(b) EMITE debug em prod quando LOG_LEVEL=debug', () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'debug';
      const logger = new StructuredLogger();

      logger.debug('Sweeper: 3 carrinho(s) expirado(s) em 1 tenant(s)');

      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      expect(parse(stdoutSpy)).toMatchObject({
        level: 'debug',
        message: 'Sweeper: 3 carrinho(s) expirado(s) em 1 tenant(s)',
      });
    });

    it('(b) EMITE verbose em prod quando LOG_LEVEL=debug', () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'debug';
      const logger = new StructuredLogger();

      logger.verbose('trace detalhado');

      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      expect(parse(stdoutSpy)).toMatchObject({ level: 'verbose', message: 'trace detalhado' });
    });
  });

  describe('(c) error/warn/log INTACTOS em prod (nao pode regredir)', () => {
    it('error vai pro stderr com level:error (o que o app-alert grepa)', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.LOG_LEVEL;
      const logger = new StructuredLogger();

      logger.error('boom');

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(parse(stderrSpy)).toMatchObject({ level: 'error', message: 'boom' });
    });

    it('warn e log emitem no stdout com os niveis certos, sem LOG_LEVEL', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.LOG_LEVEL;
      const logger = new StructuredLogger();

      logger.warn('cuidado');
      logger.log('rodando');

      expect(stdoutSpy).toHaveBeenCalledTimes(2);
      const levels = stdoutSpy.mock.calls.map((c) => JSON.parse((c[0] as string).trim()).level);
      expect(levels).toEqual(['warn', 'info']); // log() emite 'info'
    });
  });

  describe('getLogLevels (o filtro — precisa estar LIGADO, nao ser dead code)', () => {
    it('exclui debug/verbose em prod por padrao', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.LOG_LEVEL;
      expect(StructuredLogger.getLogLevels()).toEqual(['log', 'warn', 'error']);
    });

    it('inclui debug/verbose em prod quando LOG_LEVEL=debug', () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'debug';
      expect(StructuredLogger.getLogLevels()).toContain('debug');
      expect(StructuredLogger.getLogLevels()).toContain('verbose');
    });

    it('inclui tudo fora de producao', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.LOG_LEVEL;
      expect(StructuredLogger.getLogLevels()).toEqual(['log', 'warn', 'error', 'debug', 'verbose']);
    });
  });
});
