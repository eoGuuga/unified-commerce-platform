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
import { Usuario } from '../backend/src/database/entities/Usuario.entity';
import { Categoria } from '../backend/src/database/entities/Categoria.entity';
import { Produto } from '../backend/src/database/entities/Produto.entity';
import { MovimentacaoEstoque } from '../backend/src/database/entities/MovimentacaoEstoque.entity';
import { Pedido } from '../backend/src/database/entities/Pedido.entity';
import { ItemPedido } from '../backend/src/database/entities/ItemPedido.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000000';

  // Produtos REAIS da Loucas por Brigadeiro
  // Extraído de: https://loucasporbrigadeiro.my.canva.site/loucas-por-brigadeiro
const PRODUTOS = [
  // BOLOS DE FESTA
  {
    name: 'Mini Bolo Casadinho',
    price: 48.00,
    description: 'Mini bolo casadinho, peso aproximado 500 gramas (serve até 4 pessoas)',
    unit: 'unidade',
    categoria: 'Bolos',
    estoque: 0, // Sempre encomenda
    min_stock: 0,
  },
  {
    name: 'Mini Bolo Ninho com Nutella',
    price: 52.00,
    description: 'Mini bolo ninho com nutella, peso aproximado 500 gramas (serve até 4 pessoas)',
    unit: 'unidade',
    categoria: 'Bolos',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Mini Bolo Brigadeiro',
    price: 48.00,
    description: 'Mini bolo brigadeiro, peso aproximado 500 gramas (serve até 4 pessoas)',
    unit: 'unidade',
    categoria: 'Bolos',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Mini Bolo Prestígio',
    price: 48.00,
    description: 'Mini bolo prestígio, peso aproximado 500 gramas (serve até 4 pessoas)',
    unit: 'unidade',
    categoria: 'Bolos',
    estoque: 0,
    min_stock: 0,
  },
  
  // BOLOS GELADOS
  {
    name: 'Bolo Gelado Delícia de Abacaxi',
    price: 110.00,
    description: 'Bolo gelado delícia de abacaxi - serve até 15 pessoas',
    unit: 'unidade',
    categoria: 'Bolos',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Bolo Gelado Doce de Leite com Coco',
    price: 110.00,
    description: 'Bolo gelado doce de leite com coco - serve até 15 pessoas',
    unit: 'unidade',
    categoria: 'Bolos',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Bolo Gelado Frutas Vermelhas',
    price: 110.00,
    description: 'Bolo gelado frutas vermelhas - serve até 15 pessoas',
    unit: 'unidade',
    categoria: 'Bolos',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Bolo Gelado Prestígio',
    price: 110.00,
    description: 'Bolo gelado prestígio - serve até 15 pessoas',
    unit: 'unidade',
    categoria: 'Bolos',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Bolo Gelado Coco',
    price: 120.00,
    description: 'Bolo gelado coco - serve até 15 pessoas',
    unit: 'unidade',
    categoria: 'Bolos',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Bolo Gelado Doce de Leite com Ameixa',
    price: 120.00,
    description: 'Bolo gelado doce de leite com ameixa - serve até 15 pessoas',
    unit: 'unidade',
    categoria: 'Bolos',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Bolo Gelado Dueto Coco Cremoso',
    price: 120.00,
    description: 'Bolo gelado dueto coco cremoso - serve até 15 pessoas',
    unit: 'unidade',
    categoria: 'Bolos',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Decoração Opcional Bolo Gelado',
    price: 30.00,
    description: 'Decoração opcional: 6 morangos + 6 brigadeiros ao leite e 100 grs raspas de chocolate',
    unit: 'unidade',
    categoria: 'Bolos',
    estoque: 999,
    min_stock: 0,
  },
  
  // DOCES DE FESTA
  {
    name: 'Doces Tradicionais - 1/2 Cento',
    price: 95.00,
    description: '1/2 cento de doces tradicionais (Beijinho, Brigadeiro tradicional, Leite ninho, Bicho de pé, Prestígio, Paçoca, Sensação)',
    unit: '1/2 cento',
    categoria: 'Doces',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Doces Tradicionais - Cento',
    price: 180.00,
    description: 'Cento de doces tradicionais (Beijinho, Brigadeiro tradicional, Leite ninho, Bicho de pé, Prestígio, Paçoca, Sensação)',
    unit: 'cento',
    categoria: 'Doces',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Doces Clássicos - 1/2 Cento',
    price: 105.00,
    description: '1/2 cento de doces clássicos (Bicho de pé com nutella, Ninho com nutella, Uva com ninho, Churros, Uva com brigadeiro, Tradicional com nutella, Ferrero rocher)',
    unit: '1/2 cento',
    categoria: 'Doces',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Doces Clássicos - Cento',
    price: 200.00,
    description: 'Cento de doces clássicos (Bicho de pé com nutella, Ninho com nutella, Uva com ninho, Churros, Uva com brigadeiro, Tradicional com nutella, Ferrero rocher)',
    unit: 'cento',
    categoria: 'Doces',
    estoque: 0,
    min_stock: 0,
  },
  
  // LEMBRANCINHAS
  {
    name: 'Pão de Mel',
    price: 14.00,
    description: 'Pão de mel artesanal',
    unit: 'unidade',
    categoria: 'Lembrancinhas',
    estoque: 20,
    min_stock: 10,
  },
  {
    name: 'Pastelzinho Ninho com Nutella',
    price: 11.00,
    description: 'Pastelzinho recheado com ninho e nutella',
    unit: 'unidade',
    categoria: 'Lembrancinhas',
    estoque: 20,
    min_stock: 10,
  },
  {
    name: 'Brownie Tradicional',
    price: 12.00,
    description: 'Brownie tradicional artesanal',
    unit: 'unidade',
    categoria: 'Lembrancinhas',
    estoque: 20,
    min_stock: 10,
  },
  {
    name: 'Brownie Duplo Ninho e Brigadeiro',
    price: 29.90,
    description: 'Brownie duplo com ninho e brigadeiro',
    unit: 'unidade',
    categoria: 'Lembrancinhas',
    estoque: 15,
    min_stock: 8,
  },
  {
    name: 'Cone Trufado',
    price: 14.00,
    description: 'Cone trufado (ninho e brigadeiro)',
    unit: 'unidade',
    categoria: 'Lembrancinhas',
    estoque: 20,
    min_stock: 10,
  },
  {
    name: 'Caixa Brigadeiro Belga 6 unidades',
    price: 26.00,
    description: 'Caixa com brigadeiro belga - 6 unidades',
    unit: 'caixa',
    categoria: 'Lembrancinhas',
    estoque: 15,
    min_stock: 8,
  },
  {
    name: 'Caixa Brigadeiro Belga 12 unidades',
    price: 48.00,
    description: 'Caixa com brigadeiro belga - 12 unidades',
    unit: 'caixa',
    categoria: 'Lembrancinhas',
    estoque: 15,
    min_stock: 8,
  },
  
  // SOBREMESAS
  {
    name: 'Banoffee',
    price: 110.00,
    description: 'Torta banoffee deliciosa',
    unit: 'unidade',
    categoria: 'Sobremesas',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Torta de Maracujá',
    price: 110.00,
    description: 'Mousse levinho, base de biscoito, ganache de chocolate ao leite',
    unit: 'unidade',
    categoria: 'Sobremesas',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Torta de Limão',
    price: 110.00,
    description: 'Mousse levinho, base de biscoito, chantilly raspas de limão',
    unit: 'unidade',
    categoria: 'Sobremesas',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Torta de Limão Grande',
    price: 130.00,
    description: 'Torta de limão inteira - Mousse levinho, base de biscoito, chantilly raspas de limão',
    unit: 'unidade',
    categoria: 'Sobremesas',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Torta Supremo de Morango',
    price: 190.00,
    description: 'Creme branquinho, base de biscoito, morangos frescos, finalizado com ganache ao leite',
    unit: 'unidade',
    categoria: 'Sobremesas',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Bombom de Uva',
    price: 72.00,
    description: 'Brigadeiro ao leite cremoso, creme branquinho e uvas frescas',
    unit: 'unidade',
    categoria: 'Sobremesas',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Bombom de Morango',
    price: 72.00,
    description: 'Brigadeiro ao leite cremoso, creme branquinho e morangos frescos',
    unit: 'unidade',
    categoria: 'Sobremesas',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Delícia de Abacaxi',
    price: 72.00,
    description: 'Cremoso branquinho, abacaxi, bolo branco e chantilly',
    unit: 'unidade',
    categoria: 'Sobremesas',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Mousse de Limão',
    price: 72.00,
    description: 'Mousse levinho, farofa biscoito, chantilly raspas de limão',
    unit: 'unidade',
    categoria: 'Sobremesas',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Banoffe',
    price: 72.00,
    description: 'Farofa biscoito, creme belga, banana caramelizada, doce de leite e chantilly',
    unit: 'unidade',
    categoria: 'Sobremesas',
    estoque: 0,
    min_stock: 0,
  },
  
  // NATAL
  {
    name: 'Kit Feliz',
    price: 65.00,
    description: 'Kit feliz: 1 chocotone gotas 400gr, 1 bala de brigadeiro 100gr, 1 cone trufado (ninho e brigadeiro), 1 brownie, sacola personalizada',
    unit: 'kit',
    categoria: 'Natal',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Kit Boas Festas',
    price: 23.00,
    description: 'Kit boas festas: 1 chocotone gotas 400gr, 1 bala de brigadeiro 100gr, 1 cone trufado (ninho e brigadeiro), 1 brownie, sacola personalizada',
    unit: 'kit',
    categoria: 'Natal',
    estoque: 0,
    min_stock: 0,
  },
  {
    name: 'Kit Natal',
    price: 60.00,
    description: 'Kit natal: 1 mini chocotone recheado (Brigadeiro), 1 brownie, 1 cone trufado (ninho e brigadeiro)',
    unit: 'kit',
    categoria: 'Natal',
    estoque: 0,
    min_stock: 0,
  },
];

async function seedProdutosMae() {
  console.log('🌱 Iniciando cadastro de produtos da mãe...\n');

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
    console.log('✅ Conectado ao banco de dados\n');

    // Verificar tenant
    const tenantRepo = dataSource.getRepository(Tenant);
    let tenant = await tenantRepo.findOne({ where: { id: TENANT_ID } });

    if (!tenant) {
      tenant = tenantRepo.create({
        id: TENANT_ID,
        name: 'Loucas por Brigadeiro',
        slug: 'loucas-por-brigadeiro',
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
