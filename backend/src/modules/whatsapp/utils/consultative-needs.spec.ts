import {
  ABSTRACT_NEED_WORDS,
  SPECIFIC_PRODUCT_TOKENS,
  hasImplicitSingularOrderLead,
  isAbstractConsultativeNeed,
} from './consultative-needs';

describe('consultative-needs utils', () => {
  describe('hasImplicitSingularOrderLead', () => {
    it('true para "quero um/uma X"', () => {
      expect(hasImplicitSingularOrderLead('quero um brigadeiro')).toBe(true);
      expect(hasImplicitSingularOrderLead('quero uma sobremesa')).toBe(true);
      expect(hasImplicitSingularOrderLead('preciso uma opcao')).toBe(true);
      expect(hasImplicitSingularOrderLead('gostaria de um doce')).toBe(true);
    });

    it('false sem o "um/uma"', () => {
      expect(hasImplicitSingularOrderLead('quero brigadeiro')).toBe(false);
      expect(hasImplicitSingularOrderLead('manda doces')).toBe(false);
    });

    it('false para texto sem verbo de pedido inicial', () => {
      expect(hasImplicitSingularOrderLead('oi quero um brigadeiro')).toBe(
        false,
      );
    });
  });

  describe('constants', () => {
    it('ABSTRACT_NEED_WORDS contem termos consultivos', () => {
      expect(ABSTRACT_NEED_WORDS.has('algo')).toBe(true);
      expect(ABSTRACT_NEED_WORDS.has('sobremesa')).toBe(true);
      expect(ABSTRACT_NEED_WORDS.has('presente')).toBe(true);
      expect(ABSTRACT_NEED_WORDS.has('brigadeiro')).toBe(true);
    });

    it('SPECIFIC_PRODUCT_TOKENS contem itens concretos', () => {
      expect(SPECIFIC_PRODUCT_TOKENS.has('banoffe')).toBe(true);
      expect(SPECIFIC_PRODUCT_TOKENS.has('brownie')).toBe(true);
      expect(SPECIFIC_PRODUCT_TOKENS.has('caixa')).toBe(true);
    });
  });

  describe('isAbstractConsultativeNeed', () => {
    it('true quando todas as palavras estao em ABSTRACT_NEED_WORDS', () => {
      expect(isAbstractConsultativeNeed('algo')).toBe(true);
      expect(isAbstractConsultativeNeed('sobremesa para visita')).toBe(true);
      expect(isAbstractConsultativeNeed('presente para almoco')).toBe(true);
    });

    it('false quando contem um SPECIFIC_PRODUCT_TOKEN', () => {
      expect(isAbstractConsultativeNeed('presente brownie')).toBe(false);
      expect(isAbstractConsultativeNeed('caixa de presente')).toBe(false);
      expect(isAbstractConsultativeNeed('uma banoffe')).toBe(false);
    });

    it('false quando contem palavra fora das duas listas', () => {
      expect(isAbstractConsultativeNeed('coisa estranha')).toBe(false);
    });

    it('false para string vazia', () => {
      expect(isAbstractConsultativeNeed('')).toBe(false);
    });
  });
});
