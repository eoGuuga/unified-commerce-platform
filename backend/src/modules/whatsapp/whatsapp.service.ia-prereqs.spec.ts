import { WhatsappService } from './whatsapp.service';

/**
 * Pré-requisitos de SEGURANÇA da IA-vendedora (antes de mover a IA pro centro).
 *
 * O `whatsapp.service.ts` não tem spec dedicado; seguimos o padrão do
 * `whatsapp-outbound.spec.ts`: instanciar o service com deps undefined e injetar
 * só o que o método sob teste usa.
 */
function buildService(overrides: Record<string, unknown> = {}): any {
  const service: any = new (WhatsappService as any)(...new Array(40).fill(undefined));
  Object.assign(service, overrides);
  return service;
}

/**
 * FIX 1 — FSM MORTO: `handleCollectionStage` tinha um switch legado por
 * `context.state` (inalcançável — nada seta `state='collecting_name'`) cujo
 * branch `confirming_order` respondia "✅ Pedido confirmado!" SEM chamar
 * `ordersService.create`. Um fake-confirmation latente. O único caminho vivo é
 * a delegação à FSM de ferro (`handleCheckoutStage`), que cria o pedido de
 * verdade só após confirmação.
 */
describe('WhatsappService — Fix 1: handleCollectionStage sem fake-confirmation', () => {
  it('🎯 estado confirming_order + "sim" NÃO responde "Pedido confirmado" nem cria pedido', async () => {
    const ordersCreate = jest.fn();
    const service = buildService({
      conversationService: { updateContext: jest.fn().mockResolvedValue(undefined) },
      ordersService: { create: ordersCreate },
    });

    // Sem checkout ativo → handleCheckoutStage (real) retorna null → antes caía
    // no switch legado; o estado confirming_order dispararia o fake-confirm.
    const conversation: any = { id: 'c1', context: { state: 'confirming_order' } };
    const res = await service.handleCollectionStage('t1', 'sim', conversation);

    expect(String(res)).not.toContain('Pedido confirmado');
    expect(ordersCreate).not.toHaveBeenCalled();
  });

  it('preserva a delegação VIVA: se a FSM de checkout responde, retorna essa resposta', async () => {
    const service = buildService();
    service.handleCheckoutStage = jest.fn().mockResolvedValue('Qual é o seu nome?');

    const conversation: any = { id: 'c1', context: { checkout: { stage: 'collecting_name' } } };
    const res = await service.handleCollectionStage('t1', 'Ana', conversation);

    expect(res).toBe('Qual é o seu nome?');
    expect(service.handleCheckoutStage).toHaveBeenCalledTimes(1);
  });
});

/**
 * FIX 2 — TIMEOUT NÃO LIMPA O CHECKOUT: o timeout de 5min setava `state:'idle'`
 * mas deixava o `context.checkout` intacto. Como `detectIntent` checa
 * `checkout.stage` ANTES do state, um checkout velho ressuscitava e sequestrava
 * o próximo turno (a IA/os handlers nunca assumiam). Fix: zerar `checkout` no
 * updateContext do timeout.
 */
describe('WhatsappService — Fix 2: timeout limpa o checkout (não ressuscita)', () => {
  it('🎯 após timeout, o updateContext zera o checkout (state:idle + checkout:null)', async () => {
    const updateContext = jest.fn().mockResolvedValue(undefined);
    const getOrCreateConversation = jest.fn();
    const staleConversation = {
      id: 'conv1',
      last_message_at: new Date(Date.now() - 10 * 60 * 1000), // 10 min atrás (> 5)
      context: {
        state: 'collecting_order',
        checkout: { stage: 'confirming_address' }, // checkout velho a ser limpo
        customer_data: { name: 'Ana' },
      },
    };
    const service = buildService({
      tenantsService: { findOneById: jest.fn().mockResolvedValue({ id: 't1' }) },
      messageProcessor: {
        processMessage: () => ({
          sanitizedBody: 'oi',
          normalizedBody: 'oi',
          containsAbusiveLanguage: false,
          isGroupOrBroadcast: false,
          metadata: {},
          signature: 'sig',
        }),
      },
      conversationService: {
        db: { getRepository: () => ({ findOne: jest.fn().mockResolvedValue(staleConversation) }) },
        updateContext,
        getOrCreateConversation,
      },
      MAX_MESSAGE_LENGTH: 4096,
    });
    // Curto-circuita os gates ANTES do timeout (não são o foco).
    service.isGroupOrBroadcastMessage = () => false;
    service.isIgnoredInboundPhone = () => false;
    service.tryHandleBotControlCommand = jest.fn().mockResolvedValue(null);

    const res = await service.processIncomingMessage({
      tenantId: 't1',
      from: '5511999998888',
      body: 'oi',
      type: 'text',
    } as any);

    // O timeout disparou (mensagem de boas-vindas) E limpou o checkout.
    expect(String(res)).toContain('Que bom que você voltou');
    expect(updateContext).toHaveBeenCalledWith(
      'conv1',
      expect.objectContaining({ state: 'idle', checkout: null }),
    );
    // Retornou no timeout — não seguiu pro fluxo normal.
    expect(getOrCreateConversation).not.toHaveBeenCalled();
  });
});
