import { ForbiddenException } from '@nestjs/common';
import { TenantsService } from './tenants.service';

/**
 * LGPD: a mensagem da ForbiddenException de "numero nao autorizado" e (a) devolvida
 * na resposta 4xx ao cliente e (b) logada pelo http-exception.filter no nivel warn
 * (a mascara do filtro so cobre >=500). Entao o telefone TEM que ir mascarado ali
 * tambem — senao a mascara do log (:159) reaparece cru por este caminho.
 */
describe('TenantsService — nao vaza telefone na mensagem da excecao (LGPD)', () => {
  function makeService() {
    return new (TenantsService as any)({}); // dbContext nao usado (findOneById mockado)
  }

  it('numero NAO autorizado -> excecao com telefone MASCARADO (nem na resposta, nem no filtro)', async () => {
    const service = makeService();
    // tenant com um numero configurado diferente -> o phone do teste nao casa -> nao autorizado
    jest.spyOn(service as any, 'findOneById').mockResolvedValue({
      settings: { whatsappNumbers: ['5511111111111'] },
    });
    const FULL_PHONE = '5522999998888';

    await expect(
      (service as any).validateWhatsAppNumber('tenant-x', FULL_PHONE),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // a mensagem da excecao == o que vai pra resposta 4xx E pro warn do filtro
    let msg = '';
    try {
      await (service as any).validateWhatsAppNumber('tenant-x', FULL_PHONE);
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).not.toContain(FULL_PHONE); // telefone completo NAO aparece
    expect(msg).toContain('55****88'); // versao mascarada aparece
  });
});
