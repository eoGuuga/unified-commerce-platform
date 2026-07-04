import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'crypto';

/** Entrada do cache de DEK desembrulhada (plaintext em RAM) — com validade. */
type CachedDek = { dek: Buffer; version: number; expiresAt: number };

/** TTL da DEK em cache: releitura periodica (limita a janela do plaintext em RAM). */
const DEK_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min
/** Teto de tenants em cache (bounded — evita crescer sem limite). */
const DEK_CACHE_MAX = 1000;

/**
 * Envelope encryption (Fase 1).
 *
 * Modelo: a `ENCRYPTION_MASTER_KEY` (KEK, so no env) EMBRULHA uma DEK de 32
 * bytes por-tenant (guardada embrulhada em `tenant_data_keys`, sob RLS). Cada
 * segredo do tenant e cifrado com a DEK dele. Um dump do banco entrega DEKs
 * embrulhadas + ciphertext, mas SEM a master (que nunca toca o banco) nao
 * decifra nada. Isola o raio de dano por-tenant e abre a porta da rotacao.
 *
 * A `ENCRYPTION_KEY` antiga fica SO para ler o formato v1 legado (dual-format).
 *
 * ATENCAO — a `ENCRYPTION_MASTER_KEY` e o segredo mais poderoso do sistema
 * (protege as chaves de TODOS os lojistas): forte de verdade (32+ aleatorios),
 * distinta da `ENCRYPTION_KEY`, nunca em log/git, backup seguro separado. Na
 * Fase 2 (pagamentos) migra para um KMS. Enquanto for env, e alvo de alto valor.
 */
@Injectable()
export class EncryptionService implements OnModuleDestroy {
  /** Chave de 32 bytes derivada de ENCRYPTION_KEY — SO para o formato v1 legado. */
  private readonly aesKey: Buffer;
  /** Master key (32 bytes) de ENCRYPTION_MASTER_KEY — SO embrulha/desembrulha DEKs. */
  private readonly masterAesKey: Buffer;
  /** Cache de DEKs desembrulhadas (plaintext em RAM) — TTL + bounded + zeroize. */
  private readonly dekCache = new Map<string, CachedDek>();

  constructor(
    private configService: ConfigService,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {
    // ENCRYPTION_KEY: chave v1 legada (precisa continuar estavel p/ ler o que ja foi cifrado).
    const key = (this.configService.get<string>('ENCRYPTION_KEY') || '').trim();
    this.assertStrongKey(key, 'ENCRYPTION_KEY');
    this.aesKey = createHash('sha256').update(key).digest();

    // ENCRYPTION_MASTER_KEY: KEK do envelope — boot fail-closed, forte e distinta.
    const masterKey = (
      this.configService.get<string>('ENCRYPTION_MASTER_KEY') || ''
    ).trim();
    this.assertStrongKey(masterKey, 'ENCRYPTION_MASTER_KEY');
    // Em producao NAO pode reusar a ENCRYPTION_KEY (chaves separadas de proposito).
    if (process.env.NODE_ENV === 'production' && masterKey === key) {
      throw new Error(
        'ENCRYPTION_MASTER_KEY nao pode ser igual a ENCRYPTION_KEY — ' +
          'use uma chave forte e distinta (gere um aleatorio novo so para ela).',
      );
    }
    this.masterAesKey = createHash('sha256').update(masterKey).digest();
  }

  /** No shutdown, zera o plaintext das DEKs em memoria. */
  onModuleDestroy(): void {
    for (const entry of this.dekCache.values()) entry.dek.fill(0);
    this.dekCache.clear();
  }

  /** Recusa boot se a chave for ausente/fraca/placeholder (fail-closed). */
  private assertStrongKey(key: string, name: string): void {
    const looksInsecure =
      !key ||
      key.length < 32 ||
      key.toLowerCase().includes('change-me') ||
      key.toLowerCase().includes('dev-secret');
    if (looksInsecure) {
      throw new Error(
        `${name} deve ser definido e seguro (32+ caracteres aleatorios). ` +
          'Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }
  }

  // ===================== AES-256-GCM (primitivo compartilhado) =====================

  private aesEncrypt(
    key: Buffer,
    plaintext: Buffer,
  ): { iv: Buffer; tag: Buffer; ct: Buffer } {
    const iv = randomBytes(12); // GCM recomenda 96 bits
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return { iv, tag: cipher.getAuthTag(), ct };
  }

  private aesDecrypt(key: Buffer, iv: Buffer, tag: Buffer, ct: Buffer): Buffer {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  }

  // ===================== Formato v1 legado (chave unica) =====================

  /**
   * Cifra com a ENCRYPTION_KEY unica (formato v1). Mantido apenas para
   * compatibilidade de leitura; segredos NOVOS usam encrypt()/decrypt() (envelope).
   * Formato: base64(iv).base64(tag).base64(ct).
   */
  encryptString(plaintext: string): string {
    const { iv, tag, ct } = this.aesEncrypt(
      this.aesKey,
      Buffer.from(plaintext, 'utf8'),
    );
    return `${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`;
  }

  /** Reverte encryptString (v1). Retorna null se o formato/tag forem invalidos. */
  decryptString(payload: string | null | undefined): string | null {
    if (!payload) return null;
    try {
      const [ivB64, tagB64, dataB64] = payload.split('.');
      if (!ivB64 || !tagB64 || !dataB64) return null;
      return this.aesDecrypt(
        this.aesKey,
        Buffer.from(ivB64, 'base64'),
        Buffer.from(tagB64, 'base64'),
        Buffer.from(dataB64, 'base64'),
      ).toString('utf8');
    } catch {
      return null;
    }
  }

  // ===================== Envelope: master embrulha/desembrulha a DEK =====================

  /** Embrulha uma DEK (32 bytes) com a master key. Formato interno igual ao v1. */
  private wrapDek(dek: Buffer): string {
    const { iv, tag, ct } = this.aesEncrypt(this.masterAesKey, dek);
    return `${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`;
  }

  /**
   * Desembrulha uma DEK. LANCA (nao silencia) se a master estiver errada ou a
   * DEK corrompida — e erro de configuracao/integridade, deve falhar alto, nao
   * virar "null" silencioso pra cada segredo do banco.
   */
  private unwrapDek(wrapped: string): Buffer {
    const [ivB64, tagB64, dataB64] = wrapped.split('.');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('wrapped_dek em formato invalido');
    }
    return this.aesDecrypt(
      this.masterAesKey,
      Buffer.from(ivB64, 'base64'),
      Buffer.from(tagB64, 'base64'),
      Buffer.from(dataB64, 'base64'),
    );
  }

  /**
   * Retorna a DEK atual do tenant (maior key_version), desembrulhada. Sob RLS:
   * seta o contexto do tenant e le so a DEK dele. Com `create=true`, gera+persiste
   * a v1 se ainda nao existir; com `create=false`, retorna null se nao existir.
   * Cacheia o plaintext (TTL + bounded).
   */
  private async getTenantDek(
    tenantId: string,
    create: boolean,
  ): Promise<{ dek: Buffer; version: number } | null> {
    const cached = this.dekCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return { dek: cached.dek, version: cached.version };
    }

    const result = await this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [
        tenantId,
      ]);
      let rows = await manager.query(
        `SELECT key_version, wrapped_dek FROM tenant_data_keys
           WHERE tenant_id = $1 ORDER BY key_version DESC LIMIT 1`,
        [tenantId],
      );

      if (!rows.length) {
        if (!create) return null;
        const newDek = randomBytes(32);
        const wrapped = this.wrapDek(newDek);
        await manager.query(
          `INSERT INTO tenant_data_keys (tenant_id, key_version, wrapped_dek)
             VALUES ($1, 1, $2)
             ON CONFLICT (tenant_id, key_version) DO NOTHING`,
          [tenantId, wrapped],
        );
        // Re-le (cobre corrida: outro processo pode ter inserido a v1 primeiro).
        rows = await manager.query(
          `SELECT key_version, wrapped_dek FROM tenant_data_keys
             WHERE tenant_id = $1 ORDER BY key_version DESC LIMIT 1`,
          [tenantId],
        );
      }

      // unwrapDek LANCA se a master estiver errada — propaga (fail alto).
      return {
        dek: this.unwrapDek(rows[0].wrapped_dek),
        version: rows[0].key_version as number,
      };
    });

    if (result) this.cacheDek(tenantId, result.dek, result.version);
    return result;
  }

  /** Guarda a DEK em cache; se estourar o teto, evicta a mais antiga (zerando-a). */
  private cacheDek(tenantId: string, dek: Buffer, version: number): void {
    if (this.dekCache.size >= DEK_CACHE_MAX && !this.dekCache.has(tenantId)) {
      const oldestKey = this.dekCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.dekCache.get(oldestKey)?.dek.fill(0);
        this.dekCache.delete(oldestKey);
      }
    }
    this.dekCache.set(tenantId, {
      dek,
      version,
      expiresAt: Date.now() + DEK_CACHE_TTL_MS,
    });
  }

  // ===================== API tenant-aware (envelope, formato v2) =====================

  /**
   * Cifra um segredo com a DEK do tenant (cria a DEK na primeira vez).
   * Formato: `v2.<key_version>.base64(iv).base64(tag).base64(ct)`.
   */
  async encrypt(plaintext: string, tenantId: string): Promise<string> {
    const entry = await this.getTenantDek(tenantId, true);
    // create=true nunca retorna null, mas o TS nao sabe.
    if (!entry) throw new Error('falha ao obter a DEK do tenant');
    const { iv, tag, ct } = this.aesEncrypt(
      entry.dek,
      Buffer.from(plaintext, 'utf8'),
    );
    return `v2.${entry.version}.${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`;
  }

  /**
   * Decifra. Detecta o formato: `v2.` = envelope por-tenant; senao = v1 legado
   * (chave unica) — dual-format. Retorna null em falha de DADO (tag invalido:
   * adulteracao ou DEK de outro tenant). Uma master errada, porem, PROPAGA
   * (erro de config, nao pode virar null silencioso).
   */
  async decrypt(
    ciphertext: string | null | undefined,
    tenantId: string,
  ): Promise<string | null> {
    if (!ciphertext) return null;
    if (!ciphertext.startsWith('v2.')) {
      return this.decryptString(ciphertext); // v1 legado
    }

    // v2 . version . iv . tag . ct
    const parts = ciphertext.split('.');
    if (parts.length !== 5) return null;
    const [, , ivB64, tagB64, dataB64] = parts;

    // getTenantDek fica FORA do try: se a master estiver errada, o erro propaga.
    const entry = await this.getTenantDek(tenantId, false);
    if (!entry) return null; // tenant sem DEK => nada foi cifrado pra ele

    try {
      return this.aesDecrypt(
        entry.dek,
        Buffer.from(ivB64, 'base64'),
        Buffer.from(tagB64, 'base64'),
        Buffer.from(dataB64, 'base64'),
      ).toString('utf8');
    } catch {
      // tag invalido: adulteracao ou DEK de outro tenant (isolamento) -> null
      return null;
    }
  }

  // ===================== Segredos por-tenant (whatsapp cloud token) =====================

  /**
   * Salva o access token da WhatsApp Cloud API do tenant, agora com envelope
   * (DEK por-tenant). Coluna: tenants.whatsapp_cloud_token_encrypted.
   */
  async saveWhatsappCloudToken(
    tenantId: string,
    accessToken: string,
  ): Promise<void> {
    const encrypted = await this.encrypt(accessToken, tenantId);
    await this.dataSource.query(
      `UPDATE tenants SET whatsapp_cloud_token_encrypted = $1 WHERE id = $2`,
      [encrypted, tenantId],
    );
  }

  /**
   * Le e decifra o access token da Cloud API do tenant (null se ausente).
   * Dual-format: le tanto o v2 (envelope) quanto o v1 legado transparentemente.
   */
  async getWhatsappCloudToken(tenantId: string): Promise<string | null> {
    const rows = await this.dataSource.query(
      `SELECT whatsapp_cloud_token_encrypted FROM tenants WHERE id = $1`,
      [tenantId],
    );
    return this.decrypt(rows[0]?.whatsapp_cloud_token_encrypted ?? null, tenantId);
  }
}
