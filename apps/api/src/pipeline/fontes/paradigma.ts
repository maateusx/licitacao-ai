import { HttpClient } from '../../lib/http.js';
import { logger } from '../../lib/logger.js';
import { casaKeyword, pickStr, type Fonte, type LicitacaoNormalizada } from './comum.js';

/**
 * Portal de Compras Paradigma: mesmo produto (e mesmo endpoint JSON) em vários
 * regionais do Sistema S que não publicam no PNCP. A resposta não traz UF,
 * então ela vem desta lista. Portal novo = 1 linha aqui.
 */
const PORTAIS: { chave: string; base: string; uf: string | null }[] = [
  { chave: 'fieb', base: 'https://compras.fieb.org.br/Portal', uf: 'BA' }, // SESI/SENAI BA
  { chave: 'fiemg', base: 'https://compras.fiemg.com.br/Portal', uf: 'MG' }, // SESI/SENAI MG
  { chave: 'fiems', base: 'https://compras.fiems.com.br/Portal', uf: 'MS' }, // SESI/SENAI MS
  { chave: 'fiesc', base: 'https://portaldecompras.fiesc.com.br/Portal', uf: 'SC' }, // SESI/SENAI/IEL SC
  { chave: 'firjan', base: 'https://portaldecompras.firjan.com.br/Portal', uf: 'RJ' }, // SESI/SENAI RJ
  { chave: 'sfiec', base: 'https://portaldecompras.sfiec.org.br/Portal', uf: 'CE' }, // SESI/SENAI CE
  { chave: 'sestsenat', base: 'https://compras.sestsenat.org.br/Portal', uf: null }, // nacional + unidades
  { chave: 'sescrj', base: 'https://egov.paradigmabs.com.br/sescrj/Portal', uf: 'RJ' },
  { chave: 'sescba', base: 'https://egov.paradigmabs.com.br/sescba/Portal', uf: 'BA' },
  { chave: 'senacsp', base: 'https://egov.paradigmabs.com.br/senacsp/Portal', uf: 'SP' },
  { chave: 'sebraeba', base: 'https://egov.paradigmabs.com.br/sebraeba/Portal', uf: 'BA' },
  { chave: 'sescsp', base: 'https://scr360.paradigmabs.com.br/sescsp/Portal', uf: 'SP' },
  { chave: 'sescpe', base: 'https://scr360.paradigmabs.com.br/sescpe/Portal', uf: 'PE' },
  { chave: 'sescms', base: 'https://scr360.paradigmabs.com.br/sescms/Portal', uf: 'MS' },
  { chave: 'sesces', base: 'https://scr360.paradigmabs.com.br/sesces/Portal', uf: 'ES' },
];
type Portal = (typeof PORTAIS)[number];
type Item = Record<string, unknown>;

// Visão 999 = "em andamento". ponytail: 1 página de 1000 (maior portal hoje ~330); paginar se algum passar disso.
const CORPO = JSON.stringify({
  dtoProcesso: {
    tmpTipoMuralProcesso: 0, nCdModulo: 0, nCdModalidade: 0, nCdTipoModalidade: 0,
    tmpTipoMuralVisao: 999, nCdSituacao: 999, nCdTipoProcesso: 0, nCdEmpresa: 0,
    sNrProcesso: '', sDsObjeto: '', sOrdenarPor: 'TDTINICIAL', sOrdenarPorDirecao: 'DESC',
    dtoPaginacao: { nPaginaDe: 1, nPaginaAte: 1000 }, dtoIdioma: { nCdIdioma: 1 },
  },
});
const CACHE_MS = 10 * 60_000;

const http = new HttpClient('Paradigma', 500, undefined, 30_000);
let cache: { em: number; itens: Promise<{ portal: Portal; item: Item }[]> } | null = null;

/**
 * Todos os portais 1x por run (cache curto); keyword filtra localmente porque
 * o filtro do servidor (sDsObjeto) é substring — "IA" casaria com "materiais".
 * Portal fora do ar só é pulado; os outros seguem.
 */
function listar() {
  if (!cache || Date.now() - cache.em > CACHE_MS) {
    const itens = (async () => {
      const out: { portal: Portal; item: Item }[] = [];
      let falhas = 0;
      for (const portal of PORTAIS) {
        try {
          const json = (await http.postJson(
            `${portal.base}/WebService/Servicos.asmx/PesquisarProcessos`,
            CORPO,
          )) as { d?: Item[] };
          for (const item of json.d ?? []) if (aberto(item)) out.push({ portal, item });
        } catch (err) {
          falhas++;
          logger.warn({ portal: portal.chave, err: err instanceof Error ? err.message : err }, 'paradigma: portal falhou');
        }
      }
      if (falhas === PORTAIS.length) throw new Error('Paradigma: todos os portais falharam');
      return out;
    })();
    itens.catch(() => (cache = null));
    cache = { em: Date.now(), itens };
  }
  return cache.itens;
}

/** "Em andamento" inclui fases pós-prazo (homologação etc.): aberto = prazo final no futuro e não suspenso. */
function aberto(item: Item): boolean {
  const fim = dataNet(item.tDtFinal);
  const situacao = String(item.sDsSituacao ?? '');
  return fim != null && fim.getTime() > Date.now() && !/suspens/i.test(situacao);
}

export const paradigma: Fonte = {
  nome: 'paradigma',
  async *buscar(keyword) {
    for (const { portal, item } of await listar()) {
      if (casaKeyword(String(item.sDsObjeto ?? ''), keyword)) {
        const lic = mapParadigma(portal, item);
        if (lic) yield lic;
      }
    }
  },
};

/** ASP.NET: "/Date(1794945600000)/"; datas zeradas (ano 1) e sentinelas viram null. */
function dataNet(v: unknown): Date | null {
  const m = typeof v === 'string' ? /^\/Date\((-?\d+)/.exec(v) : null;
  if (!m) return null;
  const ms = Number(m[1]);
  return ms > 0 ? new Date(ms) : null;
}

/** Campos vazios vêm como "\u0013\u0012\u0012\u0013". */
function str(item: Item, key: string): string | null {
  const v = pickStr(item, [key]);
  return v && !/^[\u0012\u0013]+$/.test(v) ? v : null;
}

export function mapParadigma(portal: Portal, item: Item): LicitacaoNormalizada | null {
  const cod = item.nCdProcesso;
  if (typeof cod !== 'number' || cod <= 0) return null;

  const objeto = str(item, 'sDsObjeto');
  const numero = str(item, 'sNrProcessoDisplay');
  const valor = typeof item.dVlEstimado === 'number' && item.dVlEstimado > 0 ? item.dVlEstimado : null;
  const qs = new URLSearchParams({
    nCdModulo: String(item.nCdModulo ?? ''),
    nCdProcesso: String(cod),
    sDsProcesso: numero ?? '',
  });

  return {
    id_pncp: `paradigma:${portal.chave}:${cod}`,
    titulo: objeto ? objeto.slice(0, 200) : numero,
    objeto,
    orgao: str(item, 'sNmEmpresa') ?? str(item, 'sNmApelido'),
    uf: portal.uf,
    municipio: null,
    modalidade: str(item, 'sNmModalidade'),
    valor_estimado: valor,
    status: str(item, 'sDsSituacao'),
    data_publicacao: dataNet(item.tDtInicial),
    data_abertura: dataNet(item.tDtInicial),
    data_encerramento: dataNet(item.tDtFinal),
    // ponytail: deep link inferido do JS do portal (o mural abre o processo via JS); no pior caso cai no mural.
    url_pncp: `${portal.base}/Mural.aspx?${qs}`,
    raw: item,
  };
}
