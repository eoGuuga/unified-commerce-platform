/**
 * Config isolada para testar os scripts de seed. Eles vivem fora do `rootDir:
 * 'src'` do backend, entao o `npm run test:unit` do backend NAO os pega — rodar
 * sob demanda: `cd backend && npx jest --config ../scripts/jest.config.js`.
 *
 * `rootDir` aponta para o backend (onde vive o `ts-jest`, resolvido pelo jest a
 * partir do rootDir); `roots` aponta para a arvore de scripts a testar.
 */
const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname, '../backend'),
  roots: [path.resolve(__dirname)],
  testMatch: ['**/*.spec.ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: { esModuleInterop: true, strict: true, skipLibCheck: true } },
    ],
  },
};
