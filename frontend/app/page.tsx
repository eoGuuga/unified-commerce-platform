"use client"

export default function Page() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <h1 className="text-5xl font-bold mb-2">Unified Commerce Platform</h1>
          <p className="text-slate-300 text-lg">Plataforma SaaS para unificação de vendas multi-canal</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
            <h2 className="text-2xl font-bold mb-3 text-amber-400">Problema Central</h2>
            <p className="text-slate-300 leading-relaxed">
              Pequenos negócios artesanais sofrem com <strong>overselling</strong> ao vender em múltiplos canais (PDV
              físico, e-commerce, WhatsApp) sem sincronização de estoque.
            </p>
          </div>

          <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
            <h2 className="text-2xl font-bold mb-3 text-green-400">Solução</h2>
            <p className="text-slate-300 leading-relaxed">
              Hub unificado com estoque centralizado, transações ACID, e automação de atendimento via WhatsApp Bot com
              IA.
            </p>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Três Faces da Plataforma</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-500/20 rounded-lg p-6 border border-blue-400">
              <div className="text-3xl mb-2">📱</div>
              <h3 className="text-xl font-bold mb-2">PDV Web</h3>
              <p className="text-slate-300 text-sm">Sistema de ponto de venda otimizado para tablet na loja física.</p>
            </div>

            <div className="bg-purple-500/20 rounded-lg p-6 border border-purple-400">
              <div className="text-3xl mb-2">🛒</div>
              <h3 className="text-xl font-bold mb-2">E-commerce</h3>
              <p className="text-slate-300 text-sm">
                Storefront online para vendas pela internet com checkout integrado.
              </p>
            </div>

            <div className="bg-green-500/20 rounded-lg p-6 border border-green-400">
              <div className="text-3xl mb-2">🤖</div>
              <h3 className="text-xl font-bold mb-2">WhatsApp Bot</h3>
              <p className="text-slate-300 text-sm">
                Atendimento automatizado com IA para responder pedidos e dúvidas.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Stack Tecnológico</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { category: "Backend", tech: "NestJS + Node.js 20+" },
              { category: "Frontend", tech: "Next.js 14+ (App Router)" },
              { category: "Database", tech: "PostgreSQL 15 + Supabase" },
              { category: "Cache", tech: "Redis (Upstash)" },
              { category: "Auth", tech: "JWT RS256" },
              { category: "Deploy", tech: "Vercel + Railway" },
            ].map((item) => (
              <div key={item.category} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <p className="text-slate-400 text-sm mb-1">{item.category}</p>
                <p className="font-semibold text-white">{item.tech}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
          <h2 className="text-2xl font-bold mb-4">Próximos Passos</h2>
          <ul className="space-y-2 text-slate-300">
            <li>✓ Documentação completa criada</li>
            <li>✓ Estrutura de pastas organizada</li>
            <li>✓ Configurações backend e frontend prontas</li>
            <li>→ Pronto para importar no Cursor AI</li>
          </ul>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-600 text-center text-slate-400 text-sm">
          <p>Versão 0.1.0 - Unified Commerce Platform</p>
          <p className="mt-1">Pronto para desenvolvimento com Cursor AI</p>
        </div>
      </div>
    </main>
  )
}
