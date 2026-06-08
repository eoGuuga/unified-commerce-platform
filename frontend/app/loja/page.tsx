'use client';

import { useState } from 'react';
import { ShoppingCart, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductFilters } from '@/components/loja/ProductFilters';
import { ProductGrid } from '@/components/loja/ProductCard';
import { CartSheet } from '@/components/loja/CartSheet';
import { ProductDetailModal } from '@/components/loja/ProductDetailModal';
import { LojaLayout } from '@/components/loja/LojaLayout';
import { useCart } from '@/hooks/useCart';
import { useProducts } from '@/hooks/useProducts';
import { Product } from '@/lib/types/product';
import { CheckoutForm } from '@/components/loja/CheckoutForm';

export default function LojaPage() {
  const { items, addItem } = useCart();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const { products, loading, error, refetch } = useProducts();

  const handleFiltersChange = (filteredProducts: Product[]) => {
    // O hook useProducts já gerencia os produtos filtrados
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleAddToCart = (product: Product, quantity: number) => {
    addItem(product, quantity);
    setSelectedProduct(null);
  };

  const handleCheckout = () => {
    setShowCheckout(true);
  };

  const handleBackToStore = () => {
    setShowCheckout(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando produtos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">Erro ao carregar produtos</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <LojaLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          {showFilters && (
            <aside className="lg:col-span-1">
              <ProductFilters
                products={products}
                onFiltersChange={handleFiltersChange}
                className="sticky top-24"
              />
            </aside>
          )}

          {/* Products Grid */}
          <div className={showFilters ? 'lg:col-span-3' : 'lg:col-span-4'}>
            {showCheckout ? (
              <div className="space-y-6">
                <Button
                  variant="outline"
                  onClick={handleBackToStore}
                  className="mb-6"
                >
                  ← Voltar à loja
                </Button>
                <CheckoutForm onSuccess={() => setShowCheckout(false)} />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Store Info */}
                <div className="text-center py-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                  <h2 className="text-3xl font-bold mb-2">Bem-vindo à nossa Loja Online</h2>
                  <p className="text-muted-foreground mb-4">
                    Produtos selecionados com qualidade e preço justo
                  </p>
                  <div className="flex justify-center gap-8 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      <span>Compra segura</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      <span>Filtros inteligentes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-4 bg-green-500 rounded-full"></span>
                      <span>Produtos em estoque</span>
                    </div>
                  </div>
                </div>

                {/* Products Grid */}
                <ProductGrid
                  products={products}
                  onProductClick={handleProductClick}
                />

                {/* Empty State */}
                {products.length === 0 && (
                  <div className="text-center py-12">
                    <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Nenhum produto encontrado</h3>
                    <p className="text-muted-foreground">
                      Tente ajustar seus filtros ou buscar por outros termos.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onOpenChange={(open) => !open && setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
      />

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CheckoutForm onSuccess={() => setShowCheckout(false)} />
          </div>
        </div>
      )}
    </LojaLayout>
  );
}