// Ambiente padrão para testes (unit + integração)
//
// Objetivo: evitar que testes falhem por falta de variáveis obrigatórias,
// mantendo validações de segurança ativas.

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

