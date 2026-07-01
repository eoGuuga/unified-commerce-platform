/**
 * Horario de funcionamento da loja — SHAPE POR-DIA (fonte unica).
 *
 * Mapa por dia da semana (chave "0".."6", 0=domingo). Cada dia com faixa propria
 * (open/close em "HH:MM"). Dia AUSENTE do mapa = FECHADO. Sem flag de "fechado":
 * a ausencia da chave ja significa fechado — consulta dominante "abre no dia D?
 * que horario?" e O(1) via `days[dow]`.
 *
 * Ex.: seg-sex 09:00-18:00, sab 09:00-13:00, dom fechado:
 *   { tz:"America/Sao_Paulo",
 *     days:{ "1":{open:"09:00",close:"18:00"}, ..., "5":{...},
 *            "6":{open:"09:00",close:"13:00"} } }
 *
 * Util compartilhado (importavel pelo DTO de settings e pelo loader do bot),
 * para o horario ser fonte unica: a lógica de retirada, o backstop e a string
 * do prompt do bot derivam TODOS deste mesmo objeto.
 */
export interface DayHours {
  open: string; // "HH:MM"
  close: string; // "HH:MM"
}

export interface BusinessHours {
  tz: string; // IANA (ex.: America/Sao_Paulo)
  days: { [dow: string]: DayHours }; // chave "0".."6" (0=domingo); ausente = fechado
}

// Nomes curtos PT dos dias, indexados por dow (0=dom .. 6=sab).
const DIA_NOMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/**
 * Descreve o horario em texto para o cliente/prompt, AGRUPANDO dias CONTIGUOS
 * com a mesma faixa (open/close). Dias fora do mapa (fechados) sao ignorados.
 *
 * Ex.: seg-sex 09:00-18:00 + sab 09:00-13:00  =>  "seg-sex 09:00-18:00, sáb 09:00-13:00".
 * Sem nenhum dia aberto  =>  string vazia (o chamador decide o fallback).
 */
export function describeBusinessHours(bh: BusinessHours): string {
  if (!bh || !bh.days) {
    return '';
  }
  // Dias abertos, em ordem crescente de dow (0..6).
  const abertos = Object.keys(bh.days)
    .map((k) => Number(k))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6 && !!bh.days[String(d)])
    .sort((a, b) => a - b);

  if (abertos.length === 0) {
    return '';
  }

  const grupos: string[] = [];
  let inicio = abertos[0];
  let anterior = abertos[0];

  const faixaDe = (dow: number): string => {
    const dh = bh.days[String(dow)];
    return `${dh.open}-${dh.close}`;
  };

  const fecharGrupo = (ini: number, fim: number): void => {
    const faixa = faixaDe(ini);
    const rotulo =
      ini === fim ? DIA_NOMES[ini] : `${DIA_NOMES[ini]}-${DIA_NOMES[fim]}`;
    grupos.push(`${rotulo} ${faixa}`);
  };

  for (let i = 1; i < abertos.length; i++) {
    const atual = abertos[i];
    const contiguo = atual === anterior + 1;
    const mesmaFaixa = faixaDe(atual) === faixaDe(anterior);
    if (contiguo && mesmaFaixa) {
      anterior = atual;
      continue;
    }
    fecharGrupo(inicio, anterior);
    inicio = atual;
    anterior = atual;
  }
  fecharGrupo(inicio, anterior);

  return grupos.join(', ');
}
