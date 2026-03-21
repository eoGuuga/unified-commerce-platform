/**
 * Seed generico para importar catalogo homologado de cliente.
 *
 * Uso:
 *   npx ts-node scripts/seeds/seed-client-catalog.ts
 *   npx ts-node scripts/seeds/seed-client-catalog.ts --dry-run
 *   npx ts-node scripts/seeds/seed-client-catalog.ts --input scripts/data/site/loucas-por-brigadeiro/ucm-homologacao.json
 */

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

config({ path: path.join(__dirname, '../../backend/.env') });

import { Tenant } from '../../backend/src/database/entities/Tenant.entity';
import { Usuario } from '../../backend/src/database/entities/Usuario.entity';
import { Categoria } from '../../backend/src/database/entities/Categoria.entity';
import { Produto } from '../../backend/src/database/entities/Produto.entity';
import { MovimentacaoEstoque } from '../../backend/src/database/entities/MovimentacaoEstoque.entity';
import { Pedido } from '../../backend/src/database/entities/Pedido.entity';
import { ItemPedido } from '../../backend/src/database/entities/ItemPedido.entity';
import {
  buildClientCatalogMetadata,
} from '../../backend/src/modules/whatsapp/services/client-catalog-metadata';

type CatalogAddOnOption = {
  nome: string;
  preco: number;
};

type CatalogAddOnGroup = {
  nome: string;
  regra?: string;
  minimo?: number;
  maximo?: number;
  opcoes?: CatalogAddOnOption[];
};

type CatalogProduct = {
  name: string;
  price: number;
  description?: string;
  categoria: string;
  unit?: string;
  estoque: number;
  min_stock: number;
  disponivel?: boolean;
  image_url?: string;
  adicionais?: CatalogAddOnGroup[];
  metadata?: Record<string, any>;
  sku?: string;
};

type CatalogCategory = {
  external_id?: string;
  name: string;
  slug?: string;
  ordem?: number;
};

type CatalogFile = {
  fonte: string;
  dataExtracao: string;
  observacao?: string;
  loja: {
    nome: string;
    slug: string;
    telefone?: string;
    endereco?: string;
    horario?: string;
    restauranteN?: number;
    vertical?: string;
  };
  categorias?: CatalogCategory[];
  produtos: Record<string, CatalogProduct[]>;
  informativos?: CatalogProduct[];
};

type SeedArgs = {
  inputPath: string;
  tenantId: string;
  tenantSlug?: string;
  tenantName?: string;
  whatsappInstance?: string;
  dryRun: boolean;
};

const DEFAULT_INPUT = path.join(
  __dirname,
  '..',
  'data',
  'site',
  'loucas-por-brigadeiro',
  'ucm-homologacao.json',
);
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000000';

function parseArgs(argv: string[]): SeedArgs {
  const args: SeedArgs = {
    inputPath: DEFAULT_INPUT,
    tenantId: process.env.SEED_TENANT_ID || DEFAULT_TENANT_ID,
    whatsappInstance: process.env.SEED_WHATSAPP_INSTANCE || process.env.EVOLUTION_INSTANCE,
    dryRun: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];

    if ((value === '--input' || value === '-i') && argv[index + 1]) {
      args.inputPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value === '--tenant-id' && argv[index + 1]) {
      args.tenantId = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === '--tenant-slug' && argv[index + 1]) {
      args.tenantSlug = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === '--tenant-name' && argv[index + 1]) {
      args.tenantName = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === '--whatsapp-instance' && argv[index + 1]) {
      args.whatsappInstance = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === '--dry-run') {
      args.dryRun = true;
    }
  }

  return args;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractPhoneNumbers(phone?: string): string[] {
  if (!phone) {
    return [];
  }

  const digits = phone.replace(/\D/g, '');
  if (!digits) {
    return [];
  }

  const candidates = new Set<string>();
  candidates.add(digits);

  if (!digits.startsWith('55')) {
    candidates.add(`55${digits}`);
  }

  if (digits.startsWith('55') && digits.length > 2) {
    candidates.add(digits.slice(2));
  }

  return [...candidates];
}

function buildSku(
  product: CatalogProduct,
  catalog: CatalogFile,
  categoryKey: string,
): string {
  if (product.sku) {
    return product.sku;
  }

  const sourceId = String(product.metadata?.source_product_id || slugify(product.name)).toUpperCase();
  const restaurantId = catalog.loja.restauranteN ? `MD${catalog.loja.restauranteN}` : 'MD';
  const prefix = slugify(catalog.loja.slug || categoryKey).slice(0, 8).toUpperCase() || 'CLIENTE';
  return `${prefix}-${restaurantId}-${sourceId}`;
}

function buildProductMetadata(
  product: CatalogProduct,
  catalog: CatalogFile,
  importedAt: string,
): Record<string, any> {
  return buildClientCatalogMetadata(product, catalog, importedAt);
}

function flattenProducts(catalog: CatalogFile): Array<{ categoryKey: string; product: CatalogProduct }> {
  return Object.entries(catalog.produtos).flatMap(([categoryKey, items]) =>
    items.map((product) => ({ categoryKey, product })),
  );
}

function loadCatalog(filePath: string): CatalogFile {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo de catalogo nao encontrado: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as CatalogFile;
}

function printSummary(
  catalog: CatalogFile,
  tenantId: string,
  tenantSlug: string,
  tenantName: string,
  whatsappInstance?: string,
) {
  const flatProducts = flattenProducts(catalog);
  const totalProducts = flatProducts.length;
  const totalCategories = Object.values(catalog.produtos).filter((items) => items.length > 0).length;
  const totalInformational = catalog.informativos?.length || 0;

  console.log(`Cliente: ${tenantName}`);
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Tenant slug: ${tenantSlug}`);
  console.log(`Fonte: ${catalog.fonte}`);
  console.log(`Categorias vendaveis: ${totalCategories}`);
  console.log(`Produtos vendaveis: ${totalProducts}`);
  console.log(`Itens informativos: ${totalInformational}`);
  console.log(`Telefone homologado: ${catalog.loja.telefone || 'nao informado'}`);
  console.log(`Instancia WhatsApp: ${whatsappInstance || 'nao configurada'}`);
}

async function seedClientCatalog() {
  const args = parseArgs(process.argv);
  const catalog = loadCatalog(args.inputPath);
  const tenantSlug = args.tenantSlug || catalog.loja.slug;
  const tenantName = args.tenantName || catalog.loja.nome;
  const importedAt = new Date().toISOString();

  printSummary(catalog, args.tenantId, tenantSlug, tenantName, args.whatsappInstance);

  if (args.dryRun) {
    console.log('Modo dry-run: nenhuma alteracao no banco foi executada.');
    return;
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [Tenant, Usuario, Categoria, Produto, MovimentacaoEstoque, Pedido, ItemPedido],
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();

  try {
    const tenantRepo = dataSource.getRepository(Tenant);
    const categoriaRepo = dataSource.getRepository(Categoria);
    const produtoRepo = dataSource.getRepository(Produto);
    const estoqueRepo = dataSource.getRepository(MovimentacaoEstoque);

    let tenant = await tenantRepo.findOne({ where: { id: args.tenantId } });

    const normalizedWhatsappNumbers = [
      ...new Set([
        ...extractPhoneNumbers(catalog.loja.telefone),
        ...((tenant?.settings?.whatsappNumbers as string[] | undefined) || []),
      ]),
    ];

    const nextSettings = {
      ...(tenant?.settings || {}),
      vertical: catalog.loja.vertical || 'general',
      whatsappInstance:
        args.whatsappInstance ||
        tenant?.settings?.whatsappInstance ||
        tenant?.settings?.whatsapp_instance ||
        '',
      whatsappNumbers: normalizedWhatsappNumbers,
      store: {
        name: tenantName,
        slug: tenantSlug,
        phone: catalog.loja.telefone || '',
        address: catalog.loja.endereco || '',
        hours: catalog.loja.horario || '',
      },
      sourceCatalog: {
        platform: 'menudireto',
        sourceUrl: catalog.fonte,
        extractedAt: catalog.dataExtracao,
        importedAt,
        restauranteN: catalog.loja.restauranteN || null,
      },
      salesProfile: {
        segmentHint: catalog.loja.vertical === 'chocolateria' ? 'confectionery' : 'general',
        notes: catalog.observacao || '',
      },
      informationalCatalogItems: (catalog.informativos || []).map((item) => ({
        name: item.name,
        description: item.description || '',
        image_url: item.image_url || '',
      })),
    };

    if (!tenant) {
      tenant = tenantRepo.create({
        id: args.tenantId,
        name: tenantName,
        slug: tenantSlug,
        settings: nextSettings,
        is_active: true,
      });
      tenant = await tenantRepo.save(tenant);
      console.log(`Tenant criado: ${tenantName}`);
    } else {
      tenant.name = tenantName;
      tenant.slug = tenantSlug;
      tenant.settings = nextSettings;
      tenant.is_active = true;
      tenant = await tenantRepo.save(tenant);
      console.log(`Tenant atualizado: ${tenantName}`);
    }

    const categoriesMap = new Map<string, Categoria>();
    let createdCategories = 0;
    let createdProducts = 0;
    let updatedProducts = 0;

    for (const category of catalog.categorias || []) {
      const categoryItems = catalog.produtos[category.slug || slugify(category.name)] || [];
      if (!categoryItems.length) {
        continue;
      }

      let categoria = await categoriaRepo.findOne({
        where: { tenant_id: args.tenantId, name: category.name },
      });

      if (!categoria) {
        categoria = categoriaRepo.create({
          tenant_id: args.tenantId,
          name: category.name,
          description: `Categoria importada do catalogo MenuDireto do cliente ${tenantName}.`,
        });
        categoria = await categoriaRepo.save(categoria);
        createdCategories += 1;
      }

      categoriesMap.set(category.name, categoria);
    }

    for (const { categoryKey, product } of flattenProducts(catalog)) {
      const categoria = categoriesMap.get(product.categoria);
      if (!categoria) {
        continue;
      }

      const sku = buildSku(product, catalog, categoryKey);
      const metadata = buildProductMetadata(product, catalog, importedAt);

      let dbProduct = await produtoRepo.findOne({
        where: { tenant_id: args.tenantId, sku },
      });

      if (!dbProduct) {
        dbProduct = await produtoRepo.findOne({
          where: { tenant_id: args.tenantId, name: product.name },
        });
      }

      if (!dbProduct) {
        dbProduct = produtoRepo.create({
          tenant_id: args.tenantId,
          categoria_id: categoria.id,
          sku,
          name: product.name,
          description: product.description || '',
          price: product.price,
          unit: product.unit || 'unidade',
          is_active: product.disponivel !== false,
          metadata,
        });
        dbProduct = await produtoRepo.save(dbProduct);
        createdProducts += 1;
      } else {
        dbProduct.categoria_id = categoria.id;
        dbProduct.sku = sku;
        dbProduct.name = product.name;
        dbProduct.description = product.description || '';
        dbProduct.price = product.price;
        dbProduct.unit = product.unit || dbProduct.unit || 'unidade';
        dbProduct.is_active = product.disponivel !== false;
        dbProduct.metadata = {
          ...(dbProduct.metadata || {}),
          ...metadata,
        };
        dbProduct = await produtoRepo.save(dbProduct);
        updatedProducts += 1;
      }

      let estoque = await estoqueRepo.findOne({
        where: { tenant_id: args.tenantId, produto_id: dbProduct.id },
      });

      if (!estoque) {
        estoque = estoqueRepo.create({
          tenant_id: args.tenantId,
          produto_id: dbProduct.id,
          current_stock: product.estoque,
          reserved_stock: 0,
          min_stock: product.min_stock,
        });
      } else {
        estoque.current_stock = product.estoque;
        estoque.min_stock = product.min_stock;
      }

      await estoqueRepo.save(estoque);
    }

    console.log('');
    console.log('Resumo da importacao:');
    console.log(`- Categorias criadas: ${createdCategories}`);
    console.log(`- Produtos criados: ${createdProducts}`);
    console.log(`- Produtos atualizados: ${updatedProducts}`);
    console.log(`- Produtos vendaveis processados: ${flattenProducts(catalog).length}`);
    console.log(`- Itens informativos guardados em tenant.settings: ${(catalog.informativos || []).length}`);
    console.log('');
    console.log('Catalogo do cliente importado com sucesso.');
  } finally {
    await dataSource.destroy();
  }
}

seedClientCatalog()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erro ao importar catalogo do cliente:', error);
    process.exit(1);
  });
