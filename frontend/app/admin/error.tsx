'use client';

import { useEffect } from 'react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Falha ao carregar o admin
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          {process.env.NODE_ENV === 'development'
            ? error.message
            : 'Tente novamente. Se persistir, verifique conectividade com a API.'}
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
