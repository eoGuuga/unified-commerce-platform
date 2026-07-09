import { Injectable, Logger } from '@nestjs/common';
import { ProductsService } from '../../products/products.service';
import { ProductWithStock } from '../../products/types/product.types';
import { Produto } from '../../../database/entities/Produto.entity';

export interface CatalogSection {
  title: string;
  rows: Array<{
    id: string;
    title: string;
    description: string;
  }>;
}

export interface InteractiveCatalogResponse {
  kind: 'interactive_list';
  previewText: string;
  list: {
    title: string;
    description: string;
    buttonText: string;
    footerText?: string;
    sections: CatalogSection[];
  };
}

const CATALOG_PAGE_SIZE = 10;
const MAX_DESCRIPTION_LENGTH = 60;

@Injectable()
export class CatalogManagerService {
  private readonly logger = new Logger(CatalogManagerService.name);

  constructor(private readonly productsService: ProductsService) {}

  /**
   * Obtém todos os produtos do catálogo
   */
  async getCatalogProducts(tenantId: string): Promise<ProductWithStock[]> {
    try {
      const result = await this.productsService.findAll(tenantId);
      if (Array.isArray(result)) {
        return result;
      }
      return result.data || [];
    } catch (error) {
      this.logger.error('Failed to get catalog products', { error, tenantId });
      return [];
    }
  }

  /**
   * Busca produtos por nome
   */
  async searchProducts(tenantId: string, query: string): Promise<Produto[]> {
    try {
      return await this.productsService.search(tenantId, query);
    } catch (error) {
      this.logger.error('Failed to search products', { error, tenantId, query });
      return [];
    }
  }

  /**
   * Constrói resposta interativa do catálogo
   */
  async buildInteractiveCatalogResponse(
    tenantId: string,
    selection?: {
      type: 'root' | 'root_page' | 'category' | 'category_page' | 'product' | 'similar';
      key?: string;
      page?: number;
    },
  ): Promise<InteractiveCatalogResponse | null> {
    const products = await this.getCatalogProducts(tenantId);

    if (products.length === 0) {
      return null;
    }

    // Build sections based on selection
    if (!selection || selection.type === 'root') {
      return this.buildRootCatalogResponse(products, selection?.page || 1);
    }

    if (selection.type === 'category') {
      return this.buildCategoryCatalogResponse(products, selection.key!, selection.page || 1);
    }

    if (selection.type === 'product') {
      return this.buildProductDetailResponse(products, selection.key!);
    }

    if (selection.type === 'similar') {
      return this.buildSimilarProductsResponse(products, selection.key!);
    }

    return this.buildRootCatalogResponse(products, 1);
  }

  /**
   * Encontra produtos similares
   */
  findSimilarProducts(products: ProductWithStock[], productId: string): ProductWithStock[] {
    const product = products.find((p) => p.id === productId);
    if (!product) return [];

    const productTokens = this.getProductTokens(product.name);

    return products
      .filter((p) => p.id !== productId && p.available_stock > 0)
      .map((p) => ({
        product: p,
        score: this.calculateSimilarityScore(p, productTokens),
      }))
      .filter((item) => item.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((item) => item.product);
  }

  /**
   * Extrai seleção do catálogo da mensagem
   */
  parseCatalogSelection(message: string): {
    type: 'root' | 'root_page' | 'category' | 'category_page' | 'product' | 'similar';
    key?: string;
    page?: number;
  } | null {
    const lower = message.toLowerCase().trim();

    // Page navigation
    const pageMatch = lower.match(/^(?:pag(?:ina)?\.?\s*)?(\d+)$/);
    if (pageMatch) {
      return { type: 'root_page', page: parseInt(pageMatch[1], 10) };
    }

    // "voltar" command
    if (lower === 'voltar' || lower === 'menu' || lower === 'início' || lower === 'inicio') {
      return { type: 'root', page: 1 };
    }

    // Product selection (single word that's not a command)
    const singleWordMatch = lower.match(/^([a-záéíóúàèìòùãẽĩõũâêîôûçñ]+)$/);
    if (singleWordMatch && !this.isCatalogCommand(lower)) {
      return { type: 'product', key: singleWordMatch[1] };
    }

    return null;
  }

  /**
   * Verifica se a mensagem é um comando de catálogo
   */
  isCatalogCommand(message: string): boolean {
    const lower = message.toLowerCase().trim();
    const commands = [
      'cardápio', 'cardapio', 'catalogo', 'catálogo', 'menu',
      'produtos', 'itens', 'ver', 'mostrar', 'o que tem',
      'voltar', 'início', 'inicio',
    ];
    return commands.some((cmd) => lower.includes(cmd));
  }

  /**
   * Formata headline do produto
   */
  formatProductHeadline(product: ProductWithStock): string {
    const price = Number(product.price).toFixed(2).replace('.', ',');
    const stockIndicator = product.available_stock === 0 ? ' (Esgotado)' :
      product.available_stock <= 5 ? ` (Só ${product.available_stock})` : '';

    return `${product.name} - R$ ${price}${stockIndicator}`;
  }

  /**
   * Verifica se produto está disponível
   */
  isProductAvailable(product: ProductWithStock): boolean {
    return product.available_stock > 0;
  }

  // ============== MÉTODOS PRIVADOS ==============

  private buildRootCatalogResponse(products: ProductWithStock[], page: number): InteractiveCatalogResponse {
    const paginatedProducts = this.paginateRows(products, page, CATALOG_PAGE_SIZE);
    const sections: CatalogSection[] = [];

    // Add products section
    if (paginatedProducts.length > 0) {
      sections.push({
        title: page === 1 ? '🍫 Produtos' : `Produtos (pág. ${page})`,
        rows: paginatedProducts.map((p) => ({
          id: `prod_${p.id}`,
          title: this.formatProductHeadline(p),
          description: this.buildProductCardDescription(p),
        })),
      });
    }

    // Add pagination info if needed
    const totalPages = Math.ceil(products.length / CATALOG_PAGE_SIZE);
    if (totalPages > 1) {
      sections.push({
        title: '📄 Navegação',
        rows: [
          ...(page > 1 ? [{ id: 'nav_prev', title: '⬅️ Página anterior', description: '' }] : []),
          ...(page < totalPages ? [{ id: 'nav_next', title: '➡️ Próxima página', description: '' }] : []),
        ],
      });
    }

    return {
      kind: 'interactive_list',
      previewText: page === 1 ? 'Nosso cardápio 🍫' : `Cardápio - página ${page}/${totalPages}`,
      list: {
        title: '🍫 Cardápio',
        description: page === 1 ? 'Escolha uma opção:' : `Página ${page} de ${totalPages}`,
        buttonText: 'Ver opções',
        footerText: totalPages > 1 ? `Página ${page}/${totalPages}` : undefined,
        sections,
      },
    };
  }

  private buildCategoryCatalogResponse(
    products: ProductWithStock[],
    categoryKey: string,
    page: number,
  ): InteractiveCatalogResponse {
    const categoryProducts = products.filter((p) =>
      p.categoria?.name?.toLowerCase().includes(categoryKey.toLowerCase())
    );

    if (categoryProducts.length === 0) {
      return this.buildRootCatalogResponse(products, 1);
    }

    const paginatedProducts = this.paginateRows(categoryProducts, page, CATALOG_PAGE_SIZE);
    const sections: CatalogSection[] = [];

    sections.push({
      title: `${categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)} 🍫`,
      rows: paginatedProducts.map((p) => ({
        id: `prod_${p.id}`,
        title: this.formatProductHeadline(p),
        description: this.buildProductCardDescription(p),
      })),
    });

    // Back option
    sections.push({
      title: 'Navegação',
      rows: [{ id: 'nav_back', title: '⬅️ Voltar ao cardápio', description: '' }],
    });

    return {
      kind: 'interactive_list',
      previewText: `${categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)} 🍫`,
      list: {
        title: `${categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)}`,
        description: `${categoryProducts.length} produtos`,
        buttonText: 'Ver opções',
        sections,
      },
    };
  }

  private buildProductDetailResponse(
    products: ProductWithStock[],
    productId: string,
  ): InteractiveCatalogResponse {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      return this.buildRootCatalogResponse(products, 1);
    }

    const similarProducts = this.findSimilarProducts(products, productId);
    const sections: CatalogSection[] = [];

    // Main product
    sections.push({
      title: '🎯 Este produto',
      rows: [{
        id: `buy_${product.id}`,
        title: `✅ Comprar ${product.name}`,
        description: `R$ ${Number(product.price).toFixed(2).replace('.', ',')} - ${product.available_stock} em estoque`,
      }],
    });

    // Similar products
    if (similarProducts.length > 0) {
      sections.push({
        title: '💡 Você também pode gostar',
        rows: similarProducts.slice(0, 5).map((p) => ({
          id: `sim_${p.id}`,
          title: this.formatProductHeadline(p),
          description: this.buildProductCardDescription(p),
        })),
      });
    }

    // Navigation
    sections.push({
      title: 'Navegação',
      rows: [{ id: 'nav_back', title: '⬅️ Voltar ao cardápio', description: '' }],
    });

    return {
      kind: 'interactive_list',
      previewText: `${product.name} - R$ ${Number(product.price).toFixed(2).replace('.', ',')}`,
      list: {
        title: product.name,
        description: product.description || this.buildProductCardDescription(product),
        buttonText: 'Ações',
        sections,
      },
    };
  }

  private buildSimilarProductsResponse(
    products: ProductWithStock[],
    productId: string,
  ): InteractiveCatalogResponse {
    const similarProducts = this.findSimilarProducts(products, productId);

    if (similarProducts.length === 0) {
      return this.buildRootCatalogResponse(products, 1);
    }

    return {
      kind: 'interactive_list',
      previewText: 'Produtos similares 🍫',
      list: {
        title: '💡 Similar a este',
        description: 'Você também pode gostar:',
        buttonText: 'Ver opções',
        sections: [{
          title: '💡 Similar',
          rows: similarProducts.map((p) => ({
            id: `prod_${p.id}`,
            title: this.formatProductHeadline(p),
            description: this.buildProductCardDescription(p),
          })),
        }, {
          title: 'Navegação',
          rows: [{ id: 'nav_back', title: '⬅️ Voltar ao cardápio', description: '' }],
        }],
      },
    };
  }

  private buildProductCardDescription(product: ProductWithStock): string {
    const parts: string[] = [];

    if (product.description) {
      parts.push(product.description.substring(0, MAX_DESCRIPTION_LENGTH));
    }

    parts.push(product.available_stock === 0 ? 'Esgotado' :
      product.available_stock <= 5 ? `Últimas ${product.available_stock} unidades` : 'Disponível');

    return parts.join(' • ');
  }

  private getProductTokens(productName: string): string[] {
    const normalized = productName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const tokens = new Set<string>();

    tokens.add(normalized);

    // Add word tokens
    normalized.split(/\s+/).forEach((word) => {
      if (word.length >= 3) {
        tokens.add(word);
      }
    });

    return Array.from(tokens);
  }

  private calculateSimilarityScore(product: ProductWithStock, targetTokens: string[]): number {
    const productTokens = this.getProductTokens(product.name);
    let matchCount = 0;

    for (const target of targetTokens) {
      for (const token of productTokens) {
        if (token.includes(target) || target.includes(token)) {
          matchCount++;
          break;
        }
      }
    }

    return matchCount / Math.max(targetTokens.length, 1);
  }

  private paginateRows<T>(items: T[], page: number, pageSize: number): T[] {
    const startIndex = (page - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }
}