// Wrapper para executar script de seed produtos
const path = require('path');
const { execSync } = require('child_process');

const backendDir = path.resolve(__dirname, '..');
const scriptsDir = path.resolve(__dirname, '../../scripts');
const nodeModulesPath = path.join(backendDir, 'node_modules');

process.env.NODE_PATH = nodeModulesPath;
require('module').Module._initPaths();

const scriptPath = path.join(scriptsDir, 'seed-produtos-mae.ts');
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
