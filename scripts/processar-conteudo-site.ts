/**
 * Script para processar conteúdo do site e extrair produtos automaticamente
 * 
 * Este script lê o arquivo CONTEUDO-SITE-COMPLETO.txt e extrai:
 * - Nomes dos produtos
 * - Preços
 * - Descrições
 * - Categorias
 * 
 * Execute: npx ts-node scripts/processar-conteudo-site.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface ProdutoExtraido {
  name: string;
  price: number;
  description?: string;
  categoria: string;
  unit: string;
  estoque: number;
  min_stock: number;
}

function extrairProdutos(conteudo: string): ProdutoExtraido[] {
  const produtos: ProdutoExtraido[] = [];
  
  // Normalizar conteúdo
  const texto = conteudo.toLowerCase();
  
  // Padrões para encontrar preços (R$, reais, etc)
  const padraoPreco = /(?:r\$\s*)?(\d+[.,]\d{2})|(\d+)\s*(?:reais?|rs?)/gi;
  
  // Padrões para encontrar nomes de produtos comuns
  const produtosConhecidos = [
    'brigadeiro', 'beijinho', 'cajuzinho', 'bicho de pé', 'olho de sogra',
    'bolo de chocolate', 'bolo de cenoura', 'bolo personalizado',
    'coxinha', 'risole', 'pastel', 'enroladinho'
  ];
  
  // Dividir por linhas
  const linhas = conteudo.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let produtoAtual: Partial<ProdutoExtraido> | null = null;
  
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    
    // Procurar por preços
    const matchPreco = linha.match(padraoPreco);
    if (matchPreco) {
      const precoStr = matchPreco[0].replace(/[r$\s]/gi, '').replace(',', '.');
      const preco = parseFloat(precoStr);
      
      if (!isNaN(preco) && preco > 0 && preco < 10000) {
        // Provavelmente é um preço
        if (produtoAtual && !produtoAtual.price) {
          produtoAtual.price = preco;
        }
      }
    }
    
    // Procurar por nomes de produtos conhecidos
    for (const produtoNome of produtosConhecidos) {
      if (linha.toLowerCase().includes(produtoNome)) {
        // Encontrar categoria baseada no nome
        let categoria = 'Doces';
        if (produtoNome.includes('bolo')) categoria = 'Bolos';
        else if (produtoNome.includes('coxinha') || produtoNome.includes('risole') || 
                 produtoNome.includes('pastel') || produtoNome.includes('enroladinho')) {
          categoria = 'Salgados';
        }
        
        // Tentar encontrar preço na mesma linha ou próxima
        let preco = 0;
        const matchPrecoLinha = linha.match(padraoPreco);
        if (matchPrecoLinha) {
          const precoStr = matchPrecoLinha[0].replace(/[r$\s]/gi, '').replace(',', '.');
          preco = parseFloat(precoStr);
        } else {
          // Procurar na próxima linha
          if (i + 1 < linhas.length) {
            const matchPrecoProx = linhas[i + 1].match(padraoPreco);
            if (matchPrecoProx) {
              const precoStr = matchPrecoProx[0].replace(/[r$\s]/gi, '').replace(',', '.');
              preco = parseFloat(precoStr);
            }
          }
        }
        
        // Criar produto
        const nomeProduto = linha.split(/[–\-•]/)[0].trim() || produtoNome;
        
        produtos.push({
          name: nomeProduto.charAt(0).toUpperCase() + nomeProduto.slice(1),
          price: preco || 0, // Se não encontrar preço, será 0 (precisa preencher manualmente)
          description: linha.length > nomeProduto.length ? linha : undefined,
          categoria,
          unit: 'unidade',
          estoque: categoria === 'Bolos' ? 5 : 50,
          min_stock: categoria === 'Bolos' ? 2 : 20,
        });
      }
    }
  }
  
  return produtos;
}

function processarConteudo() {
  const arquivoConteudo = path.join(__dirname, 'CONTEUDO-SITE-COMPLETO.txt');
  
  if (!fs.existsSync(arquivoConteudo)) {
    console.error('❌ Arquivo CONTEUDO-SITE-COMPLETO.txt não encontrado!');
    console.log('📝 Por favor, cole o conteúdo do site no arquivo:', arquivoConteudo);
    process.exit(1);
  }
  
  const conteudo = fs.readFileSync(arquivoConteudo, 'utf-8');
  
  if (conteudo.trim().length < 50) {
    console.error('❌ Arquivo parece estar vazio ou com pouco conteúdo!');
    console.log('📝 Por favor, cole o conteúdo completo do site no arquivo.');
    process.exit(1);
  }
  
  console.log('🔍 Processando conteúdo do site...\n');
  console.log(`📄 Tamanho do conteúdo: ${conteudo.length} caracteres\n`);
  
  const produtos = extrairProdutos(conteudo);
  
  console.log(`✅ Produtos encontrados: ${produtos.length}\n`);
  
  if (produtos.length === 0) {
    console.log('⚠️  Nenhum produto encontrado automaticamente.');
    console.log('📝 Vou criar um arquivo JSON para você preencher manualmente.\n');
    
    // Criar template JSON
    const template = {
      produtos: [
        {
          name: 'Exemplo: Brigadeiro Gourmet',
          price: 2.50,
          description: 'Descrição do produto',
          categoria: 'Doces',
          unit: 'unidade',
          estoque: 50,
          min_stock: 20,
        },
      ],
    };
    
    const arquivoJson = path.join(__dirname, 'produtos-extraidos.json');
    fs.writeFileSync(arquivoJson, JSON.stringify(template, null, 2), 'utf-8');
    console.log(`✅ Template criado em: ${arquivoJson}`);
    console.log('📝 Preencha o arquivo e execute novamente.\n');
  } else {
    // Mostrar produtos encontrados
    console.log('📦 Produtos extraídos:\n');
    produtos.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   Preço: R$ ${p.price.toFixed(2)}`);
      console.log(`   Categoria: ${p.categoria}`);
      if (p.description) console.log(`   Descrição: ${p.description}`);
      console.log('');
    });
    
    // Salvar em JSON
    const arquivoJson = path.join(__dirname, 'produtos-extraidos.json');
    fs.writeFileSync(arquivoJson, JSON.stringify({ produtos }, null, 2), 'utf-8');
    console.log(`✅ Produtos salvos em: ${arquivoJson}`);
    console.log('\n💡 Revise os produtos e ajuste preços/descrições se necessário.');
    console.log('💡 Depois, avise para eu atualizar o script de seed!\n');
  }
}

// Executar
processarConteudo();
