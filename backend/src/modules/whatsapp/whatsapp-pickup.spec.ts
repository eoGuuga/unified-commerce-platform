/**
 * Teste do branch RETIRADA + agendamento + horario de funcionamento (S2b / Task 5).
 *
 * DOIS PONTOS DE LUPA:
 *  1) FUSO: a validacao do horario de retirada e feita no FUSO DA LOJA
 *     (business_hours.tz), NUNCA em UTC. 16:00 horario de Brasilia (= 19:00 UTC)
 *     esta DENTRO de 09:00-18:00 local e deve ser ACEITO. Um codigo que comparasse
 *     a hora UTC (19h) contra "fecha 18h" rejeitaria errado — esse e o bug que o
 *     teste de fuso pega.
 *  2) PORTA DA FRENTE: o branch retirada entra pelo ROTEADOR REAL
 *     (detectIntent -> processByIntent), nao chamando a FSM por baixo.
 *
 * DEFAULT RESTRITIVO: tenant SEM settings.business_hours -> o bot NAO oferece
 * retirada (fallback honesto "so entrega") e NAO cria pedido.
 *
 * Estrategia: instanciar WhatsAppService sem o DI do Nest, injetando apenas os
 * colaboradores tocados pelo fluxo (cartService, ordersService, paymentsService,
 * conversationService, tenantsService). O resto fica undefined.
 */
import { WhatsAppService } from './whatsapp.service';

function makeConversation() {
  return {
    id: 'conv-1',
    customer_name: undefined as string | undefined,
    customer_phone: '5511999999999',
    context: {} as Record<string, any>,
  };
}

// business_hours seg-sab 09:00-18:00 em America/Sao_Paulo (shape por-dia; dom AUSENTE = fechado).
const BUSINESS_HOURS = {
  tz: 'America/Sao_Paulo',
  days: {
    '1': { open: '09:00', close: '18:00' },
    '2': { open: '09:00', close: '18:00' },
    '3': { open: '09:00', close: '18:00' },
    '4': { open: '09:00', close: '18:00' },
    '5': { open: '09:00', close: '18:00' },
    '6': { open: '09:00', close: '18:00' },
  },
};

describe('Retirada + agendamento + horario de funcionamento (S2b)', () => {
  const tenantId = 'tenant-1';
  const phone = '5511999999999';
  let service: any;
  let conversation: ReturnType<typeof makeConversation>;
  let createSpy: jest.Mock;
  let tenant: any;

  beforeEach(() => {
    conversation = makeConversation();
    tenant = { id: tenantId, settings: { business_hours: BUSINESS_HOURS } };

    const cartService = {
      getOrCreateCart: jest.fn().mockResolvedValue({
        id: 'cart-1',
        items: [
          { produto_id: 'prod-1', produto_name: 'Brigadeiro', quantity: 2, unit_price: 5 },
        ],
        shipping_amount: 0,
        discount_amount: 0,
        coupon_code: null,
        total_amount: 10,
      }),
      markAsConverted: jest.fn().mockResolvedValue(undefined),
    };

    createSpy = jest.fn().mockResolvedValue({ id: 'order-123', total_amount: 10 });
    const ordersService = { create: createSpy };

    const paymentsService = {
      createPayment: jest.fn().mockResolvedValue({
        qr_code: 'data:image/png;base64,AAA',
        copy_paste: '000201BR',
        pagamento: { amount: 9.5 },
      }),
    };

    const conversationService = {
      updateContext: jest.fn().mockImplementation(async (_id: string, updates: Record<string, any>) => {
        conversation.context = { ...conversation.context, ...updates };
      }),
      getOrCreateConversation: jest.fn().mockResolvedValue(conversation),
    };

    const tenantsService = {
      findOneById: jest.fn().mockImplementation(async () => tenant),
    };

    const whatsappSender = { sendImage: jest.fn().mockResolvedValue(undefined) };

    const deps: any[] = new Array(30).fill(undefined);
    service = new (WhatsAppService as any)(...deps);
    service.cartService = cartService;
    service.ordersService = ordersService;
    service.paymentsService = paymentsService;
    service.conversationService = conversationService;
    service.tenantsService = tenantsService;
    service.whatsappSender = whatsappSender;
    service.catalogManager = { isCatalogCommand: () => false };
    service.logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn(), debug: jest.fn() };
  });

  async function start(): Promise<string> {
    return service.handleCheckout(tenantId, phone, conversation);
  }
  async function step(message: string): Promise<string> {
    return service.handleCollectionStage(tenantId, message, conversation);
  }

  // ============== PONTO DE LUPA 1: FUSO ==============
  describe('isWithinBusinessHours — comparacao no FUSO da loja (nao UTC)', () => {
    // 16:00 horario de Brasilia (-03:00) = 19:00 UTC. Uma segunda-feira.
    // 2026-06-29 e uma segunda-feira.
    it('16:00 horario de Brasilia (=19:00 UTC) em dia util e ACEITO (dentro de 09-18 local)', () => {
      // O instante: 2026-06-29T19:00:00.000Z == 16:00 em Sao Paulo.
      const scheduled = new Date('2026-06-29T19:00:00.000Z');
      expect(service.isWithinBusinessHours(scheduled, BUSINESS_HOURS)).toBe(true);
    });

    it('20:00 horario de Brasilia (=23:00 UTC) em dia util e RECUSADO (fora de 09-18 local)', () => {
      const scheduled = new Date('2026-06-29T23:00:00.000Z');
      expect(service.isWithinBusinessHours(scheduled, BUSINESS_HOURS)).toBe(false);
    });

    it('domingo (nao esta em days) e RECUSADO mesmo dentro do horario', () => {
      // 2026-06-28 e domingo. 16:00 local = 19:00 UTC.
      const scheduled = new Date('2026-06-28T19:00:00.000Z');
      expect(service.isWithinBusinessHours(scheduled, BUSINESS_HOURS)).toBe(false);
    });

    it('08:00 horario de Brasilia (=11:00 UTC) e RECUSADO (antes de abrir)', () => {
      const scheduled = new Date('2026-06-29T11:00:00.000Z');
      expect(service.isWithinBusinessHours(scheduled, BUSINESS_HOURS)).toBe(false);
    });
  });

  // ============== PONTO DE LUPA 2: PORTA DA FRENTE (roteador real) ==============
  describe('roteador (detectIntent/processByIntent) — branch retirada', () => {
    const route = async (body: string): Promise<string> => {
      const intent = service.detectIntent(body, conversation);
      const response = await service.processByIntent(intent, {
        message: { tenantId, from: phone, messageType: 'text' },
        processed: { sanitizedBody: body, normalizedBody: body.toLowerCase() },
        conversation,
        tenant,
      });
      return typeof response === 'string' ? response : (response?.previewText ?? '');
    };

    it('"retirada" com checkout ativo roteia pra coleta (collection), nao outro handler', async () => {
      await start();
      expect(conversation.context.checkout?.stage).toBe('ask_fulfillment');
      // "retirada" casaria nada de keyword obvio, mas o importante: vai pra collection.
      expect(service.detectIntent('retirada', conversation)).toBe('collection');
    });

    it('ponta-a-ponta: "finalizar"->"retirada"->nome->telefone->escolhe "2" da lista cria pedido pickup UMA vez', async () => {
      const r1 = await route('finalizar');
      expect(String(r1).toLowerCase()).toMatch(/entrega|retirada/);
      expect(conversation.context.checkout?.stage).toBe('ask_fulfillment');

      const r2 = await route('retirada');
      expect(String(r2).toLowerCase()).toMatch(/nome/);

      await route('Maria Souza');
      const rPhone = await route('11988887777');
      // Apresenta a LISTA numerada de horarios (nao pede texto livre).
      expect(String(rPhone).toLowerCase()).toMatch(/quando quer retirar|n[uú]mero/);
      expect(conversation.context.checkout?.stage).toBe('selecting_pickup_slot');
      expect(Array.isArray(conversation.context.checkout?.pickup_slots)).toBe(true);
      expect(conversation.context.checkout.pickup_slots.length).toBeGreaterThanOrEqual(2);

      // Captura o slot 2 ANTES de escolher para conferir o scheduled_at exato.
      const slot2Iso = conversation.context.checkout.pickup_slots[1].scheduled_at;

      // Cliente responde o NUMERO "2".
      await route('2');

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          delivery_type: 'pickup',
          customer_name: 'Maria Souza',
          scheduled_at: new Date(slot2Iso),
        }),
        tenantId,
      );
    });

    it('escolha invalida ("9" fora da lista) -> re-mostra a lista, NAO cria pedido', async () => {
      await route('finalizar');
      await route('retirada');
      await route('Maria Souza');
      await route('11988887777');
      const slotsLen = conversation.context.checkout.pickup_slots.length;
      // "9" so e invalido se a lista tiver menos de 9 itens; garante isso e ainda
      // testa "abacaxi" (texto) que e invalido sempre.
      const r = await route(String(slotsLen + 1));
      expect(createSpy).not.toHaveBeenCalled();
      expect(String(r).toLowerCase()).toMatch(/n[uú]mero|quando quer retirar/);
      expect(conversation.context.checkout?.stage).toBe('selecting_pickup_slot');

      const r2 = await route('abacaxi');
      expect(createSpy).not.toHaveBeenCalled();
      expect(String(r2).toLowerCase()).toMatch(/n[uú]mero|quando quer retirar/);
      expect(conversation.context.checkout?.stage).toBe('selecting_pickup_slot');
    });
  });

  // ============== DEFAULT RESTRITIVO ==============
  describe('default restritivo — tenant SEM business_hours', () => {
    const route = async (body: string): Promise<string> => {
      const intent = service.detectIntent(body, conversation);
      const response = await service.processByIntent(intent, {
        message: { tenantId, from: phone, messageType: 'text' },
        processed: { sanitizedBody: body, normalizedBody: body.toLowerCase() },
        conversation,
        tenant,
      });
      return typeof response === 'string' ? response : (response?.previewText ?? '');
    };

    it('tenant sem business_hours: escolher "retirada" -> fallback "so entrega", pedido NAO criado, FSM encerrada', async () => {
      tenant = { id: tenantId, settings: {} }; // sem business_hours

      await route('finalizar');
      const r = await route('retirada');

      expect(createSpy).not.toHaveBeenCalled();
      expect(String(r).toLowerCase()).toMatch(/entrega/);
      // FSM encerrada (estado idle, checkout limpo).
      expect(conversation.context.checkout).toBeFalsy();
      expect(conversation.context.state).toBe('idle');
    });
  });

  // ============== Direto na FSM (cobertura do fluxo completo) ==============
  it('FSM direta: retirada -> escolhe slot 1 cria pedido pickup com scheduled_at (Date)', async () => {
    await start();
    await step('retirada');
    await step('Maria Souza');
    const rPhone = await step('11988887777');
    expect(String(rPhone).toLowerCase()).toMatch(/quando quer retirar|n[uú]mero/);
    expect(conversation.context.checkout?.stage).toBe('selecting_pickup_slot');

    const slot1Iso = conversation.context.checkout.pickup_slots[0].scheduled_at;
    await step('1');

    expect(createSpy).toHaveBeenCalledTimes(1);
    const arg = createSpy.mock.calls[0][0];
    expect(arg.delivery_type).toBe('pickup');
    expect(arg.scheduled_at).toBeInstanceOf(Date);
    expect((arg.scheduled_at as Date).toISOString()).toBe(slot1Iso);
  });

  // ============== GERADOR DE SLOTS (PONTO DE REVISAO) ==============
  describe('generatePickupSlots — puro, deterministico (now por parametro)', () => {
    it('(a) todos os slots estao DENTRO de open-close e em dias de days', () => {
      // now = sabado 2026-06-27 06:00 local (antes de abrir), pra ter o dia inteiro.
      // 2026-06-27 09:00 local (-03) = 12:00 UTC.
      const now = new Date('2026-06-27T09:00:00.000Z'); // 06:00 BRT
      const slots = service.generatePickupSlots(BUSINESS_HOURS, now);
      expect(slots.length).toBeGreaterThan(0);
      for (const slot of slots) {
        // re-derivar os componentes locais via o backstop garante coerencia.
        expect(service.isWithinBusinessHours(slot.scheduledAt, BUSINESS_HOURS)).toBe(true);
      }
    });

    it('(b) NENHUM slot no passado: now = hoje 15:30 local -> primeiro slot de hoje e 16:00, nao 09:00', () => {
      // 2026-06-29 (segunda) 15:30 local (-03) = 18:30 UTC.
      const now = new Date('2026-06-29T18:30:00.000Z');
      const slots = service.generatePickupSlots(BUSINESS_HOURS, now);

      // Todos os slots devem ser estritamente no futuro.
      for (const slot of slots) {
        expect(slot.scheduledAt.getTime()).toBeGreaterThan(now.getTime());
      }

      // O primeiro slot e HOJE as 16:00 local (= 19:00 UTC), nao 09:00.
      expect(slots[0].scheduledAt.toISOString()).toBe('2026-06-29T19:00:00.000Z');
      expect(slots[0].label.toLowerCase()).toContain('hoje');
      expect(slots[0].label).toContain('16h');

      // Hoje so sobram 16:00, 17:00 e 18:00 (3 slots de hoje); o resto vem dos dias seguintes.
      const hojeIsos = slots
        .filter((s: { label: string; scheduledAt: Date }) => s.label.toLowerCase().includes('hoje'))
        .map((s: { label: string; scheduledAt: Date }) => s.scheduledAt.toISOString());
      expect(hojeIsos).toEqual([
        '2026-06-29T19:00:00.000Z', // 16h
        '2026-06-29T20:00:00.000Z', // 17h
        '2026-06-29T21:00:00.000Z', // 18h
      ]);
    });

    it('(c) cap de no maximo 8 slots', () => {
      const now = new Date('2026-06-29T11:00:00.000Z'); // segunda 08:00 BRT (antes de abrir)
      const slots = service.generatePickupSlots(BUSINESS_HOURS, now);
      expect(slots.length).toBeLessThanOrEqual(8);
      expect(slots.length).toBe(8);
    });

    it('(d) domingo (fora de days) e PULADO', () => {
      // now = sabado 2026-06-27 17:30 local (-03) = 20:30 UTC. Hoje so sobra 18:00.
      // O proximo dia (domingo 28) deve ser pulado; os demais vem da segunda 29.
      const now = new Date('2026-06-27T20:30:00.000Z');
      const slots = service.generatePickupSlots(BUSINESS_HOURS, now);
      for (const slot of slots) {
        // domingo nunca aparece (isWithinBusinessHours recusa domingo).
        expect(service.isWithinBusinessHours(slot.scheduledAt, BUSINESS_HOURS)).toBe(true);
        const dow = new Date(slot.scheduledAt).getUTCDay();
        // 20:30 UTC e ainda sabado em SP; nenhum slot deve cair em domingo local.
        const localDow = new Date(
          slot.scheduledAt.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }),
        ).getDay();
        expect(localDow).not.toBe(0); // 0 = domingo
        void dow;
      }
    });

    it('BACKSTOP: o slot escolhido passa no isWithinBusinessHours', () => {
      const now = new Date('2026-06-29T18:30:00.000Z');
      const slots = service.generatePickupSlots(BUSINESS_HOURS, now);
      expect(slots.length).toBeGreaterThan(0);
      // todos por construcao, mas afirmamos explicitamente para o slot 1 (o escolhido tipico).
      expect(service.isWithinBusinessHours(slots[0].scheduledAt, BUSINESS_HOURS)).toBe(true);
    });
  });

  // ============== TASK 1: HORARIO POR-DIA (faixa propria por dia; dia ausente = fechado) ==============
  describe('shape por-dia — faixa propria por dia + dia ausente = fechado', () => {
    // Loja que so abre no SABADO, das 09:00 as 13:00. Domingo (e todos os outros
    // dias) ausentes = fechados.
    const SAB_9_13 = {
      tz: 'America/Sao_Paulo',
      days: {
        '6': { open: '09:00', close: '13:00' },
      },
    };

    it('(a) generatePickupSlots: sabado gera slots so ate 13:00 e NENHUM slot em dia ausente (dom)', () => {
      // now = sexta 2026-06-26 06:00 local (-03) = 09:00 UTC. Varre a semana inteira.
      // O unico dia aberto e sabado 2026-06-27, das 09:00 as 13:00.
      const now = new Date('2026-06-26T09:00:00.000Z');
      const slots = service.generatePickupSlots(SAB_9_13, now);

      expect(slots.length).toBeGreaterThan(0);
      for (const slot of slots) {
        // Todo slot cai num SABADO local e no maximo as 13:00 local.
        const dtf = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Sao_Paulo',
          weekday: 'short',
          hour: '2-digit',
          hour12: false,
        });
        const parts = dtf.formatToParts(slot.scheduledAt);
        const weekday = parts.find((p) => p.type === 'weekday')?.value;
        let hour = Number(parts.find((p) => p.type === 'hour')?.value);
        if (hour === 24) hour = 0;
        expect(weekday).toBe('Sat'); // nunca domingo nem outro dia ausente
        expect(hour).toBeLessThanOrEqual(13); // faixa propria do sabado (fecha 13:00)
        expect(hour).toBeGreaterThanOrEqual(9);
      }

      // Sabado 09:00-13:00 em passos de 1h = 09,10,11,12,13 = 5 slots (todos num unico sabado).
      const isos = slots.map((s: { scheduledAt: Date }) => s.scheduledAt.toISOString());
      expect(isos).toEqual([
        '2026-06-27T12:00:00.000Z', // 09:00 BRT
        '2026-06-27T13:00:00.000Z', // 10:00 BRT
        '2026-06-27T14:00:00.000Z', // 11:00 BRT
        '2026-06-27T15:00:00.000Z', // 12:00 BRT
        '2026-06-27T16:00:00.000Z', // 13:00 BRT (inclusive)
      ]);
    });

    it('(b) isWithinBusinessHours: rejeita dia ausente (dom) e aceita dentro da faixa do sabado', () => {
      // Sabado 2026-06-27 11:00 local (-03) = 14:00 UTC -> dentro de 09-13 -> ACEITO.
      const sabDentro = new Date('2026-06-27T14:00:00.000Z');
      expect(service.isWithinBusinessHours(sabDentro, SAB_9_13)).toBe(true);

      // Sabado 2026-06-27 14:00 local (-03) = 17:00 UTC -> depois de fechar (13) -> RECUSADO.
      const sabDepois = new Date('2026-06-27T17:00:00.000Z');
      expect(service.isWithinBusinessHours(sabDepois, SAB_9_13)).toBe(false);

      // Domingo 2026-06-28 11:00 local (-03) = 14:00 UTC -> dia AUSENTE -> RECUSADO.
      const domFechado = new Date('2026-06-28T14:00:00.000Z');
      expect(service.isWithinBusinessHours(domFechado, SAB_9_13)).toBe(false);

      // Segunda 2026-06-29 11:00 local -> tambem ausente -> RECUSADO.
      const segFechado = new Date('2026-06-29T14:00:00.000Z');
      expect(service.isWithinBusinessHours(segFechado, SAB_9_13)).toBe(false);
    });
  });

  // ============== TASK 1: describeBusinessHours agrupa faixas ==============
  describe('describeBusinessHours — agrupa dias com mesma faixa, lista faixas distintas', () => {
    it('seg-sex 09:00-18:00 + sab 09:00-13:00 -> agrupa a semana e separa o sabado', () => {
      const bh = {
        tz: 'America/Sao_Paulo',
        days: {
          '1': { open: '09:00', close: '18:00' },
          '2': { open: '09:00', close: '18:00' },
          '3': { open: '09:00', close: '18:00' },
          '4': { open: '09:00', close: '18:00' },
          '5': { open: '09:00', close: '18:00' },
          '6': { open: '09:00', close: '13:00' },
        },
      };
      const desc = service.describeBusinessHours(bh);
      // Agrupa seg-sex numa faixa e lista sab separado.
      expect(desc).toContain('seg-sex 09:00-18:00');
      expect(desc).toContain('sáb 09:00-13:00');
      // Domingo ausente -> nao aparece.
      expect(desc.toLowerCase()).not.toContain('dom');
    });

    it('todos os dias na mesma faixa -> um unico grupo dom-sáb', () => {
      const days: Record<string, { open: string; close: string }> = {};
      for (let d = 0; d <= 6; d++) days[String(d)] = { open: '08:00', close: '20:00' };
      const desc = service.describeBusinessHours({ tz: 'America/Sao_Paulo', days });
      expect(desc).toContain('dom-sáb 08:00-20:00');
    });
  });
});
