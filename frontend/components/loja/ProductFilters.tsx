'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, SortAsc, SortDesc, DollarSign, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Product } from '@/lib/types/product';

interface ProductFiltersProps {
  products: Product[];
  onFiltersChange: (filteredProducts: Product[]) => void;
  className?: string;
}

export function ProductFilters({ products, onFiltersChange, className }: ProductFiltersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({
    min: 0,
    max: 1000,
  });
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'rating'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Extract unique categories
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(products.map(p => p.category).filter(Boolean))];
    return uniqueCategories.sort();
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = products.filter((product) => {
      // Search filter
      const matchesSearch = !searchQuery ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchQuery.toLowerCase());

      // Category filter
      const matchesCategory = !selectedCategory || product.category === selectedCategory;

      // Price range filter
      const matchesPrice = product.price >= priceRange.min && product.price <= priceRange.max;

      // Stock filter (only show in-stock products)
      const matchesStock = product.stock > 0;

      return matchesSearch && matchesCategory && matchesPrice && matchesStock;
    });

    // Sort products
    filtered.sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'name':
          compareValue = a.name.localeCompare(b.name);
          break;
        case 'price':
          compareValue = a.price - b.price;
          break;
        case 'stock':
          compareValue = b.stock - a.stock;
          break;
        case 'rating':
          compareValue = (b.rating || 0) - (a.rating || 0);
          break;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return filtered;
  }, [products, searchQuery, selectedCategory, priceRange, sortBy, sortOrder]);

  // Update parent component when filters change
  useMemo(() => {
    onFiltersChange(filteredProducts);
  }, [filteredProducts, onFiltersChange]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setPriceRange({ min: 0, max: 1000 });
    setSortBy('name');
    setSortOrder('asc');
  };

  const hasActiveFilters = searchQuery || selectedCategory ||
                          priceRange.min > 0 || priceRange.max < 1000;

  return (
    <div className={className}>
      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar produtos por nome, descrição ou SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filters Section */}
      <div className="space-y-6">
        {/* Category Filter */}
        <div>
          <label className="text-sm font-medium mb-2 block">Categoria</label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as categorias</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Price Range Filter */}
        <div>
          <label className="text-sm font-medium mb-2 block">Faixa de preço</label>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <Input
                type="number"
                placeholder="Mínimo"
                value={priceRange.min}
                onChange={(e) => setPriceRange(prev => ({ ...prev, min: Number(e.target.value) }))}
                min="0"
              />
            </div>
            <span className="text-muted-foreground">até</span>
            <div className="flex-1">
              <Input
                type="number"
                placeholder="Máximo"
                value={priceRange.max}
                onChange={(e) => setPriceRange(prev => ({ ...prev, max: Number(e.target.value) }))}
                min="0"
              />
            </div>
          </div>
        </div>

        {/* Sort Options */}
        <div>
          <label className="text-sm font-medium mb-2 block">Ordenar por</label>
          <div className="flex gap-2 items-center">
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nome</SelectItem>
                <SelectItem value="price">Preço</SelectItem>
                <SelectItem value="stock">Estoque</SelectItem>
                <SelectItem value="rating">Avaliação</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? (
                <SortAsc className="h-4 w-4" />
              ) : (
                <SortDesc className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">Filtros ativos:</span>
            {searchQuery && (
              <Badge variant="secondary" className="gap-1">
                <Search className="h-3 w-3" />
                Busca: {searchQuery}
                <button
                  onClick={() => setSearchQuery('')}
                  className="ml-1 hover:bg-destructive hover:text-destructive-foreground"
                >
                  ×
                </button>
              </Badge>
            )}
            {selectedCategory && (
              <Badge variant="secondary" className="gap-1">
                <Package className="h-3 w-3" />
                {selectedCategory}
                <button
                  onClick={() => setSelectedCategory('')}
                  className="ml-1 hover:bg-destructive hover:text-destructive-foreground"
                >
                  ×
                </button>
              </Badge>
            )}
            {(priceRange.min > 0 || priceRange.max < 1000) && (
              <Badge variant="secondary" className="gap-1">
                <DollarSign className="h-3 w-3" />
                R$ {priceRange.min} - {priceRange.max}
                <button
                  onClick={() => setPriceRange({ min: 0, max: 1000 })}
                  className="ml-1 hover:bg-destructive hover:text-destructive-foreground"
                >
                  ×
                </button>
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <Filter className="h-3 w-3 mr-1" />
              Limpar todos
            </Button>
          </div>
        )}

        {/* Results Count */}
        <div className="text-sm text-muted-foreground">
          {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{
            filteredProducts.length !== 1 ? 's' : ''
          }
        </div>
      </div>
    </div>
  );
}