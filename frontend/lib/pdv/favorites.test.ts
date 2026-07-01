/**
 * Testes da lógica de favoritos do PDV.
 * `listFavorites`/`toggleFavorite` persistem em localStorage ('pdv:favorites').
 * `orderByFavorites` é puro: favoritos primeiro, mantém a ordem do resto.
 *
 * jsdom já fornece um localStorage real; limpamos entre os testes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { listFavorites, toggleFavorite, orderByFavorites } from './favorites';

const KEY = 'pdv:favorites';

beforeEach(() => {
  localStorage.clear();
});

describe('listFavorites', () => {
  it('retorna lista vazia quando nada foi salvo', () => {
    expect(listFavorites()).toEqual([]);
  });

  it('lê os ids persistidos em localStorage', () => {
    localStorage.setItem(KEY, JSON.stringify(['a', 'b']));
    expect(listFavorites()).toEqual(['a', 'b']);
  });

  it('é resiliente a JSON inválido (retorna vazio)', () => {
    localStorage.setItem(KEY, 'não é json');
    expect(listFavorites()).toEqual([]);
  });
});

describe('toggleFavorite', () => {
  it('adiciona um id e persiste', () => {
    const result = toggleFavorite('p1');
    expect(result).toEqual(['p1']);
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual(['p1']);
    // Releitura confirma a persistência.
    expect(listFavorites()).toEqual(['p1']);
  });

  it('remove um id já favoritado e persiste', () => {
    toggleFavorite('p1');
    toggleFavorite('p2');
    const result = toggleFavorite('p1');
    expect(result).toEqual(['p2']);
    expect(listFavorites()).toEqual(['p2']);
  });
});

describe('orderByFavorites', () => {
  const products = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
    { id: 'd', name: 'D' },
  ];

  it('põe os favoritos primeiro mantendo a ordem original do resto', () => {
    const ordered = orderByFavorites(products, ['c', 'a']);
    expect(ordered.map((p) => p.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('mantém a ordem original quando não há favoritos', () => {
    const ordered = orderByFavorites(products, []);
    expect(ordered.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ignora favoritos que não estão na lista de produtos', () => {
    const ordered = orderByFavorites(products, ['z', 'b']);
    expect(ordered.map((p) => p.id)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('não muta o array de entrada', () => {
    const input = [...products];
    orderByFavorites(input, ['c']);
    expect(input.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
