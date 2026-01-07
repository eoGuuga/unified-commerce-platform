import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Produto } from '../../database/entities/Produto.entity';
import { MovimentacaoEstoque } from '../../database/entities/MovimentacaoEstoque.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Produto)
    private produtosRepository: Repository<Produto>,
    @InjectRepository(MovimentacaoEstoque)
    private estoqueRepository: Repository<MovimentacaoEstoque>,
  ) {}

  async findAll(tenantId: string): Promise<any[]> {
    const produtos = await this.produtosRepository.find({
      where: { tenant_id: tenantId, is_active: true },
      relations: ['categoria'],
      order: { name: 'ASC' },
    });

    // Buscar estoque para cada produto
    const produtosComEstoque = await Promise.all(
      produtos.map(async (produto) => {
        const estoque = await this.estoqueRepository.findOne({
          where: { tenant_id: tenantId, produto_id: produto.id },
        });

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
      })
    );

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

  async create(createProductDto: CreateProductDto, tenantId: string): Promise<Produto> {
    const produto = this.produtosRepository.create({
      ...createProductDto,
      tenant_id: tenantId,
    });

    return this.produtosRepository.save(produto);
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    tenantId: string,
  ): Promise<Produto> {
    const produto = await this.findOne(id, tenantId);

    Object.assign(produto, updateProductDto);

    return this.produtosRepository.save(produto);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const produto = await this.findOne(id, tenantId);
    produto.is_active = false;
    await this.produtosRepository.save(produto);
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
}
