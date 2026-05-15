interface EmptyTenantStateProps {
  /** True quando o usuario eh um operador (logado mas sem tenant valido).
   *  Muda o tom da mensagem - mais tecnica para operador, mais geral
   *  para visitante final. */
  isOperatorPreview: boolean;
}

/**
 * Estado vazio quando a vitrine nao tem `tenantId` configurado.
 * Mostra um card ambar com instrucoes diferentes para operador vs cliente.
 */
export function EmptyTenantState({ isOperatorPreview }: EmptyTenantStateProps) {
  return (
    <div className="rounded-[32px] border border-amber-300/15 bg-[linear-gradient(135deg,rgba(251,191,36,0.12)_0%,rgba(245,158,11,0.08)_42%,rgba(15,23,42,0.88)_100%)] p-6 sm:p-8">
      <p className="text-xs uppercase tracking-[0.22em] text-amber-100/70">
        {isOperatorPreview ? 'configuracao necessaria' : 'vitrine em preparacao'}
      </p>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-amber-50">
        {isOperatorPreview
          ? 'A loja precisa de um tenant configurado para carregar o catalogo.'
          : 'Estamos preparando esta vitrine para abrir com tudo no lugar.'}
      </h3>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-amber-50/75">
        {isOperatorPreview
          ? 'Defina `NEXT_PUBLIC_TENANT_ID` ou use um token com tenant valido no login para conectar esta vitrine ao ambiente certo.'
          : 'Volte em instantes. Assim que a curadoria terminar, o catalogo aparecera aqui com a experiencia completa de compra.'}
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-200/15 bg-black/10 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-100/70">
            tenant
          </p>
          <p className="mt-2 text-sm font-medium text-amber-50">
            {isOperatorPreview
              ? 'Conecta a vitrine ao catalogo correto.'
              : 'A abertura acontece quando o catalogo estiver certo.'}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200/15 bg-black/10 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-100/70">
            login
          </p>
          <p className="mt-2 text-sm font-medium text-amber-50">
            {isOperatorPreview
              ? 'Um token valido tambem libera o tenant automaticamente.'
              : 'A experiencia final vai surgir aqui sem friccao.'}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200/15 bg-black/10 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-100/70">
            resultado
          </p>
          <p className="mt-2 text-sm font-medium text-amber-50">
            {isOperatorPreview
              ? 'Catalogo, checkout e pagamento passam a refletir a operacao real.'
              : 'Catalogo, checkout e pagamento vao nascer aqui de forma integrada.'}
          </p>
        </div>
      </div>
    </div>
  );
}
