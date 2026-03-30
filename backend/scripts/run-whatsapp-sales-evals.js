const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const result = {};

  for (let index = 2; index < argv.length; index += 1) {
    const current = String(argv[index] || '');
    if (!current.startsWith('--')) {
      continue;
    }

    const eqIndex = current.indexOf('=');
    if (eqIndex >= 0) {
      result[current.slice(2, eqIndex)] = current.slice(eqIndex + 1);
      continue;
    }

    const key = current.slice(2);
    const next = argv[index + 1];
    if (typeof next === 'string' && !next.startsWith('--')) {
      result[key] = next;
      index += 1;
    } else {
      result[key] = 'true';
    }
  }

  return result;
}

function containsAny(text, needles) {
  if (!Array.isArray(needles) || needles.length === 0) {
    return true;
  }

  const haystack = String(text || '').toLowerCase();
  return needles.some((needle) => haystack.includes(String(needle || '').toLowerCase()));
}

function containsNone(text, needles) {
  if (!Array.isArray(needles) || needles.length === 0) {
    return true;
  }

  const haystack = String(text || '').toLowerCase();
  return needles.every((needle) => !haystack.includes(String(needle || '').toLowerCase()));
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function invokeWhatsappEvalStep(baseUrl, tenantId, phone, message) {
  const body = JSON.stringify({
    tenantId,
    phone,
    message,
  });

  const maxAttempts = 4;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      });

      if (response.status === 429 && attempt < maxAttempts) {
        await sleep(3000 * attempt);
        continue;
      }

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      const messageText = error instanceof Error ? error.message : String(error);
      if ((messageText.includes('429') || messageText.includes('Too Many Requests')) && attempt < maxAttempts) {
        await sleep(3000 * attempt);
        continue;
      }

      if (attempt < maxAttempts) {
        await sleep(1000 * attempt);
      }
    }
  }

  throw lastError || new Error('Falha inesperada ao executar o step da avaliacao.');
}

async function main() {
  const args = parseArgs(process.argv);
  const baseUrl = args.baseUrl || 'https://dev.gtsofthub.com.br/api/v1/whatsapp/test';
  const tenantId = args.tenantId || '00000000-0000-0000-0000-000000000000';
  const corpusPath = path.resolve(
    process.cwd(),
    args.corpusPath || 'scripts/whatsapp-sales-evals.loucas.json',
  );

  if (!fs.existsSync(corpusPath)) {
    throw new Error(`Corpus nao encontrado em ${corpusPath}`);
  }

  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const outputPath = path.resolve(
    process.cwd(),
    args.outputPath || `whatsapp-sales-evals-results-${timestamp}.json`,
  );

  const runSeed = Math.floor(Math.random() * 900000) + 100000;
  const results = [];

  for (let scenarioIndex = 0; scenarioIndex < corpus.scenarios.length; scenarioIndex += 1) {
    const scenario = corpus.scenarios[scenarioIndex];
    const phone = `+55119${String(runSeed).padStart(6, '0')}${String(scenarioIndex + 1).padStart(3, '0')}`;
    const stepResults = [];
    let scenarioPassed = true;

    for (const step of scenario.steps) {
      const response = await invokeWhatsappEvalStep(baseUrl, tenantId, phone, step.message);
      const responseText = String(response.response || '');
      const passExpectAny = containsAny(responseText, step.expectAny);
      const passForbidAny = containsNone(responseText, step.forbidAny);
      const passed = passExpectAny && passForbidAny;

      if (!passed) {
        scenarioPassed = false;
      }

      stepResults.push({
        message: step.message,
        response: responseText,
        passed,
        expectAny: Array.isArray(step.expectAny) ? step.expectAny : [],
        forbidAny: Array.isArray(step.forbidAny) ? step.forbidAny : [],
      });
    }

    results.push({
      name: scenario.name,
      phone,
      passed: scenarioPassed,
      steps: stepResults,
    });
  }

  const passedScenarios = results.filter((result) => result.passed).length;
  const failedScenarios = results.length - passedScenarios;
  const summary = {
    corpus: corpus.name,
    description: corpus.description,
    baseUrl,
    tenantId,
    runSeed,
    timestamp: new Date().toISOString(),
    totalScenarios: results.length,
    passedScenarios,
    failedScenarios,
    results,
  };

  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log('');
  console.log('WhatsApp sales evals concluido.');
  console.log(`Corpus: ${corpus.name}`);
  console.log(`Cenarios: ${summary.totalScenarios}`);
  console.log(`Passaram: ${summary.passedScenarios}`);
  console.log(`Falharam: ${summary.failedScenarios}`);
  console.log(`Resultado salvo em: ${path.basename(outputPath)}`);

  if (failedScenarios > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
