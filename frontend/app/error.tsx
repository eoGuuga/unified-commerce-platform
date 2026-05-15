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
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Ops! Algo deu errado
        </h2>
        <p className="text-gray-600 mb-6">
          Ocorreu um erro inesperado. Tente novamente em instantes.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <pre className="text-xs text-red-600 overflow-auto mb-4 text-left bg-gray-100 p-3 rounded">
            {error.message}
            {error.digest ? `\n\nDigest: ${error.digest}` : ''}
          </pre>
        )}
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Tentar novamente
          </button>
          <button
            onClick={() => (window.location.href = '/')}
            className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Voltar ao inicio
          </button>
        </div>
      </div>
    </div>
  );
}
