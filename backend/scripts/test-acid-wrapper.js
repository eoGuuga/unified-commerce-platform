// Wrapper para executar script de teste ACID
const path = require('path');
const { execSync } = require('child_process');

const backendDir = path.resolve(__dirname, '..');
const rootDir = process.env.UCM_ROOT
  ? path.resolve(process.env.UCM_ROOT)
  : path.resolve(__dirname, '../..');
const scriptsDir = path.join(rootDir, 'scripts');
const nodeModulesPath = path.join(backendDir, 'node_modules');

// Definir NODE_PATH para encontrar módulos
process.env.NODE_PATH = nodeModulesPath;
require('module').Module._initPaths();

// Executar script
const scriptPath = path.join(scriptsDir, 'test-acid-transactions.ts');
const envPath = path.join(backendDir, '.env');

try {
  execSync(
    `npx ts-node -r dotenv/config "${scriptPath}" dotenv_config_path="${envPath}"`,
    { 
      stdio: 'inherit', 
      cwd: backendDir,
      env: { ...process.env, NODE_PATH: nodeModulesPath }
    }
  );
} catch (error) {
  process.exit(1);
}
