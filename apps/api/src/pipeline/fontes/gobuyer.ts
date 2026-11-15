import { HttpClient } from '../../lib/http.js';
import { casaKeyword, pickStr, type Fonte, type LicitacaoNormalizada } from './comum.js';

/**
 * GoBuyer do Sistema Indústria: compras nacionais de CNI, SESI-DN, SENAI-DN e IEL-NC.
 * Fluxo: cookie XSRF → ids paginados → detalhes em lote. Volume baixo (~300
 * processos no total), então baixamos tudo 1x por run e filtramos localmente.
 */
const BASE = 'https://compras.sistemaindustria.com.br/compras';
const PORTAL = `${BASE}/app/portalpublico`;
const PAGE_SIZE = 50;
const CACHE_MS = 10 * 60_000;

type Item = Record<string, unknown>;

const http = new HttpClient('GoBuyer', 500);
let cache: { em: number; itens: Promise<Item[]> } | null = null;

async function sessao(): Promise<Record<string, string>> {
  const { headers } = await http.send(`${BASE}/api/csrf/token`);
  const setCookie = ([] as string[]).concat(headers['set-cookie'] ?? []);
  const cookies = setCookie.map((c) => c.split(';')[0]!).filter(Boolean);
  const xsrf = cookies.find((c) => c.startsWith('XSRF-TOKEN='))?.slice('XSRF-TOKEN='.length);
  if (!xsrf) throw new Error('GoBuyer: sem cookie XSRF-TOKEN');
  // Sem cookie + X-XSRF-TOKEN + Referer o servidor responde 403.
  return { cookie: cookies.join('; '), 'x-xsrf-token': decodeURIComponent(xsrf), referer: PORTAL };
}

function listar(): Promise<Item[]> {
  if (!cache || Date.now() - cache.em > CACHE_MS) {
    const itens = (async () => {
      const h = await sessao();
      const ids: string[] = [];
      for (let page = 1; ; page++) {
        const res = (await http.getJson(
          `${BASE}/api/painelpublicacao/listarpaginadoritensgrupospainelpublicacaoportal?page=${page}&pageSize=${PAGE_SIZE}`,
          h,
        )) as { Data?: Item[]; Pages?: number };
        for (const d of res.Data ?? []) if (typeof d.Id === 'string') ids.push(d.Id);
        if (!res.Data?.length || page >= (res.Pages ?? page)) break;
      }
      const out: Item[] = [];
      for (let i = 0; i < ids.length; i += PAGE_SIZE) {
        const qs = ids.slice(i, i + PAGE_SIZE).map((id) => `IdsEdital=${id}`).join('&');
        const det = await http.getJson(
          `${BASE}/api/painelpublicacao/listaritensgrupospainelpublicacaoporempresamaster?${qs}`,
          h,
        );
        if (Array.isArray(det)) out.push(...(det as Item[]).filter((d) => d.TempoRestante !== 'Encerrado'));
      }
      return out;
    })();
    itens.catch(() => (cache = null));
    cache = { em: Date.now(), itens };
  }
  return cache.itens;
}

export const gobuyer: Fonte = {
  nome: 'gobuyer',
  async *buscar(keyword) {
    for (const item of await listar()) {
      if (casaKeyword(String(item.Objeto ?? ''), keyword)) {
        const lic = mapGoBuyer(item);
        if (lic) yield lic;
      }
    }
  },
};

/** Datas sem fuso (horário de Brasília); "0001-01-01" = vazio. */
function data(v: unknown): Date | null {
  if (typeof v !== 'string' || v.startsWith('0001')) return null;
  const d = new Date(`${v}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapGoBuyer(item: Item): LicitacaoNormalizada | null {
  const id = pickStr(item, ['Id']);
  if (!id) return null;
  const objeto = pickStr(item, ['Objeto'])?.trim() ?? null;
  const rota = pickStr(item, ['RotaDetalhamento']) ?? '/edital/*/itens';

  return {
    id_pncp: `gobuyer:${id}`,
    titulo: objeto ? objeto.slice(0, 200) : pickStr(item, ['NumeroProcesso']),
    objeto,
    orgao: pickStr(item, ['NomeEmpresa']),
    uf: null, // departamentos nacionais (sede em Brasília, mas a execução pode ser em qualquer UF)
    municipio: null,
    modalidade: pickStr(item, ['Modalidade']),
    valor_estimado: null,
    status: pickStr(item, ['DescricaoStatusEdital']),
    data_publicacao: null,
    data_abertura: null,
    // DataAbertura = abertura dos lances, ou seja, o fim do prazo de proposta.
    data_encerramento: data(item.DataAbertura),
    url_pncp: `${PORTAL}${rota.replace('*', id)}`,
    raw: item,
  };
}
