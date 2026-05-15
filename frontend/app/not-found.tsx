import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <p className="text-5xl font-bold text-gray-300">404</p>
        <h2 className="text-xl font-bold text-gray-900 mt-2 mb-2">
          Pagina nao encontrada
        </h2>
        <p className="text-gray-600 mb-6">
          A pagina que voce procura nao existe ou foi movida.
        </p>
        <Link
          href="/"
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Voltar ao inicio
        </Link>
      </div>
    </div>
  );
}
