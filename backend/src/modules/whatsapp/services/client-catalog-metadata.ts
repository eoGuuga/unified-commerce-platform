export type ClientCatalogAddOnOption = {
  nome: string;
  preco: number;
};

export type ClientCatalogAddOnGroup = {
  nome: string;
  regra?: string;
  minimo?: number;
  maximo?: number;
  opcoes?: ClientCatalogAddOnOption[];
};

export type ClientCatalogProductInput = {
  name: string;
  description?: string;
  categoria: string;
  image_url?: string;
  adicionais?: ClientCatalogAddOnGroup[];
  metadata?: Record<string, any>;
};

export type ClientCatalogContextInput = {
  fonte: string;
  loja: {
    slug: string;
    restauranteN?: number;
  };
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function deriveClientCatalogSalesTags(product: ClientCatalogProductInput): string[] {
  const combined = normalizeWhitespace(
    [
      product.name,
      product.description || '',
      product.categoria,
      ...(Array.isArray(product.metadata?.sales_tags) ? product.metadata.sales_tags : []),
    ]
      .filter(Boolean)
      .join(' '),
  ).toLowerCase();

  const tags = new Set<string>(['chocolateria']);
  const checks: Array<[RegExp, string]> = [
    [/\bbrigadeiro\b/, 'brigadeiro'],
    [/\bninho\b/, 'ninho'],
    [/\bnutella\b/, 'nutella'],
    [/\bmorango\b/, 'morango'],
    [/\buva\b/, 'uva'],
    [/\bcoco\b/, 'coco'],
    [/\bmaracuja|maracujá\b/, 'maracuja'],
    [/\bpresent|mimo|caixa|cartao|cartão|sacola|kit\b/, 'presente'],
    [/\bpremium|luxo|presenteavel|presenteável\b/, 'premium'],
    [/\bpote\b/, 'pote'],
    [/\bbolo\b/, 'bolo'],
    [/\bbrownie\b/, 'brownie'],
    [/\ba[cç]ai\b/, 'acai'],
    [/\bbebida|agua|água|coca|suco|refrigerante\b/, 'bebida'],
    [/\btrufa|trufado\b/, 'trufado'],
    [/\bcombo|3 unidades|6 brigadeiros|12 brigadeiros\b/, 'compartilhar'],
    [/\bindividual|avulsa|mimo\b/, 'mimo_individual'],
  ];

  checks.forEach(([pattern, tag]) => {
    if (pattern.test(combined)) {
      tags.add(tag);
    }
  });

  return [...tags];
}

function buildWhatsappHint(product: ClientCatalogProductInput, tags: string[]): string {
  if (tags.includes('presente') && tags.includes('premium')) {
    return 'presente pronto para entregar, com leitura premium e boa primeira impressao.';
  }

  if (tags.includes('presente')) {
    return 'boa opcao para presentear sem precisar explicar demais.';
  }

  if (tags.includes('pote')) {
    return 'mimo individual cremoso, facil de vender por impulso.';
  }

  if (tags.includes('acai')) {
    return 'opcao gelada com montagem personalizada e boa conversa de complementos.';
  }

  if (tags.includes('bebida')) {
    return 'item de apoio para completar ticket e acompanhar doce.';
  }

  if (tags.includes('compartilhar')) {
    return 'funciona bem para dividir ou levar para um momento em grupo.';
  }

  return 'boa saida para venda consultiva dentro da loja.';
}

function buildSalesPitch(product: ClientCatalogProductInput, tags: string[]): string {
  const baseName = normalizeWhitespace(product.name);

  if (tags.includes('presente')) {
    return `${baseName} tem boa leitura para presente e costuma encantar rapido na conversa.`;
  }

  if (tags.includes('premium')) {
    return `${baseName} segura melhor uma proposta mais marcante sem perder desejo.`;
  }

  if (tags.includes('pote')) {
    return `${baseName} funciona bem como mimo individual e venda de vontade imediata.`;
  }

  if (tags.includes('acai')) {
    return `${baseName} ajuda a abrir conversa de personalizacao e complementos.`;
  }

  return `${baseName} conversa bem com a proposta da loja e ajuda a vender sem chute.`;
}

function buildPositioning(product: ClientCatalogProductInput, tags: string[]): string {
  if (tags.includes('presente')) {
    return 'presente';
  }

  if (tags.includes('compartilhar')) {
    return 'compartilhar';
  }

  if (tags.includes('mimo_individual') || tags.includes('pote')) {
    return 'mimo individual';
  }

  if (tags.includes('bebida')) {
    return 'apoio de ticket';
  }

  return product.categoria;
}

function buildFlavorProfile(product: ClientCatalogProductInput, tags: string[]): string {
  const highlights = ['brigadeiro', 'ninho', 'nutella', 'morango', 'uva', 'coco', 'maracuja', 'acai']
    .filter((tag) => tags.includes(tag))
    .join(', ');

  return highlights || normalizeWhitespace(product.description || product.name);
}

export function buildClientCatalogMetadata(
  product: ClientCatalogProductInput,
  catalog: ClientCatalogContextInput,
  importedAt: string,
): Record<string, any> {
  const originalMetadata = product.metadata || {};
  const tags = [
    ...new Set([
      ...(Array.isArray(originalMetadata.sales_tags) ? originalMetadata.sales_tags : []),
      ...deriveClientCatalogSalesTags(product),
    ]),
  ];
  const additionalSummary = (product.adicionais || []).map((group) => ({
    nome: group.nome,
    regra: group.regra || '',
    minimo: group.minimo || 0,
    maximo: group.maximo || 0,
    opcoes: (group.opcoes || []).map((option) => option.nome),
  }));

  return {
    ...originalMetadata,
    sales_tags: tags,
    whatsapp_hint: originalMetadata.whatsapp_hint || buildWhatsappHint(product, tags),
    sales_pitch: originalMetadata.sales_pitch || buildSalesPitch(product, tags),
    positioning: originalMetadata.positioning || buildPositioning(product, tags),
    flavor_profile: originalMetadata.flavor_profile || buildFlavorProfile(product, tags),
    source_platform: 'menudireto',
    source_catalog_url: catalog.fonte,
    source_store_slug: catalog.loja.slug,
    source_restaurante_n: catalog.loja.restauranteN,
    source_image_url: product.image_url || null,
    source_category_name: product.categoria,
    source_add_on_groups: additionalSummary,
    imported_from_catalog: true,
    imported_at: importedAt,
  };
}
