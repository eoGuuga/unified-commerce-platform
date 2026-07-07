import { WhatsAppCartController } from './whatsapp-cart.controller';

/**
 * Camada 4: os eventos de auditoria saem pelo StructuredLogger (nao console cru),
 * para que (a) o SECURITY_VIOLATION vire "level":"error" e chegue no app-alert do
 * Telegram, e (b) o details tenha a PII (ex.: ip) sanitizada antes de logar.
 */
describe('WhatsAppCartController — auditoria estruturada + PII sanitizada (LGPD)', () => {
  function makeController() {
    // 3 deps (cart/tenants/products) nao sao usadas pelos metodos de auditoria.
    return new (WhatsAppCartController as any)({}, {}, {});
  }

  afterEach(() => jest.restoreAllMocks());

  it('SECURITY_VIOLATION vai pro logger.error (level=error -> app-alert), nao pro console cru', () => {
    const controller = makeController();
    const errorSpy = jest
      .spyOn((controller as any).logger, 'error')
      .mockImplementation(() => undefined);
    const consoleErrSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    (controller as any).auditSecurityViolation('u-1', 't-owned', 't-attempted', 'TENANT_MISMATCH');

    expect(errorSpy).toHaveBeenCalled(); // estruturado -> "level":"error" -> alerta
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain('[SECURITY_VIOLATION]');
    expect(logged).toContain('TENANT_MISMATCH');
    expect(consoleErrSpy).not.toHaveBeenCalled(); // nao usa mais console cru
  });

  it('AUDIT sanitiza o IP no details — NAO vaza o IP completo, grava o mascarado', () => {
    const controller = makeController();
    const logSpy = jest
      .spyOn((controller as any).logger, 'log')
      .mockImplementation(() => undefined);
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const FULL_IP = '203.0.113.42';

    (controller as any).auditLog('SYSTEM', 'SYSTEM', 'IP_BLOCKED', { ip: FULL_IP });

    expect(logSpy).toHaveBeenCalled();
    const logged = JSON.stringify(logSpy.mock.calls) + JSON.stringify(consoleLogSpy.mock.calls);
    expect(logged).not.toContain(FULL_IP); // IP completo NAO vaza
    expect(logged).toContain('203.0.*.*'); // versao mascarada aparece
  });
});
