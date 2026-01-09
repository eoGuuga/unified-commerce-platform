import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { AsyncLocalStorage } from 'node:async_hooks';
import { DataSource, EntityManager, EntityTarget, ObjectLiteral, Repository } from 'typeorm';

type DbContextStore = {
  manager: EntityManager;
};

@Injectable()
export class DbContextService {
  private readonly als = new AsyncLocalStorage<DbContextStore>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  runWithManager<T>(manager: EntityManager, fn: () => Promise<T>): Promise<T> {
    return this.als.run({ manager }, fn);
  }

  getManager(): EntityManager {
    const store = this.als.getStore();
    return store?.manager || this.dataSource.manager;
  }

  getRepository<T extends ObjectLiteral>(target: EntityTarget<T>): Repository<T> {
    return this.getManager().getRepository(target);
  }

  /**
   * Se já estamos dentro de um contexto transacional (interceptor),
   * roda no manager atual. Caso contrário, abre uma transação nova.
   */
  async runInTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    const store = this.als.getStore();
    if (store?.manager) {
      return await fn(store.manager);
    }
    return await this.dataSource.transaction(fn);
  }
}

