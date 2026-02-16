/**
 * Script para cadastrar produtos DEMO genÃ©ricos
 * 
 * Este script cadastra produtos genÃ©ricos para demonstraÃ§Ã£o
 * quando o sistema estiver pronto para vender para outros clientes.
 * 
 * Execute: npx ts-node scripts/seeds/seed-demo.ts
 * 
 * NOTA: Este script serÃ¡ criado quando necessÃ¡rio (FASE 2: NeutralizaÃ§Ã£o)
 */

import { DataSource, EntityManager } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

// Carregar .env
config({ path: path.join(__dirname, '../../backend/.env') });

// Importar entities
import { Tenant } from '../../backend/src/database/entities/Tenant.entity';
import { Usuario } from '../../backend/src/database/entities/Usuario.entity';
import { Categoria } from '../../backend/src/database/entities/Categoria.entity';
import { Produto } from '../../backend/src/database/entities/Produto.entity';
import { MovimentacaoEstoque } from '../../backend/src/database/entities/MovimentacaoEstoque.entity';
import { Pedido } from '../../backend/src/database/entities/Pedido.entity';
import { ItemPedido } from '../../backend/src/database/entities/ItemPedido.entity';

const TENANT_DEMO_ID = '11111111-1111-1111-1111-111111111111';

// Produtos genÃ©ricos para demonstraÃ§Ã£o
const PRODUTOS_DEMO = [
  // CATEGORIA 1: Produtos EletrÃ´nicos
  {
    name: 'Produto EletrÃ´nico A',
    price: 99.90,
    description: 'Produto eletrÃ´nico de exemplo para demonstraÃ§Ã£o',
    unit: 'unidade',
    categoria: 'EletrÃ´nicos',
    estoque: 50,
    min_stock: 10,
  },
  {
    name: 'Produto EletrÃ´nico B',
    price: 149.90,
    description: 'Produto eletrÃ´nico de exemplo para demonstraÃ§Ã£o',
    unit: 'unidade',
    categoria: 'EletrÃ´nicos',
    estoque: 30,
    min_stock: 10,
  },
  
  // CATEGORIA 2: Produtos de Moda
  {
    name: 'Produto Moda A',
    price: 79.90,
    description: 'Produto de moda de exemplo para demonstraÃ§Ã£o',
    unit: 'unidade',
    categoria: 'Moda',
    estoque: 40,
    min_stock: 15,
  },
  {
    name: 'Produto Moda B',
    price: 59.90,
    description: 'Produto de moda de exemplo para demonstraÃ§Ã£o',
    unit: 'unidade',
    categoria: 'Moda',
    estoque: 35,
    min_stock: 15,
  },
  
  // CATEGORIA 3: Produtos Casa
  {
    name: 'Produto Casa A',
    price: 49.90,
    description: 'Produto para casa de exemplo para demonstraÃ§Ã£o',
    unit: 'unidade',
    categoria: 'Casa',
    estoque: 60,
    min_stock: 20,
  },
  {
    name: 'Produto Casa B',
    price: 39.90,
    description: 'Produto para casa de exemplo para demonstraÃ§Ã£o',
    unit: 'unidade',
    categoria: 'Casa',
    estoque: 45,
    min_stock: 20,
  },
];

async function seedDemo() {
  console.log('ðŸŒ± Iniciando cadastro de produtos DEMO...\n');

  // Criar DataSource
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [Tenant, Usuario, Categoria, Produto, MovimentacaoEstoque, Pedido, ItemPedido],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('âœ… Conectado ao banco de dados\n');

    // Verificar tenant demo
    const tenantRepo = dataSource.getRepository(Tenant);
    let tenant = await tenantRepo.findOne({ where: { id: TENANT_DEMO_ID } });

    if (!tenant) {
      tenant = tenantRepo.create({
        id: TENANT_DEMO_ID,
        name: 'Loja Demo',
        slug: 'loja-demo',
        is_active: true,
      });
      tenant = await tenantRepo.save(tenant);
      console.log('âœ… Tenant DEMO criado\n');
    } else {
      console.log('âœ… Tenant DEMO jÃ¡ existe\n');
    }

    // Criar/obter categorias
    const categoriaRepo = dataSource.getRepository(Categoria);
    const categoriasMap = new Map<string, Categoria>();

    const categoriasUnicas = [...new Set(PRODUTOS_DEMO.map((p) => p.categoria))];
    for (const nomeCategoria of categoriasUnicas) {
      let categoria = await categoriaRepo.findOne({
        where: { tenant_id: TENANT_DEMO_ID, name: nomeCategoria },
      });

      if (!categoria) {
        categoria = categoriaRepo.create({
          tenant_id: TENANT_DEMO_ID,
          name: nomeCategoria,
          description: `Categoria: ${nomeCategoria}`,
        });
        categoria = await categoriaRepo.save(categoria);
        console.log(`âœ… Categoria criada: ${nomeCategoria}`);
      } else {
        console.log(`âœ… Categoria jÃ¡ existe: ${nomeCategoria}`);
      }

      categoriasMap.set(nomeCategoria, categoria);
    }
    console.log('');

    // Cadastrar produtos
    const produtoRepo = dataSource.getRepository(Produto);
    const estoqueRepo = dataSource.getRepository(MovimentacaoEstoque);

    let produtosCriados = 0;
    let produtosAtualizados = 0;

    for (const produtoData of PRODUTOS_DEMO) {
      const categoria = categoriasMap.get(produtoData.categoria)!;

      let produto = await produtoRepo.findOne({
        where: { tenant_id: TENANT_DEMO_ID, name: produtoData.name },
      });

      if (!produto) {
        produto = produtoRepo.create({
          tenant_id: TENANT_DEMO_ID,
          categoria_id: categoria.id,
          name: produtoData.name,
          price: produtoData.price,
          description: produtoData.description,
          unit: produtoData.unit,
          is_active: true,
        });
        produto = await produtoRepo.save(produto);
        produtosCriados++;
        console.log(`âœ… Produto criado: ${produtoData.name}`);
      } else {
        // Atualizar dados
        produto.price = produtoData.price;
        produto.description = produtoData.description;
        produto = await produtoRepo.save(produto);
        produtosAtualizados++;
        console.log(`ðŸ”„ Produto atualizado: ${produtoData.name}`);
      }

      // Criar/atualizar estoque
      let estoque = await estoqueRepo.findOne({
        where: { tenant_id: TENANT_DEMO_ID, produto_id: produto.id },
      });

      if (!estoque) {
        estoque = estoqueRepo.create({
          tenant_id: TENANT_DEMO_ID,
          produto_id: produto.id,
          current_stock: produtoData.estoque,
          min_stock: produtoData.min_stock,
        });
        await estoqueRepo.save(estoque);
        console.log(`   ðŸ“¦ Estoque: ${produtoData.estoque} unidades (mÃ­nimo: ${produtoData.min_stock})`);
      } else {
        // Atualizar estoque
        estoque.current_stock = produtoData.estoque;
        estoque.min_stock = produtoData.min_stock;
        await estoqueRepo.save(estoque);
        console.log(`   ðŸ“¦ Estoque atualizado: ${produtoData.estoque} unidades (mÃ­nimo: ${produtoData.min_stock})`);
      }
    }

    console.log('\nðŸ“Š Resumo:');
    console.log(`   - Produtos criados: ${produtosCriados}`);
    console.log(`   - Produtos atualizados: ${produtosAtualizados}`);
    console.log(`   - Total de produtos: ${PRODUTOS_DEMO.length}`);
    console.log(`   - Categorias: ${categoriasUnicas.length}\n`);

    console.log('ðŸŽ‰ Cadastro de produtos DEMO concluÃ­do com sucesso!');
    console.log('âœ… Produtos prontos para demonstraÃ§Ã£o\n');

  } catch (error: any) {
    console.error('âŒ Erro ao cadastrar produtos DEMO:', error.message);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

// Executar
seedDemo()
  .then(() => {
    console.log('âœ… Script concluÃ­do!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('âŒ Erro ao executar script:', error);
    process.exit(1);
  });
