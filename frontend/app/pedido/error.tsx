'use client';

import { useEffect } from 'react';

export default function PedidoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Pedido error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Falha ao carregar pedido
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          {process.env.NODE_ENV === 'development'
            ? error.message
            : 'Tente novamente. Verifique o numero do pedido se persistir.'}
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
