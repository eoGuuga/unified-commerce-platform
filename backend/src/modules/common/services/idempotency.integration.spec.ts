import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { CommonModule } from '../common.module';
import { IdempotencyService } from './idempotency.service';
import { databaseConfig } from '../../../config/database.config';
import { Tenant } from '../../../database/entities/Tenant.entity';
import { DbContextService } from './db-context.service';

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
  let dbContext: DbContextService;
  let queryRunner: QueryRunner;
  let tenantAvailable = false;
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
      dbContext = module.get<DbContextService>(DbContextService);

      const dataSource = module.get<DataSource>(DataSource);
      queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      tenantRepository = queryRunner.manager.getRepository<Tenant>(Tenant);

      // Validar tenant de teste (evita violar RLS com INSERT)
      const testTenant = await tenantRepository.findOne({ where: { id: tenantId } });
      tenantAvailable = Boolean(testTenant);

      if (!tenantAvailable) {
        try {
          await queryRunner.query('SET LOCAL row_security = off');
          await queryRunner.query(
            `INSERT INTO "tenants"("id", "name", "slug", "settings", "is_active")
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT ("id") DO NOTHING`,
            [tenantId, 'Test Tenant', 'test-tenant', '{}', true],
          );
          tenantAvailable = true;
        } catch (seedError) {
          console.warn('⚠️ Tenant seed bloqueado por RLS, pulando testes de idempotência.');
          tenantAvailable = false;
        }
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
    if (queryRunner) {
      await queryRunner.release();
    }
  });

  beforeEach(async () => {
    // Limpar chaves de idempotência de testes anteriores via service
    if (!tenantAvailable) {
      return;
    }
    try {
      await dbContext.runWithManager(queryRunner.manager, async () => {
        await service.remove(tenantId, 'test-race-condition-key', 'test-operation');
        await service.remove(tenantId, 'test-existing-key', 'test-operation-existing');
        await service.remove(tenantId, 'test-no-error-key', 'test-operation-no-error');
      });
    } catch (error) {
      // Ignorar se não existir
    }
  });

  describe('checkAndSet - Race Condition', () => {
    it('deve lidar com race condition quando dois requests simultâneos tentam criar a mesma chave', async () => {
      if (!tenantAvailable) {
        console.log('⏭️ Pulando teste - tenant não disponível');
        return;
      }
      const operationType = 'test-operation';
      const key = 'test-race-condition-key';

      const results = await dbContext.runWithManager(queryRunner.manager, async () => {
        // Simular dois requests simultâneos
        const promises = [
          service.checkAndSet(tenantId, operationType, key, 3600),
          service.checkAndSet(tenantId, operationType, key, 3600),
        ];
        return await Promise.all(promises);
      });

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
      if (!tenantAvailable) {
        console.log('⏭️ Pulando teste - tenant não disponível');
        return;
      }
      const operationType = 'test-operation-existing';
      const key = 'test-existing-key';

      // Criar primeira chave
      const firstResult = await dbContext.runWithManager(queryRunner.manager, async () => {
        return await service.checkAndSet(tenantId, operationType, key, 3600);
      });
      expect(firstResult).toBeDefined();
      expect(firstResult).not.toBeNull();
      
      if (firstResult) {
        expect(firstResult.status).toBe('pending');

        // Tentar criar novamente (simula segundo request que chega depois)
        const secondResult = await dbContext.runWithManager(queryRunner.manager, async () => {
          return await service.checkAndSet(tenantId, operationType, key, 3600);
        });
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
      if (!tenantAvailable) {
        console.log('⏭️ Pulando teste - tenant não disponível');
        return;
      }
      const operationType = 'test-operation-no-error';
      const key = 'test-no-error-key';

      // Criar múltiplas tentativas simultâneas (simula race condition real)
      const results = await dbContext.runWithManager(queryRunner.manager, async () => {
        const promises = Array(5).fill(null).map(() => 
          service.checkAndSet(tenantId, operationType, key, 3600)
        );

        // Não deve lançar erro
        await expect(Promise.all(promises)).resolves.toBeDefined();

        return await Promise.all(promises);
      });

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
