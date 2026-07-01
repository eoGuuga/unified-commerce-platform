'use client';

/**
 * useTenantSettings — hook de dados da tela de Configurações da Loja.
 *
 * Modelado nos hooks existentes (useProducts.update / useStock.adjustStock):
 * useState/useEffect/useCallback manual (o repo NÃO usa react-query).
 *
 * Fetch on mount (loading/error) via `api.getSettings()`.
 * `update(dto)`: aplica a mudança no estado local (optimistic), chama
 * `api.updateSettings(dto)`; no sucesso reflete o RETORNO do servidor (verdade
 * canônica); no erro REVERTE ao snapshot anterior e retorna { ok:false, error }.
 *
 * A tela (T7) decide como fatiar o DTO por seção — aqui o merge otimista é
 * por-seção (só sobrepõe as seções presentes no dto, preservando as demais).
 */

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api-client';
import type {
  TenantSettingsProjection,
  UpdateTenantSettingsDto,
} from '@/lib/types/tenant-settings';

export interface UpdateSettingsResult {
  ok: boolean;
  error?: string;
}

export interface UseTenantSettingsResult {
  settings: TenantSettingsProjection | null;
  loading: boolean;
  error: string | null;
  /** Atualiza por seção com optimistic update + rollback fiel no erro. */
  update: (dto: UpdateTenantSettingsDto) => Promise<UpdateSettingsResult>;
  refetch: () => Promise<void>;
}

/**
 * Aplica o dto otimista sobre a projeção atual, seção a seção.
 * Só toca as seções presentes no dto (merge raso por seção); as ausentes ficam
 * intactas. Retorna uma nova projeção (não muta o snapshot anterior).
 */
function applyOptimistic(
  current: TenantSettingsProjection,
  dto: UpdateTenantSettingsDto,
): TenantSettingsProjection {
  return {
    ...current,
    loja: dto.loja ? { ...current.loja, ...dto.loja } : current.loja,
    horario: dto.horario
      ? { ...current.horario, ...dto.horario }
      : current.horario,
    pagamento: dto.pagamento
      ? { ...current.pagamento, ...dto.pagamento }
      : current.pagamento,
    // `status` é derivado no backend; o otimismo não o mexe — o retorno do
    // servidor no sucesso traz os booleanos corretos.
    status: current.status,
  };
}

/**
 * Carrega e gerencia as configurações do tenant autenticado (tela do admin).
 */
export function useTenantSettings(): UseTenantSettingsResult {
  const [settings, setSettings] = useState<TenantSettingsProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar as configurações.',
      );
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  const update = useCallback(
    async (dto: UpdateTenantSettingsDto): Promise<UpdateSettingsResult> => {
      if (!settings) return { ok: false, error: 'Configurações não carregadas.' };

      // 1. Snapshot para rollback + optimistic update por seção.
      const snapshot = settings;
      setSettings(applyOptimistic(snapshot, dto));

      try {
        const updated = await api.updateSettings(dto);
        // 2. Sucesso: refletir o retorno do servidor (verdade canônica).
        setSettings(updated);
        return { ok: true };
      } catch (err) {
        // 3. Erro: reverter ao snapshot exato anterior.
        setSettings(snapshot);
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'Falha ao salvar as configurações.',
        };
      }
    },
    [settings],
  );

  return { settings, loading, error, update, refetch: fetchSettings };
}
