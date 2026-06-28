import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Produto } from '../../database/entities/Produto.entity';
import { MovimentacaoEstoque } from '../../database/entities/MovimentacaoEstoque.entity';
import { LedgerTipo, MovimentacaoEstoqueHistorico } from '../../database/entities/MovimentacaoEstoqueHistorico.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CacheService } from '../common/services/cache.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { DbContextService } from '../common/services/db-context.service';
import { StockEngineService } from './stock-engine.service';
import { PaginatedResult, createPaginatedResult } from '../common/types/pagination.types';
import { PaginationDto } from './dto/pagination.dto';
import { ProductWithStock } from './types/product.types';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Produto)
    private produtosRepository: Repository<Produto>,
    @InjectRepository(MovimentacaoEstoque)
    private estoqueRepository: Repository<MovimentacaoEstoque>,
    @InjectDataSource()
    private dataSource: DataSource,
    private cacheService: CacheService,
    private auditLogService: AuditLogService,
    private readonly db: DbContextService,
    private readonly stockEngine: StockEngineService,
  ) {}

  async findAll(tenantId: string, pagination?: PaginationDto): Promise<ProductWithStock[] | PaginatedResult<ProductWithStock>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 50;
    const skip = (page - 1) * limit;
    const produtosRepository = this.db.getRepository(Produto);
    const estoqueRepository = this.db.getRepository(MovimentacaoEstoque);

    // ✅ CACHE: Tentar buscar do cache primeiro (apenas sem paginação) — não-fatal
    if (!pagination) {
      try {
        const cached = await this.cacheService.getCachedProducts(tenantId);
        if (cached) {
          return cached;
        }
      } catch (error) {
        this.logger.warn('Cache read falhou em findAll (não-fatal)', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // ✅ CORRIGIDO: Query otimizada sem N+1 com paginação
    const queryBuilder = produtosRepository
      .createQueryBuilder('produto')
      .leftJoinAndSelect('produto.categoria', 'categoria')
      .leftJoin(
        'movimentacoes_estoque',
        'estoque',
        'estoque.produto_id = produto.id AND estoque.tenant_id = :tenantId',
        { tenantId },
      )
      .where('produto.tenant_id = :tenantId', { tenantId })
      .andWhere('produto.is_active = :isActive', { isActive: true })
      .orderBy('produto.name', 'ASC');

    // Se paginação foi solicitada, aplicar skip/take e retornar resultado paginado
    if (pagination) {
      const [produtos, total] = await queryBuilder
        .skip(skip)
        .take(limit)
        .getManyAndCount();
      
      // Buscar estoques para os produtos da página atual
      const produtoIds = produtos.map((p) => p.id);
      const estoques = produtoIds.length > 0
        ? await estoqueRepository
            .createQueryBuilder('estoque')
            .where('estoque.tenant_id = :tenantId', { tenantId })
            .andWhere('estoque.produto_id IN (:...produtoIds)', { produtoIds })
            .getMany()
        : [];

      const estoqueMap = new Map(estoques.map((e) => [e.produto_id, e]));
      const produtosComEstoque = produtos.map((produto) => {
        const estoque = estoqueMap.get(produto.id);
        const availableStock = estoque
          ? Math.max(0, estoque.current_stock - estoque.reserved_stock)
          : 0;

        return {
          ...produto,
          stock: estoque?.current_stock || 0,
          available_stock: availableStock,
          reserved_stock: estoque?.reserved_stock || 0,
          min_stock: estoque?.min_stock || 0,
        };
      });

      return createPaginatedResult(produtosComEstoque, total, page, limit);
    }

    // Sem paginação: comportamento original (retorna todos)
    const produtos = await queryBuilder.getMany();

    // Buscar todos os estoques de uma vez (evita N+1)
    const produtoIds = produtos.map((p) => p.id);
    const estoques = produtoIds.length > 0
      ? await estoqueRepository
          .createQueryBuilder('estoque')
          .where('estoque.tenant_id = :tenantId', { tenantId })
          .andWhere('estoque.produto_id IN (:...produtoIds)', { produtoIds })
          .getMany()
      : [];

    // Criar mapa de estoques por produto_id
    const estoqueMap = new Map(estoques.map((e) => [e.produto_id, e]));

    // Mapear produtos com estoque
    const produtosComEstoque = produtos.map((produto) => {
      const estoque = estoqueMap.get(produto.id);

      // Estoque disponível = current_stock - reserved_stock
      const availableStock = estoque
        ? Math.max(0, estoque.current_stock - estoque.reserved_stock)
        : 0;

      return {
        ...produto,
        stock: estoque?.current_stock || 0,
        available_stock: availableStock,
        reserved_stock: estoque?.reserved_stock || 0,
        min_stock: estoque?.min_stock || 0,
      };
    });

    // ✅ CACHE: Salvar no cache (TTL: 5 minutos) — não-fatal
    try {
      await this.cacheService.cacheProducts(tenantId, produtosComEstoque, 300);
    } catch (error) {
      this.logger.warn('Cache write falhou em findAll (não-fatal)', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return produtosComEstoque;
  }

  async findOne(id: string, tenantId: string): Promise<Produto> {
    const produto = await this.db.getRepository(Produto).findOne({
      where: { id, tenant_id: tenantId },
      relations: ['categoria'],
    });

    if (!produto) {
      throw new NotFoundException(`Produto ${id} não encontrado`);
    }

    return produto;
  }

  async create(
    createProductDto: CreateProductDto,
    tenantId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Produto> {
    // Normalizar category: trim, colapsar espaços, vazio → null
    const category = createProductDto.category?.trim().replace(/\s+/g, ' ') || null;

    // Executar criação do produto + estoque inicial em uma transação atômica
    const savedProduto = await this.db.runInTransaction(async (manager) => {
      const produtoData: Record<string, any> = {
        ...createProductDto,
        category,
        tenant_id: tenantId,
      };
      // initial_stock não é coluna do produto — remover antes de persistir
      delete produtoData.initial_stock;

      const produto = manager.getRepository(Produto).create(produtoData as Partial<Produto>);
      const p = await manager.getRepository(Produto).save(produto);

      // Sempre criar a linha de estoque com current_stock=0
      await manager.getRepository(MovimentacaoEstoque).insert({
        tenant_id: tenantId,
        produto_id: p.id,
        current_stock: 0,
        reserved_stock: 0,
        min_stock: 0,
      });

      // Se initial_stock > 0, registrar INVENTARIO_INICIAL via motor (nunca setar direct)
      if (createProductDto.initial_stock && createProductDto.initial_stock > 0) {
        await this.stockEngine.recordManualMovement(
          manager,
          tenantId,
          p.id,
          LedgerTipo.INVENTARIO_INICIAL,
          createProductDto.initial_stock,
          'Inventário inicial',
          userId ?? null,
        );
      }

      return p;
    });

    // ✅ AUDIT LOG: Registrar criação de produto
    try {
      await this.auditLogService.log({
        tenantId,
        userId,
        action: 'CREATE',
        tableName: 'produtos',
        recordId: savedProduto.id,
        newData: {
          name: savedProduto.name,
          price: savedProduto.price,
          is_active: savedProduto.is_active,
        },
        ipAddress,
        userAgent,
      });
    } catch (error) {
      this.logger.error('Erro ao registrar audit log', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: { tenantId, userId, produtoId: savedProduto.id, action: 'CREATE' },
      });
    }

    // ✅ CACHE: Invalidar cache — não-fatal (Redis pode estar indisponível em testes)
    try {
      await this.cacheService.invalidateProductsCache(tenantId);
    } catch (error) {
      this.logger.warn('Cache invalidation falhou em create (não-fatal)', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return savedProduto;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    tenantId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Produto> {
    const produto = await this.findOne(id, tenantId);
    const oldData = { ...produto };

    Object.assign(produto, updateProductDto);

    const savedProduto = await this.db.getRepository(Produto).save(produto);

    // ✅ AUDIT LOG: Registrar atualização de produto
    try {
      await this.auditLogService.log({
        tenantId,
        userId,
        action: 'UPDATE',
        tableName: 'produtos',
        recordId: savedProduto.id,
        oldData: {
          name: oldData.name,
          price: oldData.price,
          is_active: oldData.is_active,
        },
        newData: {
          name: savedProduto.name,
          price: savedProduto.price,
          is_active: savedProduto.is_active,
        },
        ipAddress,
        userAgent,
      });
    } catch (error) {
      this.logger.error('Erro ao registrar audit log', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: { tenantId, userId, produtoId: savedProduto.id, action: 'CREATE' },
      });
    }

    // ✅ CACHE: Invalidar cache — não-fatal
    try {
      await this.cacheService.invalidateProductsCache(tenantId);
    } catch (error) {
      this.logger.warn('Cache invalidation falhou em update (não-fatal)', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return savedProduto;
  }

  async remove(
    id: string,
    tenantId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const produto = await this.findOne(id, tenantId);
    const oldData = { ...produto };

    produto.is_active = false;
    await this.db.getRepository(Produto).save(produto);

    // ✅ AUDIT LOG: Registrar desativação de produto
    try {
      await this.auditLogService.log({
        tenantId,
        userId,
        action: 'UPDATE', // Soft delete = UPDATE is_active
        tableName: 'produtos',
        recordId: produto.id,
        oldData: { is_active: oldData.is_active },
        newData: { is_active: false },
        ipAddress,
        userAgent,
        metadata: { action: 'soft_delete' },
      });
    } catch (error) {
      this.logger.error('Erro ao registrar audit log', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: { tenantId, userId, produtoId: produto.id, action: 'UPDATE' },
      });
    }

    // ✅ CACHE: Invalidar cache — não-fatal
    try {
      await this.cacheService.invalidateProductsCache(tenantId);
    } catch (error) {
      this.logger.warn('Cache invalidation falhou em remove (não-fatal)', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async search(tenantId: string, query: string): Promise<Produto[]> {
    return this.db.getRepository(Produto)
      .createQueryBuilder('produto')
      .where('produto.tenant_id = :tenantId', { tenantId })
      .andWhere('produto.is_active = :isActive', { isActive: true })
      .andWhere('(produto.name ILIKE :query OR produto.description ILIKE :query)', {
        query: `%${query}%`,
      })
      .leftJoinAndSelect('produto.categoria', 'categoria')
      .orderBy('produto.name', 'ASC')
      .limit(50)
      .getMany();
  }

  /**
   * Reservar estoque (quando adiciona ao carrinho)
   */
  async reserveStock(
    produtoId: string,
    quantity: number,
    tenantId: string,
  ): Promise<{ success: boolean; available_stock: number }> {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantidade inválida para reserva');
    }

    const estoqueRepo = this.db.getRepository(MovimentacaoEstoque);
    const estoque = await estoqueRepo.findOne({
      where: { tenant_id: tenantId, produto_id: produtoId },
    });

    if (!estoque) {
      throw new NotFoundException(`Estoque não encontrado para produto ${produtoId}`);
    }

    const result = await estoqueRepo
      .createQueryBuilder()
      .update(MovimentacaoEstoque)
      .set({ reserved_stock: () => 'reserved_stock + :quantity' })
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('produto_id = :produtoId', { produtoId })
      .andWhere('current_stock - reserved_stock >= :quantity', { quantity })
      .setParameters({ quantity })
      .execute();

    if (!result.affected || result.affected < 1) {
      const availableStock = estoque.current_stock - estoque.reserved_stock;
      throw new BadRequestException(
        `Estoque insuficiente: disponível ${availableStock}, solicitado ${quantity}`,
      );
    }

    const updated = await estoqueRepo.findOne({
      where: { tenant_id: tenantId, produto_id: produtoId },
    });

    if (!updated) {
      throw new NotFoundException(`Estoque não encontrado para produto ${produtoId}`);
    }

    return {
      success: true,
      available_stock: updated.current_stock - updated.reserved_stock,
    };
  }

  /**
   * Liberar estoque reservado (quando remove do carrinho)
   */
  async releaseStock(
    produtoId: string,
    quantity: number,
    tenantId: string,
  ): Promise<{ success: boolean; available_stock: number }> {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantidade inválida para liberação');
    }

    const estoqueRepo = this.db.getRepository(MovimentacaoEstoque);
    const estoque = await estoqueRepo.findOne({
      where: { tenant_id: tenantId, produto_id: produtoId },
    });

    if (!estoque) {
      throw new NotFoundException(`Estoque não encontrado para produto ${produtoId}`);
    }

    await estoqueRepo
      .createQueryBuilder()
      .update(MovimentacaoEstoque)
      .set({ reserved_stock: () => 'GREATEST(0, reserved_stock - :quantity)' })
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('produto_id = :produtoId', { produtoId })
      .setParameters({ quantity })
      .execute();

    const updated = await estoqueRepo.findOne({
      where: { tenant_id: tenantId, produto_id: produtoId },
    });

    if (!updated) {
      throw new NotFoundException(`Estoque não encontrado para produto ${produtoId}`);
    }

    return {
      success: true,
      available_stock: updated.current_stock - updated.reserved_stock,
    };
  }

  /**
   * Liberar todas as reservas de uma lista de produtos (limpar carrinho)
   */
  async releaseMultipleStocks(
    items: Array<{ produto_id: string; quantity: number }>,
    tenantId: string,
  ): Promise<void> {
    for (const item of items) {
      await this.releaseStock(item.produto_id, item.quantity, tenantId);
    }
  }

  /**
   * Obter resumo de estoque (para página de gestão)
   */
  async getStockSummary(tenantId: string): Promise<{
    total_products: number;
    low_stock_count: number;
    out_of_stock_count: number;
    products: Array<{
      id: string;
      name: string;
      current_stock: number;
      reserved_stock: number;
      available_stock: number;
      min_stock: number;
      status: 'ok' | 'low' | 'out';
    }>;
  }> {
    try {
      this.logger.log(`[getStockSummary] Iniciando para tenant: ${tenantId}`);
      
      // Buscar produtos ativos primeiro
      const produtos = await this.db.getRepository(Produto).find({
        where: {
          tenant_id: tenantId,
          is_active: true,
        },
        order: {
          name: 'ASC',
        },
      });

      this.logger.log(`[getStockSummary] Produtos encontrados: ${produtos.length}`);

      // Se não há produtos, retornar vazio
      if (produtos.length === 0) {
        this.logger.log(`[getStockSummary] Nenhum produto encontrado, retornando vazio`);
        return {
          total_products: 0,
          low_stock_count: 0,
          out_of_stock_count: 0,
          products: [],
        };
      }

      // Buscar estoques - usar abordagem mais simples e confiável
      const produtoIds = produtos.map((p) => p.id);
      const estoquesMap = new Map<string, MovimentacaoEstoque>();
      
      this.logger.log(`[getStockSummary] Buscando estoques para ${produtoIds.length} produtos`);
      
      try {
        // Usar find() simples do TypeORM (mais confiável)
        // TypeORM já lida com RLS automaticamente quando filtramos por tenant_id
        const allEstoques = await this.db.getRepository(MovimentacaoEstoque).find({
          where: {
            tenant_id: tenantId,
          },
        });
        
        this.logger.log(`[getStockSummary] Estoques encontrados no tenant: ${allEstoques.length}`);
        
        // Criar Set para busca mais eficiente
        const produtoIdsSet = new Set(produtoIds);
        
        // Filtrar apenas os estoques dos produtos ativos usando Set (mais eficiente)
        allEstoques.forEach((e) => {
          if (produtoIdsSet.has(e.produto_id)) {
            estoquesMap.set(e.produto_id, e);
          }
        });
        
        this.logger.log(`[getStockSummary] Estoques mapeados: ${estoquesMap.size}`);
      } catch (error: any) {
        this.logger.error(`[getStockSummary] Erro ao buscar estoques: ${error.message}`, error.stack);
        // Continuar sem estoques - produtos terão estoque 0
      }

      // Processar produtos com estoque
      this.logger.log(`[getStockSummary] Processando ${produtos.length} produtos`);
      const produtosComEstoque = produtos.map((produto) => {
        try {
          const estoque = estoquesMap.get(produto.id);
          const current_stock = estoque?.current_stock ?? 0;
          const reserved_stock = estoque?.reserved_stock ?? 0;
          const available_stock = Math.max(0, current_stock - reserved_stock);
          const min_stock = estoque?.min_stock ?? 0;

          let status: 'ok' | 'low' | 'out' = 'ok';
          if (available_stock === 0) {
            status = 'out';
          } else if (min_stock > 0 && available_stock <= min_stock) {
            status = 'low';
          }

          return {
            id: produto.id,
            name: produto.name,
            current_stock,
            reserved_stock,
            available_stock,
            min_stock,
            status,
          };
        } catch (error: any) {
          this.logger.error(`[getStockSummary] Erro ao processar produto ${produto.id}: ${error.message}`);
          return {
            id: produto.id,
            name: produto.name,
            current_stock: 0,
            reserved_stock: 0,
            available_stock: 0,
            min_stock: 0,
            status: 'out' as const,
          };
        }
      });

      let low_stock_count = 0;
      let out_of_stock_count = 0;
      
      produtosComEstoque.forEach((p) => {
        if (p.status === 'low') {
          low_stock_count++;
        } else if (p.status === 'out') {
          out_of_stock_count++;
        }
      });

      this.logger.log(`[getStockSummary] Resumo: total=${produtosComEstoque.length}, low=${low_stock_count}, out=${out_of_stock_count}`);

      // Retornar resultado diretamente (TypeORM já serializa corretamente)
      const result = {
        total_products: produtosComEstoque.length,
        low_stock_count,
        out_of_stock_count,
        products: produtosComEstoque,
      };
      
      this.logger.log(`[getStockSummary] Retornando resultado com ${result.products.length} produtos`);
      
      return result;
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`[getStockSummary] ERRO CRÍTICO: ${errorMessage}`, errorStack);
      this.logger.error(`[getStockSummary] Stack completo: ${errorStack}`);
      
      // ✅ IMPORTANTE: Retornar estrutura vazia ao invés de lançar exceção
      // Isso evita que o backend crashe e permite que o endpoint funcione mesmo com problemas
      // O erro já foi logado para investigação posterior
      return {
        total_products: 0,
        low_stock_count: 0,
        out_of_stock_count: 0,
        products: [],
      };
    }
  }

  /**
   * Ajusta estoque via ledger (COMPRA/PERDA/DEVOLUCAO/AJUSTE). Ledger-correto.
   */
  async adjustStockLedger(
    produtoId: string,
    tipo: LedgerTipo,
    delta: number,
    motivo: string | null,
    tenantId: string,
    usuarioId: string | null,
  ): Promise<{ saldo_resultante: number }> {
    // 404 se produto não existe ou não pertence ao tenant
    await this.findOne(produtoId, tenantId);
    const res = await this.db.runInTransaction((manager) =>
      this.stockEngine.recordManualMovement(manager, tenantId, produtoId, tipo, delta, motivo, usuarioId),
    );
    // ✅ CACHE: Invalidar cache — não-fatal
    try {
      await this.cacheService.invalidateProductsCache(tenantId);
      await this.cacheService.invalidateStockCache(tenantId, produtoId);
    } catch (error) {
      this.logger.warn('Cache invalidation falhou em adjustStockLedger (não-fatal)', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return res;
  }

  /**
   * Definir estoque mínimo (alerta)
   */
  async setMinStock(produtoId: string, minStock: number, tenantId: string): Promise<MovimentacaoEstoque> {
    await this.findOne(produtoId, tenantId);

    const estoqueRepo = this.db.getRepository(MovimentacaoEstoque);
    let estoque = await estoqueRepo.findOne({
      where: { tenant_id: tenantId, produto_id: produtoId },
    });

    if (!estoque) {
      estoque = estoqueRepo.create({
        tenant_id: tenantId,
        produto_id: produtoId,
        current_stock: 0,
        reserved_stock: 0,
        min_stock: minStock,
      });
    } else {
      estoque.min_stock = minStock;
    }

    return estoqueRepo.save(estoque);
  }

  /**
   * Retorna o extrato paginado de movimentações de estoque de um produto.
   * Ordenado por created_at DESC, id DESC (determinístico).
   * Exclui usuario_id do payload por privacidade.
   */
  async getStockHistory(
    produtoId: string,
    tenantId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ items: Array<{ tipo: string; delta: number; saldo_resultante: number; motivo: string | null; created_at: Date }>; total: number }> {
    // Garante que o produto pertence ao tenant (lança 404 se não existir)
    await this.findOne(produtoId, tenantId);
    const repo = this.db.getRepository(MovimentacaoEstoqueHistorico);
    const [rows, total] = await repo
      .createQueryBuilder('h')
      .where('h.tenant_id = :tenantId', { tenantId })
      .andWhere('h.produto_id = :produtoId', { produtoId })
      .orderBy('h.created_at', 'DESC')
      .addOrderBy('h.id', 'DESC')
      .limit(Math.min(limit, 200))
      .offset(offset)
      .getManyAndCount();
    return {
      items: rows.map((h) => ({
        tipo: h.tipo,
        delta: h.delta,
        saldo_resultante: h.saldo_resultante,
        motivo: h.motivo,
        created_at: h.created_at,
      })),
      total,
    };
  }

  /**
   * Retorna categorias DISTINCT dos produtos ativos do tenant, ordenadas alfabeticamente.
   */
  async getCategories(tenantId: string): Promise<string[]> {
    const rows = await this.db
      .getRepository(Produto)
      .createQueryBuilder('p')
      .select('DISTINCT p.category', 'category')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.category IS NOT NULL')
      .orderBy('p.category', 'ASC')
      .getRawMany();
    return rows.map((r) => r.category as string).filter(Boolean);
  }
}
