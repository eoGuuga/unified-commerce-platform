/**
 * Prova de seguranca: politica de senha do registro + custo do bcrypt.
 *  - senha fraca (curta / so letras / so numeros / longa demais) e rejeitada;
 *  - senha forte o suficiente passa;
 *  - o custo do bcrypt para hashes novos e 12 (>= recomendado moderno).
 */
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { RegisterDto } from './dto/register.dto';
import { BCRYPT_COST } from './auth.constants';

function passwordErrors(password: string): string[] {
  const dto = plainToInstance(RegisterDto, {
    email: 'user@exemplo.com',
    password,
    accept_terms: true,
  });
  const errors = validateSync(dto);
  const pwErr = errors.find((e) => e.property === 'password');
  return pwErr ? Object.values(pwErr.constraints ?? {}) : [];
}

describe('Politica de senha (RegisterDto)', () => {
  it('aceita senha forte (>=8, com letra e numero)', () => {
    expect(passwordErrors('senha1234')).toHaveLength(0);
  });

  it('rejeita senha curta (< 8)', () => {
    expect(passwordErrors('sen12')).not.toHaveLength(0); // 5 chars
  });

  it('rejeita senha so com letras (sem numero)', () => {
    expect(passwordErrors('abcdefgh')).not.toHaveLength(0);
  });

  it('rejeita senha so com numeros (sem letra)', () => {
    expect(passwordErrors('12345678')).not.toHaveLength(0);
  });

  it('rejeita senha longa demais (> 72 bytes — evita truncamento silencioso do bcrypt)', () => {
    expect(passwordErrors('a1'.repeat(40))).not.toHaveLength(0); // 80 chars
  });
});

describe('Custo do bcrypt', () => {
  it('usa custo >= 12 para hashes novos', () => {
    expect(BCRYPT_COST).toBeGreaterThanOrEqual(12);
  });

  it('o custo configurado produz hashes com 12 rounds', () => {
    const hash = bcrypt.hashSync('qualquer-senha-1', BCRYPT_COST);
    expect(bcrypt.getRounds(hash)).toBe(12);
  });
});
