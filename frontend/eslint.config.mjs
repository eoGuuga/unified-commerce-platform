import { globalIgnores } from 'eslint/config';
import coreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...coreWebVitals,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
];

export default config;

