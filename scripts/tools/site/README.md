# Site Tools

Ferramentas para extrair e processar conteudo do site.

- `extrair-site-console.js`: cole no console do navegador para extrair conteudo.
- `processar-conteudo-site.ts`: processa o texto e gera JSON em `scripts/data/site`.
- `extract-menudireto-catalog.js`: extrai categorias, produtos, imagens e adicionais diretamente de lojas MenuDireto.
- Documentos de apoio nesta pasta.

Exemplo de uso:

```bash
node scripts/tools/site/extract-menudireto-catalog.js --url https://menudireto.com/loucas-por-brigadeiro/#12
```

Ultima atualizacao: 2026-03-21
