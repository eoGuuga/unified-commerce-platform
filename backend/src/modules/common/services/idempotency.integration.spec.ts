import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommonModule } from '../common.module';
import { IdempotencyService } from './idempotency.service';
import { databaseConfig } from '../../../config/database.config';
import { Tenant } from '../../../database/entities/Tenant.entity';

/**
 * Teste de Integração: Race Condition no IdempotencyService
 * 
 * Objetivo: Validar que a correção da race condition funciona corretamente
 * quando múltiplos requests simultâneos tentam criar a mesma chave de idempotência.
 * 
 * Cenário: Dois requests idênticos chegam ao mesmo tempo (ex: duplo clique no frontend).
 * Resultado esperado: Apenas um pedido deve ser criado, o segundo deve retornar o resultado do primeiro.
 */
describe('IdempotencyService - Race Condition Fix (Integration)', () => {
  let module: TestingModule;
  let service: IdempotencyService;
  let tenantRepository: Repository<Tenant>;
  const tenantId = '00000000-0000-0000-0000-000000000000';

  beforeAll(async () => {
    try {
      module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
          TypeOrmModule.forRootAsync(databaseConfig),
          TypeOrmModule.forFeature([Tenant]),
          CommonModule,
        ],
      }).compile();

      service = module.get<IdempotencyService>(IdempotencyService);
      tenantRepository = module.get<Repository<Tenant>>(getRepositoryToken(Tenant));

      // Criar tenant de teste se não existir
      let testTenant = await tenantRepository.findOne({ where: { id: tenantId } });
      if (!testTenant) {
        testTenant = tenantRepository.create({
          id: tenantId,
          name: 'Test Tenant',
          slug: 'test-tenant',
          is_active: true,
          settings: {},
        });
        await tenantRepository.save(testTenant);
      }
    } catch (error) {
      console.error('❌ Erro ao inicializar testes:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  beforeEach(async () => {
    // Limpar chaves de idempotência de testes anteriores via service
    try {
      await service.remove(tenantId, 'test-race-condition-key', 'test-operation');
      await service.remove(tenantId, 'test-existing-key', 'test-operation-existing');
      await service.remove(tenantId, 'test-no-error-key', 'test-operation-no-error');
    } catch (error) {
      // Ignorar se não existir
    }
  });

  describe('checkAndSet - Race Condition', () => {
    it('deve lidar com race condition quando dois requests simultâneos tentam criar a mesma chave', async () => {
      const operationType = 'test-operation';
      const key = 'test-race-condition-key';

      // Simular dois requests simultâneos
      const promises = [
        service.checkAndSet(tenantId, operationType, key, 3600),
        service.checkAndSet(tenantId, operationType, key, 3600),
      ];

      const results = await Promise.all(promises);

      // Ambos devem retornar um resultado (não deve lançar erro)
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
      expect(results[0]).not.toBeNull();
      expect(results[1]).not.toBeNull();

      // Ambos devem ter o mesmo ID (mesmo registro)
      if (results[0] && results[1]) {
        expect(results[0].id).toBe(results[1].id);
        expect(results[0].key_hash).toBe(results[1].key_hash);
        expect(results[0].status).toBe('pending');
      }
    });

    it('deve retornar registro existente quando chave já foi criada', async () => {
      const operationType = 'test-operation-existing';
      const key = 'test-existing-key';

      // Criar primeira chave
      const firstResult = await service.checkAndSet(tenantId, operationType, key, 3600);
      expect(firstResult).toBeDefined();
      expect(firstResult).not.toBeNull();
      
      if (firstResult) {
        expect(firstResult.status).toBe('pending');

        // Tentar criar novamente (simula segundo request que chega depois)
        const secondResult = await service.checkAndSet(tenantId, operationType, key, 3600);
        expect(secondResult).toBeDefined();
        expect(secondResult).not.toBeNull();

        if (secondResult) {
          // Deve retornar o mesmo registro
          expect(secondResult.id).toBe(firstResult.id);
          expect(secondResult.key_hash).toBe(firstResult.key_hash);
          expect(secondResult.status).toBe('pending');
        }
      }
    });

    it('não deve lançar erro PostgreSQL 23505 (unique_violation)', async () => {
      const operationType = 'test-operation-no-error';
      const key = 'test-no-error-key';

      // Criar múltiplas tentativas simultâneas (simula race condition real)
      const promises = Array(5).fill(null).map(() => 
        service.checkAndSet(tenantId, operationType, key, 3600)
      );

      // Não deve lançar erro
      await expect(Promise.all(promises)).resolves.toBeDefined();

      const results = await Promise.all(promises);

      // Todos devem ter o mesmo ID
      if (results[0]) {
        const firstId = results[0].id;
        results.forEach(result => {
          expect(result).toBeDefined();
          expect(result).not.toBeNull();
          if (result) {
            expect(result.id).toBe(firstId);
          }
        });
      }
    });
  });
});
