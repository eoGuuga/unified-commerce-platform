'use client';

import { useEffect } from 'react';

export default function PdvError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('PDV error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Falha no PDV
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          {process.env.NODE_ENV === 'development'
            ? error.message
            : 'Verifique conexao e tente novamente. Vendas em andamento podem ter sido perdidas.'}
        </p>
        <button
          onClick={reset}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
