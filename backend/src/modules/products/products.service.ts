import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Produto } from '../../database/entities/Produto.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Produto)
    private produtosRepository: Repository<Produto>,
  ) {}

  async findAll(tenantId: string): Promise<Produto[]> {
    return this.produtosRepository.find({
      where: { tenant_id: tenantId, is_active: true },
      relations: ['categoria'],
      order: { name: 'ASC' },
    });
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
}
