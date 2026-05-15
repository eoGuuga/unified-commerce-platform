'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error (fora do layout):', error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center' }}>
        <h2>Erro critico</h2>
        <p>O aplicativo encontrou um problema. Recarregue a pagina.</p>
        <button
          onClick={reset}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            background: '#2563eb',
            color: 'white',
            border: 0,
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
