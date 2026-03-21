#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const DEFAULT_URL = 'https://menudireto.com/loucas-por-brigadeiro/#12';
const OUTPUT_ROOT = path.resolve(__dirname, '..', '..', 'data', 'site');

const HTML_ENTITIES = new Map([
  ['&quot;', '"'],
  ['&#34;', '"'],
  ['&#39;', "'"],
  ['&apos;', "'"],
  ['&amp;', '&'],
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&nbsp;', ' '],
]);

function parseArgs(argv) {
  const args = {
    url: DEFAULT_URL,
    outputDir: '',
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];

    if ((value === '--url' || value === '-u') && argv[index + 1]) {
      args.url = argv[index + 1];
      index += 1;
      continue;
    }

    if ((value === '--output-dir' || value === '-o') && argv[index + 1]) {
      args.outputDir = argv[index + 1];
      index += 1;
      continue;
    }
  }

  return args;
}

function decodeHtmlEntities(value) {
  if (!value) {
    return '';
  }

  let decoded = value;

  for (const [entity, replacement] of HTML_ENTITIES.entries()) {
    decoded = decoded.split(entity).join(replacement);
  }

  decoded = decoded.replace(/&#(\d+);/g, (_, code) => {
    const numeric = Number(code);
    return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : _;
  });

  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, code) => {
    const numeric = Number.parseInt(code, 16);
    return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : _;
  });

  return decoded;
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripTags(value) {
  return normalizeWhitespace(
    decodeHtmlEntities(value)
      .replace(/<br\s*\/?>/gi, ' / ')
      .replace(/<[^>]+>/g, ' '),
  );
}

function titleCasePtBr(value) {
  const lowerWords = new Set([
    'a',
    'as',
    'ao',
    'aos',
    'com',
    'da',
    'das',
    'de',
    'do',
    'dos',
    'e',
    'em',
    'na',
    'nas',
    'no',
    'nos',
    'ou',
    'para',
    'por',
    'sem',
  ]);

  return value
    .toLocaleLowerCase('pt-BR')
    .split(/(\s+)/)
    .map((token, index) => {
      if (/^\s+$/.test(token) || !token) {
        return token;
      }

      if (token === 'pix') {
        return 'PIX';
      }

      if (token === 'ifood') {
        return 'iFood';
      }

      if (index > 0 && lowerWords.has(token)) {
        return token;
      }

      return token.charAt(0).toLocaleUpperCase('pt-BR') + token.slice(1);
    })
    .join('')
    .replace(/\bMl\b/g, 'ml')
    .replace(/\bKg\b/g, 'kg')
    .replace(/\bG\b/g, 'g');
}

function normalizeDisplayText(value) {
  const cleaned = stripTags(value);

  if (!cleaned) {
    return '';
  }

  const letters = cleaned.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const looksUppercase = letters && cleaned === cleaned.toUpperCase();

  return looksUppercase ? titleCasePtBr(cleaned) : cleaned;
}

function normalizeCategoryName(value) {
  return titleCasePtBr(stripTags(value).replace(/[!?.]+$/g, ''));
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function priceFromText(value) {
  const normalized = value.replace(',', '.').replace(/[^\d.]+/g, '');
  return Number.parseFloat(normalized || '0');
}

function extractFirst(value, pattern, fallback = '') {
  const match = value.match(pattern);
  return match ? match[1] : fallback;
}

function resolveAssetUrl(relativePath, baseUrl) {
  if (!relativePath) {
    return '';
  }

  return new URL(relativePath, baseUrl).toString();
}

function inferUnit(productName, categoryName) {
  const text = `${productName} ${categoryName}`.toLocaleLowerCase('pt-BR');

  if (text.includes('caixa')) {
    return 'caixa';
  }

  if (text.includes('fatia')) {
    return 'fatia';
  }

  if (text.includes('bolo no pote')) {
    return 'pote';
  }

  if (text.includes('bebida') || text.includes('refrigerante') || text.includes('suco') || text.includes('água') || text.includes('agua')) {
    return 'unidade';
  }

  if (text.includes('açaí') || text.includes('acai')) {
    return 'copo';
  }

  if (/\b\d+\s*ml\b/i.test(text)) {
    return 'unidade';
  }

  return 'unidade';
}

function inferHomologationStock(categoryName, orderable) {
  if (!orderable) {
    return { estoque: 0, min_stock: 0 };
  }

  const category = categoryName.toLocaleLowerCase('pt-BR');

  if (category.includes('açaí') || category.includes('acai')) {
    return { estoque: 20, min_stock: 5 };
  }

  if (category.includes('docinho') || category.includes('delícia') || category.includes('delicia') || category.includes('bala')) {
    return { estoque: 40, min_stock: 10 };
  }

  if (category.includes('bolo no pote')) {
    return { estoque: 25, min_stock: 6 };
  }

  if (category.includes('gelado') || category.includes('fatias')) {
    return { estoque: 10, min_stock: 3 };
  }

  if (category.includes('vulcão') || category.includes('vulcao')) {
    return { estoque: 8, min_stock: 2 };
  }

  if (category.includes('bebida')) {
    return { estoque: 20, min_stock: 5 };
  }

  if (category.includes('presentear')) {
    return { estoque: 12, min_stock: 3 };
  }

  return { estoque: 15, min_stock: 4 };
}

function inferSalesTags(product) {
  const source = `${product.name} ${product.description} ${product.category_name}`.toLocaleLowerCase('pt-BR');
  const tags = [];

  const checks = [
    ['brigadeiro', 'brigadeiro'],
    ['ninho', 'ninho'],
    ['nutella', 'nutella'],
    ['morango', 'morango'],
    ['uva', 'uva'],
    ['coco', 'coco'],
    ['maracujá', 'maracuja'],
    ['maracuja', 'maracuja'],
    ['presente', 'presente'],
    ['presentear', 'presente'],
    ['caixa', 'caixa'],
    ['kit', 'kit'],
    ['bolo', 'bolo'],
    ['pote', 'pote'],
    ['açaí', 'acai'],
    ['acai', 'acai'],
    ['bebida', 'bebida'],
    ['trufado', 'trufado'],
    ['refrigerante', 'bebida'],
    ['colher', 'acessorio'],
    ['pix', 'pagamento'],
  ];

  for (const [needle, tag] of checks) {
    if (source.includes(needle) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }

  if (!tags.includes('chocolateria')) {
    tags.unshift('chocolateria');
  }

  return tags;
}

function parseStoreInfo(pageHtml, pageUrl) {
  const restauranteN = Number.parseInt(
    extractFirst(pageHtml, /window\.restauranteN\s*=\s*(\d+)/i, '0'),
    10,
  );

  const rawPath = new URL(pageUrl).pathname.replace(/\/+$/, '');
  const slug = slugify(rawPath.split('/').filter(Boolean).pop() || 'cliente-menudireto');

  return {
    name: normalizeDisplayText(extractFirst(pageHtml, /<title>(.*?)<\/title>/i)),
    slug,
    restauranteN,
    appName: extractFirst(pageHtml, /window\.appName\s*=\s*"([^"]+)"/i),
    address: normalizeDisplayText(extractFirst(pageHtml, /window\.enderecoModelo\s*=\s*"([^"]+)"/i)),
    phone: normalizeWhitespace(extractFirst(pageHtml, /<a id="tel">(.*?)<\/a>/i)),
    schedule: normalizeDisplayText(
      extractFirst(pageHtml, /<span id="headerText4">Funcionamento:\s*Das\s*(.*?)<\/span>/i)
        || extractFirst(pageHtml, /<span id="horariosLabelMobile">(.*?)<\/span>/i),
    ),
    description: normalizeDisplayText(extractFirst(pageHtml, /<meta name="description" content="([^"]+)"/i)),
    logoUrl: resolveAssetUrl(extractFirst(pageHtml, /<img id="logoImg" src="([^"]+)"/i), pageUrl),
    coverUrl: resolveAssetUrl(extractFirst(pageHtml, /background:\s*url\('([^']+)'/i), pageUrl),
    sourceUrl: pageUrl,
  };
}

function parseCategories(scrollHtml) {
  const categories = [];
  const categoryRegex = /<a href="#([^"]+)">([\s\S]*?)<\/a>/gi;
  let match = categoryRegex.exec(scrollHtml);
  let position = 1;

  while (match) {
    categories.push({
      external_id: match[1],
      name: normalizeCategoryName(match[2]),
      slug: slugify(normalizeCategoryName(match[2])),
      position,
    });

    position += 1;
    match = categoryRegex.exec(scrollHtml);
  }

  return categories;
}

function parseProducts(productsHtml, categoriesById, productsUrl) {
  const products = [];
  const productRegex =
    /<div class='productsLComImgMobile'>[\s\S]*?<div class='productsCol' onclick='teste\((\d+),([^,]+),(\d+),&#34;([^&#]*)&#34;,(\d+)\)'>[\s\S]*?<div class='productLabel'>([\s\S]*?)<\/div>[\s\S]*?<div class='productDescription'>([\s\S]*?)<\/div>[\s\S]*?<img class='productImage' src='([^']+)'\/>[\s\S]*?<div class='productPrice'>\s*R\$\s*([0-9.]+)\s*<\/div>/gi;
  const seenIds = new Set();
  let match = productRegex.exec(productsHtml);
  let position = 1;

  while (match) {
    const [
      ,
      productId,
      priceFromOnclick,
      categoryId,
      rawGroupIds,
      rawCount,
      rawName,
      rawDescription,
      rawImage,
      rawPrice,
    ] = match;

    if (seenIds.has(productId)) {
      match = productRegex.exec(productsHtml);
      continue;
    }

    seenIds.add(productId);

    const category = categoriesById.get(categoryId) || {
      external_id: categoryId,
      name: `Categoria ${categoryId}`,
      slug: `categoria-${categoryId}`,
      position: 999,
    };

    const name = normalizeDisplayText(rawName);
    const description = normalizeDisplayText(rawDescription);
    const price = Number.parseFloat(rawPrice);
    const add_on_group_ids = rawGroupIds
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value && value !== 'nada');

    const orderable =
      category.slug !== 'informacoes'
      && price > 0;

    products.push({
      external_id: productId,
      position,
      name,
      description,
      price,
      price_display: `R$ ${price.toFixed(2)}`,
      source_price_from_onclick: priceFromText(String(priceFromOnclick)),
      category_external_id: category.external_id,
      category_name: category.name,
      category_slug: category.slug,
      image_url: resolveAssetUrl(rawImage, productsUrl),
      add_on_group_ids,
      raw_count: Number.parseInt(rawCount, 10),
      orderable,
      kind: orderable ? 'product' : 'informational',
      unit_hint: inferUnit(name, category.name),
    });

    position += 1;
    match = productRegex.exec(productsHtml);
  }

  return products;
}

function parseAddOnGroup(html, groupId) {
  const title = normalizeDisplayText(extractFirst(html, /<div id='groupTemp'>(.*?)<\/div>/i));
  const ruleText = normalizeDisplayText(extractFirst(html, /<div id='displayMinMaxTemp'>(.*?)<\/div>/i));
  const minimum = Number.parseInt(extractFirst(html, /<div id='minimoTemp'>(.*?)<\/div>/i, '0'), 10);
  const maximum = Number.parseInt(extractFirst(html, /<div id='maximoTemp'>(.*?)<\/div>/i, '0'), 10);
  const divideValue = Number.parseInt(extractFirst(html, /<div id='divideValorTemp'>(.*?)<\/div>/i, '0'), 10);
  const useHighestValue = Number.parseInt(extractFirst(html, /<div id='usaMaiorValorTemp'>(.*?)<\/div>/i, '0'), 10);
  const splitQuantity = Number.parseInt(extractFirst(html, /<div id='quantosDividemTemp'>(.*?)<\/div>/i, '0'), 10);
  const splitPrice = Number.parseFloat(extractFirst(html, /<div id='precoDivididoTemp'>(.*?)<\/div>/i, '0'));
  const options = [];
  const optionRegex =
    /<div class='bebida'><div class='bebidaLabel' id='(\d+)'>([\s\S]*?)<\/div><div class='bebidaDescription'>([\s\S]*?)<\/div><div class='itemPriceComplementos'>R\$\s*([0-9.]+)<\/div><\/div>/gi;
  let optionMatch = optionRegex.exec(html);

  while (optionMatch) {
    options.push({
      external_id: optionMatch[1],
      name: normalizeDisplayText(optionMatch[2]),
      description: normalizeDisplayText(optionMatch[3]),
      price: Number.parseFloat(optionMatch[4]),
      price_display: `R$ ${Number.parseFloat(optionMatch[4]).toFixed(2)}`,
    });

    optionMatch = optionRegex.exec(html);
  }

  return {
    external_id: groupId,
    title,
    rule_text: ruleText,
    minimum: Number.isNaN(minimum) ? 0 : minimum,
    maximum: Number.isNaN(maximum) ? 0 : maximum,
    divide_value: Number.isNaN(divideValue) ? 0 : divideValue,
    use_highest_value: Number.isNaN(useHighestValue) ? 0 : useHighestValue,
    split_quantity: Number.isNaN(splitQuantity) ? 0 : splitQuantity,
    split_price: Number.isNaN(splitPrice) ? 0 : splitPrice,
    options,
  };
}

async function fetchText(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Falha ao buscar ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function buildCatalog(pageUrl) {
  const pageHtml = await fetchText(pageUrl);
  const store = parseStoreInfo(pageHtml, pageUrl);
  const scrollUrl = `https://menudireto.com/sources/MODELO/getScrollMenu.php?restauranteN=${store.restauranteN}`;
  const productsUrl = `https://menudireto.com/sources/MODELO/getProducts6.php?restauranteN=${store.restauranteN}`;
  const scrollHtml = await fetchText(scrollUrl);
  const productsHtml = await fetchText(productsUrl);
  const categories = parseCategories(scrollHtml);
  const categoriesById = new Map(categories.map((category) => [category.external_id, category]));
  const products = parseProducts(productsHtml, categoriesById, productsUrl);
  const addOnGroups = [];

  for (const product of products) {
    product.add_on_groups = [];

    for (const groupId of product.add_on_group_ids) {
      const groupUrl = `https://menudireto.com/sources/MODELO/getAdd5.php?productsid=${product.external_id}&catAdicionalId=${groupId}&restauranteN=${store.restauranteN}`;
      const groupHtml = await fetchText(groupUrl);
      const group = parseAddOnGroup(groupHtml, groupId);
      group.product_external_id = product.external_id;
      group.product_name = product.name;
      group.source_url = groupUrl;
      product.add_on_groups.push(group);
      addOnGroups.push(group);
    }
  }

  const orderableProducts = products.filter((product) => product.orderable);
  const informationalProducts = products.filter((product) => !product.orderable);
  const totalAddOnOptions = addOnGroups.reduce((sum, group) => sum + group.options.length, 0);

  return {
    extracted_at: new Date().toISOString(),
    source: {
      platform: 'MenuDireto',
      store_url: pageUrl,
      restauranteN: store.restauranteN,
      endpoints: {
        scroll_menu: scrollUrl,
        products: productsUrl,
      },
    },
    store,
    categories,
    products,
    add_on_groups: addOnGroups,
    summary: {
      total_categories: categories.length,
      total_products: products.length,
      orderable_products: orderableProducts.length,
      informational_products: informationalProducts.length,
      add_on_groups: addOnGroups.length,
      add_on_options: totalAddOnOptions,
      categories: categories.map((category) => ({
        external_id: category.external_id,
        name: category.name,
        total_products: products.filter((product) => product.category_external_id === category.external_id).length,
        orderable_products: products.filter(
          (product) => product.category_external_id === category.external_id && product.orderable,
        ).length,
      })),
    },
  };
}

function buildHomologationDraft(catalog) {
  const groupedProducts = {};
  const informationalItems = [];

  for (const category of catalog.categories) {
    groupedProducts[category.slug] = [];
  }

  for (const product of catalog.products) {
    const stock = inferHomologationStock(product.category_name, product.orderable);
    const draftProduct = {
      name: product.name,
      price: product.price,
      description: product.description,
      categoria: product.category_name,
      unit: product.unit_hint,
      estoque: stock.estoque,
      min_stock: stock.min_stock,
      disponivel: product.orderable,
      image_url: product.image_url,
      adicionais: product.add_on_groups.map((group) => ({
        nome: group.title,
        regra: group.rule_text,
        minimo: group.minimum,
        maximo: group.maximum,
        opcoes: group.options.map((option) => ({
          nome: option.name,
          preco: option.price,
        })),
      })),
      metadata: {
        source: 'menudireto',
        store_slug: catalog.store.slug,
        source_product_id: product.external_id,
        source_category_id: product.category_external_id,
        source_category_slug: product.category_slug,
        source_store_url: catalog.source.store_url,
        kind: product.kind,
        homologation_stock_is_synthetic: true,
        sales_tags: inferSalesTags(product),
      },
    };

    if (product.orderable) {
      groupedProducts[product.category_slug].push(draftProduct);
    } else {
      informationalItems.push(draftProduct);
    }
  }

  return {
    fonte: catalog.source.store_url,
    dataExtracao: catalog.extracted_at,
    observacao:
      'Estoque e min_stock nesta estrutura sao sinteticos, usados apenas para homologacao inicial de bot, PDV e estoque. Os dados comerciais reais devem ser preenchidos na fase oficial.',
    loja: {
      nome: catalog.store.name,
      slug: catalog.store.slug,
      telefone: catalog.store.phone,
      endereco: catalog.store.address,
      horario: catalog.store.schedule,
      restauranteN: catalog.store.restauranteN,
      vertical: 'chocolateria',
    },
    categorias: catalog.categories.map((category) => ({
      external_id: category.external_id,
      name: category.name,
      slug: category.slug,
      ordem: category.position,
    })),
    produtos: groupedProducts,
    informativos: informationalItems,
    resumo: {
      categorias: catalog.summary.total_categories,
      produtos_catalogo: catalog.summary.total_products,
      produtos_vendaveis: catalog.summary.orderable_products,
      itens_informativos: catalog.summary.informational_products,
      grupos_adicionais: catalog.summary.add_on_groups,
      opcoes_adicionais: catalog.summary.add_on_options,
    },
  };
}

function buildMarkdownSummary(catalog) {
  const categoryLines = catalog.summary.categories
    .map((category) => `- ${category.name}: ${category.total_products} itens (${category.orderable_products} vendaveis)`)
    .join('\n');

  return [
    `# ${catalog.store.name} - Extracao MenuDireto`,
    '',
    `- Extraido em: ${catalog.extracted_at}`,
    `- Fonte: ${catalog.source.store_url}`,
    `- RestauranteN: ${catalog.store.restauranteN}`,
    `- Telefone: ${catalog.store.phone}`,
    `- Endereco: ${catalog.store.address}`,
    `- Horario: ${catalog.store.schedule}`,
    `- Plataforma: ${catalog.source.platform}`,
    '',
    '## Resumo',
    '',
    `- Categorias: ${catalog.summary.total_categories}`,
    `- Produtos totais: ${catalog.summary.total_products}`,
    `- Produtos vendaveis: ${catalog.summary.orderable_products}`,
    `- Itens informativos: ${catalog.summary.informational_products}`,
    `- Grupos de adicionais: ${catalog.summary.add_on_groups}`,
    `- Opcoes de adicionais: ${catalog.summary.add_on_options}`,
    '',
    '## Categorias',
    '',
    categoryLines,
    '',
    '## Arquivos gerados',
    '',
    '- `menudireto-catalog.json`: extracao estruturada fiel ao MenuDireto.',
    '- `ucm-homologacao.json`: rascunho normalizado para homologacao de bot, PDV e estoque.',
    '',
    '## Observacao',
    '',
    'Os campos `estoque` e `min_stock` do rascunho de homologacao sao sinteticos e servem apenas para testes iniciais. Na homologacao oficial, esses valores devem ser substituidos pelos dados reais do cliente.',
    '',
  ].join('\n');
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv);
  const catalog = await buildCatalog(args.url);
  const outputDir = args.outputDir
    ? path.resolve(args.outputDir)
    : path.join(OUTPUT_ROOT, catalog.store.slug);
  const rawCatalogPath = path.join(outputDir, 'menudireto-catalog.json');
  const homologationPath = path.join(outputDir, 'ucm-homologacao.json');
  const readmePath = path.join(outputDir, 'README.md');

  await ensureDir(outputDir);
  await writeJson(rawCatalogPath, catalog);
  await writeJson(homologationPath, buildHomologationDraft(catalog));
  await fs.writeFile(readmePath, `${buildMarkdownSummary(catalog)}\n`, 'utf8');

  console.log(`Cliente: ${catalog.store.name}`);
  console.log(`RestauranteN: ${catalog.store.restauranteN}`);
  console.log(`Categorias: ${catalog.summary.total_categories}`);
  console.log(`Produtos totais: ${catalog.summary.total_products}`);
  console.log(`Produtos vendaveis: ${catalog.summary.orderable_products}`);
  console.log(`Itens informativos: ${catalog.summary.informational_products}`);
  console.log(`Grupos de adicionais: ${catalog.summary.add_on_groups}`);
  console.log(`Opcoes de adicionais: ${catalog.summary.add_on_options}`);
  console.log(`Saida: ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
