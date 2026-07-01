import { describeBusinessHours, BusinessHours } from './business-hours';

describe('business-hours util', () => {
  describe('describeBusinessHours — agrupa dias com mesma faixa', () => {
    it('seg-sex 09:00-18:00, sáb 09:00-13:00, dom fechado', () => {
      const bh: BusinessHours = {
        tz: 'America/Sao_Paulo',
        days: {
          '1': { open: '09:00', close: '18:00' },
          '2': { open: '09:00', close: '18:00' },
          '3': { open: '09:00', close: '18:00' },
          '4': { open: '09:00', close: '18:00' },
          '5': { open: '09:00', close: '18:00' },
          '6': { open: '09:00', close: '13:00' },
        },
      };
      expect(describeBusinessHours(bh)).toBe('seg-sex 09:00-18:00, sáb 09:00-13:00');
    });

    it('semana inteira na mesma faixa -> grupo unico dom-sáb', () => {
      const days: BusinessHours['days'] = {};
      for (let d = 0; d <= 6; d++) days[String(d)] = { open: '08:00', close: '20:00' };
      expect(describeBusinessHours({ tz: 'America/Sao_Paulo', days })).toBe(
        'dom-sáb 08:00-20:00',
      );
    });

    it('so sábado 09:00-13:00 -> um dia so, sem hifen de intervalo', () => {
      const bh: BusinessHours = {
        tz: 'America/Sao_Paulo',
        days: { '6': { open: '09:00', close: '13:00' } },
      };
      expect(describeBusinessHours(bh)).toBe('sáb 09:00-13:00');
    });

    it('dias nao contiguos com mesma faixa nao viram intervalo (seg e qua)', () => {
      const bh: BusinessHours = {
        tz: 'America/Sao_Paulo',
        days: {
          '1': { open: '09:00', close: '18:00' },
          '3': { open: '09:00', close: '18:00' },
        },
      };
      // seg e qua nao sao contiguos -> listados separados, mesma faixa.
      expect(describeBusinessHours(bh)).toBe('seg 09:00-18:00, qua 09:00-18:00');
    });

    it('sem dias (loja fechada) -> string vazia', () => {
      expect(describeBusinessHours({ tz: 'America/Sao_Paulo', days: {} })).toBe('');
    });
  });
});
