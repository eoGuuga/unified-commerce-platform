import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearOrderTrackingContext,
  readOrderTrackingContext,
  saveOrderTrackingContext,
  ORDER_TRACKING_SESSION_KEY,
} from './order-tracking';

describe('order-tracking', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  describe('saveOrderTrackingContext', () => {
    it('grava contexto valido em sessionStorage', () => {
      saveOrderTrackingContext({
        orderNo: 'PED-001',
        customerEmail: 'a@b.com',
      });
      const raw = window.sessionStorage.getItem(ORDER_TRACKING_SESSION_KEY);
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw!)).toEqual({
        orderNo: 'PED-001',
        customerEmail: 'a@b.com',
      });
    });

    it('ignora chamada sem orderNo', () => {
      saveOrderTrackingContext({ orderNo: '' });
      expect(
        window.sessionStorage.getItem(ORDER_TRACKING_SESSION_KEY),
      ).toBeNull();
    });
  });

  describe('readOrderTrackingContext', () => {
    it('retorna null quando vazio', () => {
      expect(readOrderTrackingContext()).toBeNull();
    });

    it('retorna o contexto quando orderNo bate', () => {
      saveOrderTrackingContext({ orderNo: 'PED-001' });
      expect(readOrderTrackingContext('PED-001')).toMatchObject({
        orderNo: 'PED-001',
      });
    });

    it('retorna null quando orderNo nao bate', () => {
      saveOrderTrackingContext({ orderNo: 'PED-001' });
      expect(readOrderTrackingContext('PED-999')).toBeNull();
    });

    it('retorna null para JSON corrompido', () => {
      window.sessionStorage.setItem(ORDER_TRACKING_SESSION_KEY, 'lixo {');
      expect(readOrderTrackingContext()).toBeNull();
    });

    it('retorna null se faltar orderNo no payload armazenado', () => {
      window.sessionStorage.setItem(
        ORDER_TRACKING_SESSION_KEY,
        JSON.stringify({ customerEmail: 'a@b.com' }),
      );
      expect(readOrderTrackingContext()).toBeNull();
    });
  });

  describe('clearOrderTrackingContext', () => {
    it('limpa o contexto armazenado', () => {
      saveOrderTrackingContext({ orderNo: 'PED-001' });
      clearOrderTrackingContext();
      expect(readOrderTrackingContext()).toBeNull();
    });

    it('nao limpa se orderNo nao bate', () => {
      saveOrderTrackingContext({ orderNo: 'PED-001' });
      clearOrderTrackingContext('PED-999');
      expect(readOrderTrackingContext()).not.toBeNull();
    });
  });
});
