import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * H5 (auditoria de seguranca): GET /products/:id sem validacao de UUID deixava
 * lixo (ex.: "nao-e-uuid", SQL, string gigante) chegar no service/banco e virar
 * 500. Fix: ParseUUIDPipe rejeita (400) ANTES de tocar o service. So aplicado
 * onde o param e UUID de verdade (Produto.id e uuid); as rotas estaticas
 * (search, categories, stock-summary, ...) sao declaradas ANTES de :id, entao o
 * pipe nao as afeta. Representativo — o mesmo fix vale para orders/payments.
 *
 * O guard e sobrescrito para injetar um user autenticado (o `@CurrentTenant()`
 * exige `req.user.tenant_id`); assim o teste isola o comportamento do pipe.
 */
describe('ProductsController — H5: :id valida UUID (400, nao chega no service)', () => {
  let app: INestApplication;
  const TENANT = '00000000-0000-0000-0000-000000000000';
  const VALID_UUID = '11111111-1111-1111-1111-111111111111';
  const productsService = {
    findOne: jest.fn().mockResolvedValue({ id: VALID_UUID, name: 'Brigadeiro' }),
    getStockHistory: jest.fn().mockResolvedValue({ items: [] }),
    update: jest.fn().mockResolvedValue({ id: VALID_UUID, name: 'Brigadeiro' }),
    remove: jest.fn().mockResolvedValue({ deleted: true }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: productsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = { tenant_id: TENANT };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('🎯 GET /products/<lixo> → 400 e NAO chega no service', async () => {
    await request(app.getHttpServer()).get('/products/nao-e-uuid').expect(400);
    expect(productsService.findOne).not.toHaveBeenCalled();
  });

  it('GET /products/<uuid valido> → chega no service (200)', async () => {
    await request(app.getHttpServer()).get(`/products/${VALID_UUID}`).expect(200);
    expect(productsService.findOne).toHaveBeenCalledWith(VALID_UUID, TENANT);
  });

  it('🎯 GET /products/<lixo>/stock-history → 400 (o :id do extrato tambem valida)', async () => {
    await request(app.getHttpServer()).get('/products/nao-e-uuid/stock-history').expect(400);
    expect(productsService.getStockHistory).not.toHaveBeenCalled();
  });

  // H5 follow-up: mesmo padrao nas rotas de MUTACAO (PATCH/DELETE :id).
  it('🎯 PATCH /products/<lixo> → 400 e NAO chega no service', async () => {
    await request(app.getHttpServer()).patch('/products/nao-e-uuid').send({ name: 'x' }).expect(400);
    expect(productsService.update).not.toHaveBeenCalled();
  });

  it('🎯 DELETE /products/<lixo> → 400 e NAO chega no service', async () => {
    await request(app.getHttpServer()).delete('/products/nao-e-uuid').expect(400);
    expect(productsService.remove).not.toHaveBeenCalled();
  });
});
