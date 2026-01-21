export function FinalCTASection() {
  return (
    <section className="bg-gradient-to-r from-blue-900 via-blue-700 to-blue-500 py-20 text-white">
      <div className="mx-auto w-full max-w-5xl px-6 text-center lg:px-10">
        <h2 className="text-3xl font-semibold sm:text-4xl">Pare de perder vendas por overselling</h2>
        <p className="mt-4 text-base text-blue-100">
          Venda em todos os canais com a tranquilidade de que o estoque está sempre correto. Uma única fonte da verdade.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">
            Ver Demo ao Vivo
          </button>
          <button className="rounded-xl border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/70">
            Falar com Vendas
          </button>
        </div>
      </div>
    </section>
  );
}

