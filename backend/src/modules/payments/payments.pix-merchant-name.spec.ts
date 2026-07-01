/**
 * Task 5 — Nome do recebedor do PIX estatico (BR Code) por-tenant.
 *
 * O payload EMV do PIX estatico (generatePixData) monta o campo 59
 * (merchant name). Antes desta task esse nome vinha SO de process.env.MERCHANT_NAME,
 * ignorando o tenant. Agora a resolucao e:
 *   settings.pix_merchant_name -> settings.store_name -> MERCHANT_NAME (env) -> 'Loja'.
 *
 * Testa a montagem do EMV de forma isolada (unit): instancia o PaymentsService
 * com stubs so do que generatePixData toca (configService + db.getRepository(Tenant)).
 * Nao usa o test-DB compartilhado (evita a divida de duplicate-SKU).
 *
 * NAO cobre o caminho MercadoPago (fora de escopo, caveat §4).
 */
import { PaymentsService } from './payments.service';
import { Tenant } from '../../database/entities/Tenant.entity';
import { Pagamento } from '../../database/entities/Pagamento.entity';
import { Pedido } from '../../database/entities/Pedido.entity';

/**
 * Extrai o valor do campo 59 (Merchant Name) do payload EMV do PIX.
 *
 * O campo 59 e sempre seguido do campo 60 (Merchant City = "SAO PAULO"),
 * entao ancoramos por `59<len><name>60`. Isso e robusto contra a codificacao
 * de tamanho "folgada" do campo 54 do gerador mock (fora de escopo desta task).
 */
function extractMerchantName(emv: string): string | null {
  const m = emv.match(/59(\d{2})(.*?)6009SAO PAULO/);
  if (!m) return null;
  const len = parseInt(m[1], 10);
  return m[2].slice(0, len);
}

describe('PaymentsService — generatePixData: nome do recebedor PIX por-tenant', () => {
  const ORIG_ENV = process.env.MERCHANT_NAME;
  const ORIG_NODE_ENV = process.env.NODE_ENV;

  afterEach(() => {
    if (ORIG_ENV === undefined) delete process.env.MERCHANT_NAME;
    else process.env.MERCHANT_NAME = ORIG_ENV;
    process.env.NODE_ENV = ORIG_NODE_ENV;
  });

  function makeService(tenantSettings: Record<string, any> | null) {
    // ConfigService stub: PIX_KEY fixa; MERCHANT_NAME lido do process.env em runtime.
    const configService = {
      get: (k: string) => {
        if (k === 'PIX_KEY') return 'chave-pix-fixa-000';
        if (k === 'MERCHANT_NAME') return process.env.MERCHANT_NAME;
        return undefined;
      },
    } as any;

    // db.getRepository(Tenant).findOne devolve o tenant semeado; qualquer outro
    // repositorio devolve um stub inofensivo.
    const tenantRepo = {
      findOne: jest.fn().mockResolvedValue(
        tenantSettings === null ? null : ({ id: 't1', settings: tenantSettings } as Tenant),
      ),
    };
    const db = {
      getRepository: (target: any) => (target === Tenant ? tenantRepo : ({} as any)),
    } as any;

    const service = new PaymentsService(
      {} as any, // pagamentosRepository
      {} as any, // pedidosRepository
      configService,
      db,
      {} as any, // mercadoPagoProvider
      {} as any, // notificationsService
      {} as any, // ordersService
    );
    return { service, tenantRepo };
  }

  const pedido = { order_no: 'A-1' } as Pedido;
  const pagamento = { tenant_id: 't1', amount: '10.00' } as unknown as Pagamento;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('usa settings.pix_merchant_name quando presente (sobrepoe o env)', async () => {
    process.env.MERCHANT_NAME = 'EnvMerchant';
    const { service } = makeService({ pix_merchant_name: 'Doceria da Maria', store_name: 'Loja Store' });

    const emv: string = await (service as any).generatePixData(pedido, pagamento);

    expect(extractMerchantName(emv)).toBe('Doceria da Maria');
  });

  it('cai em settings.store_name quando nao ha pix_merchant_name', async () => {
    process.env.MERCHANT_NAME = 'EnvMerchant';
    const { service } = makeService({ store_name: 'Padaria do Joao' });

    const emv: string = await (service as any).generatePixData(pedido, pagamento);

    expect(extractMerchantName(emv)).toBe('Padaria do Joao');
  });

  it('cai em MERCHANT_NAME (env) quando o tenant nao tem nem pix_merchant_name nem store_name', async () => {
    process.env.MERCHANT_NAME = 'EnvMerchant';
    const { service } = makeService({});

    const emv: string = await (service as any).generatePixData(pedido, pagamento);

    expect(extractMerchantName(emv)).toBe('EnvMerchant');
  });
});
