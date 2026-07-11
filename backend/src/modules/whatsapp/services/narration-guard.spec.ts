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
});
