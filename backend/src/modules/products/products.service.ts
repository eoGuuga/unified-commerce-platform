import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Produto } from '../../database/entities/Produto.entity';
import { MovimentacaoEstoque } from '../../database/entities/MovimentacaoEstoque.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CacheService } from '../common/services/cache.service';
import { AuditLogService } from '../common/services/audit-log.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Produto)
    private produtosRepository: Repository<Produto>,
    @InjectRepository(MovimentacaoEstoque)
    private estoqueRepository: Repository<MovimentacaoEstoque>,
    private cacheService: CacheService,
    private auditLogService: AuditLogService,
  ) {}

  async findAll(tenantId: string): Promise<any[]> {
    // ✅ CACHE: Tentar buscar do cache primeiro
    const cacheKey = `products:${tenantId}`;
    const cached = await this.cacheService.getCachedProducts(tenantId);
    if (cached) {
      return cached;
    }

    // ✅ CORRIGIDO: Query otimizada sem N+1
    // Buscar produtos com estoque em uma única query usando JOIN
    const produtos = await this.produtosRepository
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
      .orderBy('produto.name', 'ASC')
      .getMany();

    // Buscar todos os estoques de uma vez (evita N+1)
    const produtoIds = produtos.map((p) => p.id);
    const estoques = produtoIds.length > 0
      ? await this.estoqueRepository
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

    // ✅ CACHE: Salvar no cache (TTL: 5 minutos)
    await this.cacheService.cacheProducts(tenantId, produtosComEstoque, 300);

    return produtosComEstoque;
  }

  async findOne(id: string, tenantId: string): Promise<Produto> {
    const produto = await this.produtosRepository.findOne({
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
    const produto = this.produtosRepository.create({
      ...createProductDto,
      tenant_id: tenantId,
    });

    const savedProduto = await this.produtosRepository.save(produto);

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
      console.error('Erro ao registrar audit log:', error);
    }

    // ✅ CACHE: Invalidar cache de produtos
    await this.cacheService.invalidateProductsCache(tenantId);

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

    const savedProduto = await this.produtosRepository.save(produto);

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
      console.error('Erro ao registrar audit log:', error);
    }

    // ✅ CACHE: Invalidar cache de produtos
    await this.cacheService.invalidateProductsCache(tenantId);

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
    await this.produtosRepository.save(produto);

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
      console.error('Erro ao registrar audit log:', error);
    }

    // ✅ CACHE: Invalidar cache de produtos
    await this.cacheService.invalidateProductsCache(tenantId);
  }

  async search(tenantId: string, query: string): Promise<Produto[]> {
    return this.produtosRepository
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
    const estoque = await this.estoqueRepository.findOne({
      where: { tenant_id: tenantId, produto_id: produtoId },
    });

    if (!estoque) {
      throw new NotFoundException(`Estoque não encontrado para produto ${produtoId}`);
    }

    const availableStock = estoque.current_stock - estoque.reserved_stock;

    if (availableStock < quantity) {
      throw new BadRequestException(
        `Estoque insuficiente: disponível ${availableStock}, solicitado ${quantity}`,
      );
    }

    estoque.reserved_stock += quantity;
    await this.estoqueRepository.save(estoque);

    return {
      success: true,
      available_stock: estoque.current_stock - estoque.reserved_stock,
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
    const estoque = await this.estoqueRepository.findOne({
      where: { tenant_id: tenantId, produto_id: produtoId },
    });

    if (!estoque) {
      throw new NotFoundException(`Estoque não encontrado para produto ${produtoId}`);
    }

    estoque.reserved_stock = Math.max(0, estoque.reserved_stock - quantity);
    await this.estoqueRepository.save(estoque);

    return {
      success: true,
      available_stock: estoque.current_stock - estoque.reserved_stock,
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
    const produtos = await this.produtosRepository.find({
      where: { tenant_id: tenantId, is_active: true },
      order: { name: 'ASC' },
    });

    const produtosComEstoque = await Promise.all(
      produtos.map(async (produto) => {
        const estoque = await this.estoqueRepository.findOne({
          where: { tenant_id: tenantId, produto_id: produto.id },
        });

        const current_stock = estoque?.current_stock || 0;
        const reserved_stock = estoque?.reserved_stock || 0;
        const available_stock = Math.max(0, current_stock - reserved_stock);
        const min_stock = estoque?.min_stock || 0;

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
      }),
    );

    const low_stock_count = produtosComEstoque.filter((p) => p.status === 'low').length;
    const out_of_stock_count = produtosComEstoque.filter((p) => p.status === 'out').length;

    return {
      total_products: produtosComEstoque.length,
      low_stock_count,
      out_of_stock_count,
      products: produtosComEstoque,
    };
  }

  /**
   * Ajustar estoque (adicionar ou remover)
   */
  async adjustStock(
    produtoId: string,
    quantity: number,
    tenantId: string,
    reason?: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MovimentacaoEstoque> {
    // Verificar se produto existe
    await this.findOne(produtoId, tenantId);

    // Buscar ou criar estoque
    let estoque = await this.estoqueRepository.findOne({
      where: { tenant_id: tenantId, produto_id: produtoId },
    });

    const oldStock = estoque?.current_stock || 0;

    if (!estoque) {
      // Criar estoque se não existir
      estoque = this.estoqueRepository.create({
        tenant_id: tenantId,
        produto_id: produtoId,
        current_stock: 0,
        reserved_stock: 0,
        min_stock: 0,
      });
    }

    // Ajustar estoque
    const newStock = estoque.current_stock + quantity;

    if (newStock < 0) {
      throw new BadRequestException(
        `Não é possível remover ${Math.abs(quantity)} unidades. Estoque atual: ${estoque.current_stock}`,
      );
    }

    estoque.current_stock = newStock;
    estoque.last_updated = new Date();

    const savedEstoque = await this.estoqueRepository.save(estoque);

    // ✅ AUDIT LOG: Registrar ajuste de estoque
    try {
      await this.auditLogService.log({
        tenantId,
        userId,
        action: 'UPDATE',
        tableName: 'movimentacoes_estoque',
        recordId: savedEstoque.id,
        oldData: { current_stock: oldStock },
        newData: { current_stock: newStock },
        ipAddress,
        userAgent,
        metadata: { reason, quantity, produto_id: produtoId },
      });
    } catch (error) {
      console.error('Erro ao registrar audit log:', error);
    }

    // ✅ CACHE: Invalidar cache de produtos
    await this.cacheService.invalidateProductsCache(tenantId);
    await this.cacheService.invalidateStockCache(tenantId, produtoId);

    return savedEstoque;
  }

  /**
   * Definir estoque mínimo (alerta)
   */
  async setMinStock(produtoId: string, minStock: number, tenantId: string): Promise<MovimentacaoEstoque> {
    await this.findOne(produtoId, tenantId);

    let estoque = await this.estoqueRepository.findOne({
      where: { tenant_id: tenantId, produto_id: produtoId },
    });

    if (!estoque) {
      estoque = this.estoqueRepository.create({
        tenant_id: tenantId,
        produto_id: produtoId,
        current_stock: 0,
        reserved_stock: 0,
        min_stock: minStock,
      });
    } else {
      estoque.min_stock = minStock;
    }

    return this.estoqueRepository.save(estoque);
  }
}
