import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { StockEngineService } from './stock-engine.service';
import { Produto } from '../../database/entities/Produto.entity';
import { MovimentacaoEstoque } from '../../database/entities/MovimentacaoEstoque.entity';
import { MovimentacaoEstoqueHistorico } from '../../database/entities/MovimentacaoEstoqueHistorico.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Produto, MovimentacaoEstoque, MovimentacaoEstoqueHistorico]),
    CommonModule, // Importar CommonModule para usar CacheService e AuditLogService
  ],
  controllers: [ProductsController],
  providers: [ProductsService, StockEngineService],
  exports: [ProductsService, StockEngineService],
})
export class ProductsModule {}
