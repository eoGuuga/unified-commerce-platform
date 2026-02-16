/**
 * Script para extrair conteúdo do site automaticamente
 * 
 * INSTRUÇÕES:
 * 1. Abra o site: https://loucasporbrigadeiro.my.canva.site/loucas-por-brigadeiro
 * 2. Pressione F12 (abre DevTools)
 * 3. Vá na aba "Console"
 * 4. Cole este script completo e pressione ENTER
 * 5. O script vai extrair todo o conteúdo e mostrar no console
 * 6. Copie o resultado e cole aqui na conversa
 */

(function() {
  console.log('🔍 Iniciando extração de conteúdo...\n');
  
  // Função para extrair texto de um elemento
  function extrairTexto(elemento) {
    if (!elemento) return '';
    return elemento.innerText || elemento.textContent || '';
  }
  
  // Função para limpar e normalizar texto
  function limparTexto(texto) {
    return texto
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }
  
  // Extrair todo o texto visível da página
  const body = document.body;
  const todoTexto = limparTexto(body.innerText || body.textContent);
  
  // Extrair todos os elementos de texto
  const elementos = Array.from(document.querySelectorAll('*'));
  const textos = elementos
    .map(el => {
      const texto = extrairTexto(el);
      // Filtrar textos muito pequenos ou vazios
      if (texto.length < 3) return null;
      // Filtrar textos que são apenas espaços
      if (!texto.trim()) return null;
      return texto.trim();
    })
    .filter((texto, index, array) => {
      // Remover duplicatas
      return texto && array.indexOf(texto) === index;
    })
    .filter(texto => texto.length > 0);
  
  // Extrair imagens (pode ter texto alternativo)
  const imagens = Array.from(document.querySelectorAll('img'))
    .map(img => ({
      src: img.src,
      alt: img.alt || '',
      title: img.title || ''
    }))
    .filter(img => img.alt || img.title);
  
  // Extrair links
  const links = Array.from(document.querySelectorAll('a'))
    .map(a => ({
      texto: extrairTexto(a),
      href: a.href
    }))
    .filter(link => link.texto.length > 0);
  
  // Procurar por padrões de preços
  const padraoPreco = /(?:r\$\s*)?(\d+[.,]\d{2})|(\d+)\s*(?:reais?|rs?)/gi;
  const precos = [];
  const matches = todoTexto.matchAll(padraoPreco);
  for (const match of matches) {
    const preco = match[0];
    if (!precos.includes(preco)) {
      precos.push(preco);
    }
  }
  
  // Procurar por nomes de produtos conhecidos
  const produtosConhecidos = [
    'brigadeiro', 'beijinho', 'cajuzinho', 'bicho de pé', 'olho de sogra',
    'bolo de chocolate', 'bolo de cenoura', 'bolo personalizado',
    'coxinha', 'risole', 'pastel', 'enroladinho', 'enrolado'
  ];
  
  const produtosEncontrados = [];
  produtosConhecidos.forEach(produto => {
    if (todoTexto.toLowerCase().includes(produto)) {
      produtosEncontrados.push(produto);
    }
  });
  
  // Montar resultado
  const resultado = {
    url: window.location.href,
    dataExtracao: new Date().toISOString(),
    todoConteudo: todoTexto,
    textosUnicos: textos.slice(0, 100), // Limitar a 100 para não ficar muito grande
    precos: precos,
    produtosEncontrados: produtosEncontrados,
    imagens: imagens.slice(0, 20), // Limitar a 20
    links: links.slice(0, 30) // Limitar a 30
  };
  
  // Mostrar resultado formatado
  console.log('\n===========================================');
  console.log('✅ EXTRAÇÃO CONCLUÍDA!');
  console.log('===========================================\n');
  
  console.log('📄 CONTEÚDO COMPLETO:');
  console.log('-------------------------------------------');
  console.log(todoTexto);
  console.log('-------------------------------------------\n');
  
  console.log('💰 PREÇOS ENCONTRADOS:');
  console.log('-------------------------------------------');
  precos.forEach(preco => console.log(`  - ${preco}`));
  console.log('-------------------------------------------\n');
  
  console.log('🍫 PRODUTOS ENCONTRADOS:');
  console.log('-------------------------------------------');
  produtosEncontrados.forEach(produto => console.log(`  - ${produto}`));
  console.log('-------------------------------------------\n');
  
  console.log('📋 PRÓXIMOS PASSOS:');
  console.log('-------------------------------------------');
  console.log('1. Copie TODO o conteúdo acima (especialmente a seção "CONTEÚDO COMPLETO")');
  console.log('2. Cole aqui na conversa com o assistente');
  console.log('3. O assistente vai processar e extrair os produtos automaticamente');
  console.log('-------------------------------------------\n');
  
  // Também criar um objeto JSON para facilitar
  console.log('📦 DADOS ESTRUTURADOS (JSON):');
  console.log('-------------------------------------------');
  console.log(JSON.stringify(resultado, null, 2));
  console.log('-------------------------------------------\n');
  
  // Retornar resultado para facilitar cópia
  return resultado;
})();
