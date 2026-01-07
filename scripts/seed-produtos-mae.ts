/**
 * Script para cadastrar produtos reais da mãe (cliente beta)
 * 
 * Este script cadastra:
 * - Categorias de doces artesanais
 * - Produtos típicos (bolos, doces, salgados)
 * - Estoque inicial
 * 
 * Execute: npx ts-node scripts/seed-produtos-mae.ts
 */

import { DataSource, EntityManager } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

// Carregar .env
config({ path: path.join(__dirname, '../backend/.env') });

// Importar entities
import { Tenant } from '../backend/src/database/entities/Tenant.entity';
import { Categoria } from '../backend/src/database/entities/Categoria.entity';
import { Produto } from '../backend/src/database/entities/Produto.entity';
import { MovimentacaoEstoque } from '../backend/src/database/entities/MovimentacaoEstoque.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000000';

// Produtos típicos de confeitaria artesanal
const PRODUTOS = [
  // BOLOS
  {
    name: 'Bolo de Chocolate',
    price: '45.00',
    description: 'Bolo de chocolate caseiro, 1kg',
    unit: 'unidade',
    categoria: 'Bolos',
    estoque: 5,
    min_stock: 2,
  },
  {
    name: 'Bolo de Cenoura',
    price: '40.00',
    description: 'Bolo de cenoura com cobertura de chocolate, 1kg',
    unit: 'unidade',
    categoria: 'Bolos',
    estoque: 3,
    min_stock: 2,
  },
  {
    name: 'Bolo Personalizado',
    price: '80.00',
    description: 'Bolo personalizado (encomenda)',
    unit: 'unidade',
    categoria: 'Bolos',
    estoque: 0, // Sempre encomenda
    min_stock: 0,
  },
  
  // DOCES
  {
    name: 'Brigadeiro Gourmet',
    price: '2.50',
    description: 'Brigadeiro feito com chocolate premium',
    unit: 'unidade',
    categoria: 'Doces',
    estoque: 50,
    min_stock: 20,
  },
  {
    name: 'Beijinho',
    price: '2.50',
    description: 'Beijinho tradicional',
    unit: 'unidade',
    categoria: 'Doces',
    estoque: 45,
    min_stock: 20,
  },
  {
    name: 'Brigadeiro de Leite Ninho',
    price: '3.00',
    description: 'Brigadeiro com leite ninho',
    unit: 'unidade',
    categoria: 'Doces',
    estoque: 30,
    min_stock: 15,
  },
  {
    name: 'Brigadeiro de Maracujá',
    price: '3.00',
    description: 'Brigadeiro com recheio de maracujá',
    unit: 'unidade',
    categoria: 'Doces',
    estoque: 25,
    min_stock: 15,
  },
  {
    name: 'Cajuzinho',
    price: '2.50',
    description: 'Cajuzinho tradicional',
    unit: 'unidade',
    categoria: 'Doces',
    estoque: 40,
    min_stock: 20,
  },
  {
    name: 'Brigadeiro Branco',
    price: '2.50',
    description: 'Brigadeiro branco',
    unit: 'unidade',
    categoria: 'Doces',
    estoque: 35,
    min_stock: 15,
  },
  
  // SALGADOS
  {
    name: 'Coxinha',
    price: '4.50',
    description: 'Coxinha de frango',
    unit: 'unidade',
    categoria: 'Salgados',
    estoque: 30,
    min_stock: 15,
  },
  {
    name: 'Risole',
    price: '4.00',
    description: 'Risole de presunto e queijo',
    unit: 'unidade',
    categoria: 'Salgados',
    estoque: 25,
    min_stock: 15,
  },
  {
    name: 'Pastel Assado',
    price: '5.00',
    description: 'Pastel assado recheado',
    unit: 'unidade',
    categoria: 'Salgados',
    estoque: 20,
    min_stock: 10,
  },
  {
    name: 'Enroladinho de Salsicha',
    price: '4.50',
    description: 'Enroladinho de salsicha',
    unit: 'unidade',
    categoria: 'Salgados',
    estoque: 28,
    min_stock: 15,
  },
];

async function seedProdutosMae() {
  console.log('🌱 Iniciando cadastro de produtos da mãe...\n');

  // Criar DataSource
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [Tenant, Categoria, Produto, MovimentacaoEstoque],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Conectado ao banco de dados\n');

    // Verificar tenant
    const tenantRepo = dataSource.getRepository(Tenant);
    let tenant = await tenantRepo.findOne({ where: { id: TENANT_ID } });

    if (!tenant) {
      tenant = tenantRepo.create({
        id: TENANT_ID,
        name: 'Confeitaria da Mãe',
        slug: 'confeitaria-mae',
        is_active: true,
      });
      tenant = await tenantRepo.save(tenant);
      console.log('✅ Tenant criado\n');
    } else {
      console.log('✅ Tenant já existe\n');
    }

    // Criar/obter categorias
    const categoriaRepo = dataSource.getRepository(Categoria);
    const categoriasMap = new Map<string, Categoria>();

    const categoriasUnicas = [...new Set(PRODUTOS.map((p) => p.categoria))];
    for (const nomeCategoria of categoriasUnicas) {
      let categoria = await categoriaRepo.findOne({
        where: { tenant_id: TENANT_ID, name: nomeCategoria },
      });

      if (!categoria) {
        categoria = categoriaRepo.create({
          tenant_id: TENANT_ID,
          name: nomeCategoria,
          description: `Categoria: ${nomeCategoria}`,
          is_active: true,
        });
        categoria = await categoriaRepo.save(categoria);
        console.log(`✅ Categoria criada: ${nomeCategoria}`);
      } else {
        console.log(`✅ Categoria já existe: ${nomeCategoria}`);
      }

      categoriasMap.set(nomeCategoria, categoria);
    }
    console.log('');

    // Cadastrar produtos
    const produtoRepo = dataSource.getRepository(Produto);
    const estoqueRepo = dataSource.getRepository(MovimentacaoEstoque);

    let produtosCriados = 0;
    let produtosAtualizados = 0;

    for (const produtoData of PRODUTOS) {
      const categoria = categoriasMap.get(produtoData.categoria)!;

      let produto = await produtoRepo.findOne({
        where: { tenant_id: TENANT_ID, name: produtoData.name },
      });

      if (!produto) {
        produto = produtoRepo.create({
          tenant_id: TENANT_ID,
          categoria_id: categoria.id,
          name: produtoData.name,
          price: produtoData.price,
          description: produtoData.description,
          unit: produtoData.unit,
          is_active: true,
        });
        produto = await produtoRepo.save(produto);
        produtosCriados++;
        console.log(`✅ Produto criado: ${produtoData.name}`);
      } else {
        // Atualizar dados
        produto.price = produtoData.price;
        produto.description = produtoData.description;
        produto = await produtoRepo.save(produto);
        produtosAtualizados++;
        console.log(`🔄 Produto atualizado: ${produtoData.name}`);
      }

      // Criar/atualizar estoque
      let estoque = await estoqueRepo.findOne({
        where: { tenant_id: TENANT_ID, produto_id: produto.id },
      });

      if (!estoque) {
        estoque = estoqueRepo.create({
          tenant_id: TENANT_ID,
          produto_id: produto.id,
          current_stock: produtoData.estoque,
          min_stock: produtoData.min_stock,
        });
        await estoqueRepo.save(estoque);
        console.log(`   📦 Estoque: ${produtoData.estoque} unidades (mínimo: ${produtoData.min_stock})`);
      } else {
        // Atualizar estoque
        estoque.current_stock = produtoData.estoque;
        estoque.min_stock = produtoData.min_stock;
        await estoqueRepo.save(estoque);
        console.log(`   📦 Estoque atualizado: ${produtoData.estoque} unidades (mínimo: ${produtoData.min_stock})`);
      }
    }

    console.log('\n📊 Resumo:');
    console.log(`   - Produtos criados: ${produtosCriados}`);
    console.log(`   - Produtos atualizados: ${produtosAtualizados}`);
    console.log(`   - Total de produtos: ${PRODUTOS.length}`);
    console.log(`   - Categorias: ${categoriasUnicas.length}\n`);

    console.log('🎉 Cadastro de produtos concluído com sucesso!');
    console.log('✅ Produtos prontos para uso no PDV\n');

  } catch (error: any) {
    console.error('❌ Erro ao cadastrar produtos:', error.message);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

// Executar
seedProdutosMae()
  .then(() => {
    console.log('✅ Script concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro ao executar script:', error);
    process.exit(1);
  });
