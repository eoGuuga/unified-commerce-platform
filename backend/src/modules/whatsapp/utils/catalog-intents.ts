/**
 * Listas de frases que sinalizam intents de catalogo (depois de
 * normalizadas pela messageIntelligenceService).
 *
 * Exportadas como constantes para permitir teste isolado e para reduzir
 * o tamanho do whatsapp.service.ts.
 */

export const CATALOG_SIMILAR_FOLLOWUP_PHRASES: ReadonlyArray<string> = [
  'parecidos',
  'parecido',
  'algo parecido',
  'algo semelhante',
  'semelhantes',
  'dessa linha',
  'nesse estilo',
  'mais nessa linha',
  'mais opcoes assim',
  'outros assim',
  'outro parecido',
  'me mostra parecidos',
];

export const CATALOG_CATEGORY_FOLLOWUP_PHRASES: ReadonlyArray<string> = [
  'volta pra categoria',
  'voltar pra categoria',
  'voltar para categoria',
  'mais dessa categoria',
  'ver mais dessa categoria',
  'mostra a categoria',
  'me mostra a categoria',
  'abre a categoria',
  'volta pros itens',
  'volta para os itens',
];

export const CATALOG_PRODUCT_RECALL_PHRASES: ReadonlyArray<string> = [
  'abre esse item',
  'mostra esse item',
  'me mostra esse item',
  'volta pra esse item',
  'voltar pra esse item',
  'detalhes desse item',
  'detalhe desse item',
  'me mostra esse de novo',
];
