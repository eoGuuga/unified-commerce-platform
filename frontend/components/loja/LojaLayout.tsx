'use client';

import Link from 'next/link';
import { ShoppingCart, Search, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CartSheet } from '@/components/loja/CartSheet';

export function LojaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/loja" className="flex items-center gap-2">
              <Store className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">Minha Loja</span>
            </Link>

            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm">
                <Search className="h-4 w-4" />
              </Button>

              <CartSheet />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/50">
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold mb-4">Sobre a Loja</h3>
              <p className="text-sm text-muted-foreground">
                Sua loja online com produtos selecionados e qualidade garantida.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Links Úteis</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/loja" className="text-muted-foreground hover:text-foreground">Início</Link></li>
                <li><Link href="/loja/checkout" className="text-muted-foreground hover:text-foreground">Finalizar Compra</Link></li>
                <li><Link href="/contato" className="text-muted-foreground hover:text-foreground">Contato</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Informações</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>📞 (11) 9999-8888</li>
                <li>📧 contato@minhaloja.com.br</li>
                <li>🕒 Seg-Sex: 9h-18h</li>
              </ul>
            </div>
          </div>

          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 Minha Loja. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}