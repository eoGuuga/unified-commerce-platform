# README PARA IMPLEMENTAÇÃO

## CONTEXTO RÁPIDO

Este projeto já está 100% estruturado e documentado. Schema SQL completo foi criado.
Agora precisa: CONECTAR backend ao banco + CRIAR MÓDULOS

---

## SCHEMA SQL CRIADO ✅

Arquivo: `scripts/migrations/001-initial-schema.sql`

**TABELAS:**
- `tenants` - Multitenancy (uma loja = um tenant)
- `usuarios` - Usuários (admin, vendedor, etc)
- `categorias` - Categorias de produtos
- `produtos` - Catálogo
- `movimentacoes_estoque` - Estoque atual
- `pedidos` - Pedidos de venda
- `itens_pedido` - Itens de cada pedido
- `reservas_estoque` - Reservas temporárias
- `pagamentos` - Transações de pagamento
- `cupons_desconto` - Cupons/promoções
- `audit_log` - Log de auditoria

**RECURSOS:**
- ✅ RLS (Row Level Security) habilitado
- ✅ Triggers de updated_at automático
- ✅ Função estoque_disponivel()
- ✅ Índices para performance
- ✅ Dados de seed (tenant + admin de exemplo)

---

## PRÓXIMO PASSO: CONFIGURAR ORM

### OPÇÃO 1: TypeORM (Recomendado)

Criar: `backend/src/config/database.config.ts`

```typescript
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Tenant } from '../database/entities/Tenant.entity';
import { Usuario } from '../database/entities/Usuario.entity';
import { Produto } from '../database/entities/Produto.entity';
// ... importar TODAS entities

export default TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    url: config.get('DATABASE_URL'),
    entities: [Tenant, Usuario, Produto, /* ... */],
    synchronize: config.get('NODE_ENV') === 'development', // false em produção
    logging: config.get('NODE_ENV') === 'development',
  }),
});
```

### OPÇÃO 2: Prisma (Alternativa)

Mais simples mas menos flexível para transações complexas.

---

## PRÓXIMO PASSO: CRIAR ENTITIES

Começar com: `Produto.entity.ts`

```typescript
// backend/src/database/entities/Produto.entity.ts

import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Tenant } from './Tenant.entity';
import { Categoria } from './Categoria.entity';
import { ItemPedido } from './ItemPedido.entity';

@Entity('produtos')
export class Produto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant)
  @Column('uuid')
  tenant_id: string;

  @ManyToOne(() => Categoria, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  categoria_id?: string;

  @Column({ length: 100, nullable: true })
  sku?: string;

  @Column({ length: 255 })
  name: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  cost_price?: number;

  @Column({ length: 50, default: 'unidade' })
  unit: string;

  @Column({ default: true })
  is_active: boolean;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relações
  @OneToMany(() => ItemPedido, item => item.produto)
  itens_pedido: ItemPedido[];
}
```

---

## PRÓXIMO PASSO: CRIAR MÓDULO PRODUCTS

Criar: `backend/src/modules/products/`

**ESTRUTURA:**
```
products/
├── products.module.ts       # Declara imports/providers
├── products.service.ts      # Lógica de negócio
├── products.controller.ts   # Rotas HTTP
├── dto/
│   ├── create-product.dto.ts
│   └── update-product.dto.ts
└── products.controller.spec.ts  # Testes
```

**PRODUCTS.SERVICE.TS** (Lógica crítica):
```typescript
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Produto)
    private produtosRepo: Repository<Produto>,
    private dataSource: DataSource,
  ) {}

  async findAll(tenantId: string): Promise<Produto[]> {
    return this.produtosRepo.find({ 
      where: { tenant_id: tenantId, is_active: true },
      relations: ['categoria'],
    });
  }

  async findOne(id: string, tenantId: string): Promise<Produto> {
    return this.produtosRepo.findOne({ 
      where: { id, tenant_id: tenantId } 
    });
  }

  // CRUD methods...
}
```

---

## PRÓXIMO PASSO: CRIAR ENDPOINTS REST

**PRODUCTS.CONTROLLER.TS**:
```typescript
@Controller('products')
@ApiTags('Products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(@User() user: any) {
    return this.productsService.findAll(user.tenant_id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @User() user: any) {
    return this.productsService.findOne(id, user.tenant_id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseRoles(['admin', 'manager'])
  async create(@Body() dto: CreateProductDto, @User() user: any) {
    return this.productsService.create(dto, user.tenant_id);
  }

  // PUT, DELETE, etc...
}
```

---

## CHECKLIST DE IMPLEMENTAÇÃO

### FASE 1: Setup Base
- [ ] Executar migration SQL no PostgreSQL
- [ ] Configurar TypeORM no app.module.ts
- [ ] Criar conexão de banco no data-source
- [ ] Testar conexão: `curl http://localhost:3001/api/v1/health`

### FASE 2: Entities
- [ ] Criar Tenant.entity.ts
- [ ] Criar Usuario.entity.ts
- [ ] Criar Produto.entity.ts
- [ ] Criar Pedido.entity.ts
- [ ] Criar MovimentacaoEstoque.entity.ts
- [ ] Criar todas as entities restantes

### FASE 3: Módulo Products
- [ ] products.module.ts
- [ ] products.service.ts (findAll, findOne, create, update, delete)
- [ ] products.controller.ts (GET, POST, PUT, DELETE endpoints)
- [ ] DTOs com validação (class-validator)

### FASE 4: Autenticação
- [ ] JWT Strategy
- [ ] Auth Guards
- [ ] Login endpoint
- [ ] Decorator @User() para pegar user atual

### FASE 5: Módulo Orders (CRÍTICO)
- [ ] Implementar lógica FOR UPDATE lock
- [ ] Transação atômica de venda
- [ ] Abater estoque com lock
- [ ] Testar race condition

### FASE 6: Frontend Básico
- [ ] Listagem de produtos
- [ ] Formulário de cadastro
- [ ] Dashboard com vendas

---

## COMANDOS ÚTEIS

```bash
# Docker: Iniciar PostgreSQL + Redis
docker-compose up -d postgres redis

# Executar migration SQL
docker exec -i ucm-postgres psql -U postgres -d ucm < scripts/migrations/001-initial-schema.sql

# Backend: Iniciar dev server
cd backend
npm install
npm run start:dev

# Backend: Verificar health
curl http://localhost:3001/api/v1/health

# Frontend: Iniciar dev server
cd frontend
npm install
npm run dev

# Testar API de produtos (depois de implementar)
curl http://localhost:3001/api/v1/products
```

---

## ARQUIVOS IMPORTANTES PARA CONSULTA

1. **Schema SQL**: `scripts/migrations/001-initial-schema.sql`
2. **Documentação DB**: `docs/04-DATABASE.md`
3. **Workflows**: `docs/06-WORKFLOWS.md`
4. **Features**: `docs/03-FEATURES.md`
5. **Roadmap**: `docs/08-ROADMAP.md`
6. **Memória Contexto**: `MEMORIA_ESTADO_ATUAL.md`

---

## TUDO ESTÁ PRONTO! 🚀

Você tem:
- ✅ Schema SQL completo
- ✅ Documentação detalhada
- ✅ Estrutura de código
- ✅ Docker configurado
- ✅ Configurações prontas

AGORA É SÓ IMPLEMENTAR OS MÓDULOS!
