import { checkNarrationFacts } from './narration-guard';

/**
 * O CINTURÃO do §5 sob narração (Fatia 1). Código puro, 100% testável sem LLM.
 * Princípio: o código é dono de TODO número; a IA só narra. Se a narração da IA
 * contém um número que a tool não devolveu (ou contexto de preço sem número
 * verificável) → NÃO é seguro (cai no determinístico). Fail-closed.
 */
describe('Cinturão §5 (narration-guard) — código dono do número, IA só narra', () => {
  it('🎯 CHAVE: número não autorizado na narração → BLOQUEIA (safe:false)', () => {
    // A tool devolveu 5.00; a IA narrou 8,00 (inventou).
    expect(checkNarrationFacts('Custa R$ 8,00', [5.0]).safe).toBe(false);
  });

  it('narração fiel (número confere) → safe:true', () => {
    expect(checkNarrationFacts('Sai por R$ 5,00 🙂', [5.0]).safe).toBe(true);
  });

  it('found:false (0 autorizados) + narração inventa preço → bloqueia', () => {
    expect(checkNarrationFacts('Esse custa R$ 10,00', []).safe).toBe(false);
  });

  it('narração sem número e sem contexto de preço → passa (só tom)', () => {
    expect(checkNarrationFacts('Que delícia! Quer ver mais opções?', [5.0]).safe).toBe(true);
  });

  it('🎯 fail-closed: contexto de preço com número por EXTENSO (sem dígito) → bloqueia', () => {
    expect(checkNarrationFacts('Custa cinco reais', [5.0]).safe).toBe(false);
  });

  it('número autorizado em formatos variantes (R$5.00 / 5 reais) → confere', () => {
    expect(checkNarrationFacts('fica em R$5.00', [5.0]).safe).toBe(true);
    expect(checkNarrationFacts('são 5 reais', [5.0]).safe).toBe(true);
  });

  it('vários números, um inventado (desconto falso) → bloqueia', () => {
    expect(checkNarrationFacts('de R$ 5,00 por R$ 4,00', [5.0]).safe).toBe(false);
  });

  // --- Fatia 2 / Movimento A: catálogo com N preços autorizados (multi-número) ---
  describe('show_catalog — vários preços autorizados de uma vez', () => {
    it('narração fiel do catálogo (todos os preços ∈ autorizados) → passa', () => {
      const catalogPrices = [5.0, 12.9, 8.0];
      expect(
        checkNarrationFacts(
          'Temos Brigadeiro por R$ 5,00, Bolo por R$ 12,90 e Trufa por R$ 8,00!',
          catalogPrices,
        ).safe,
      ).toBe(true);
    });

    it('🎯 um preço trocado/inventado no catálogo (99 ∉ autorizados) → bloqueia', () => {
      const catalogPrices = [5.0, 12.9, 8.0];
      expect(
        checkNarrationFacts('Brigadeiro por R$ 5,00 e Bolo por R$ 99,00', catalogPrices).safe,
      ).toBe(false);
    });
  });

  // --- Fatia 2 / Movimento A: guarda de inteiro-pelado (opt-in) pro check_stock B1 ---
  describe('check_stock B1 — forbidBareNumbers pega quantidade inventada', () => {
    it('narração de disponibilidade SEM número → passa (o answer B1 esperado)', () => {
      expect(
        checkNarrationFacts('Temos sim! 🍫 Quer que eu adicione ao carrinho?', [], {
          forbidBareNumbers: true,
        }).safe,
      ).toBe(true);
    });

    it('🎯 IA inventa quantidade ("temos uns 20") → 20 é inteiro pelado ∉ [] → bloqueia', () => {
      expect(
        checkNarrationFacts('Temos uns 20 em estoque!', [], { forbidBareNumbers: true }).safe,
      ).toBe(false);
    });

    it('sem forbidBareNumbers (default), o inteiro pelado NÃO é verificado (só dinheiro)', () => {
      // Comportamento do cinturão de-dinheiro puro (check_price/show_catalog): "20"
      // sem R$/reais/decimal escorrega — por isso o guarda é opt-in só pro check_stock.
      expect(checkNarrationFacts('Temos uns 20 em estoque!', []).safe).toBe(true);
    });

    it('forbidBareNumbers ignora porcentagem de tom ("100% disponível") → passa', () => {
      expect(
        checkNarrationFacts('Temos sim, 100% disponível! 😊', [], {
          forbidBareNumbers: true,
        }).safe,
      ).toBe(true);
    });
  });
});
