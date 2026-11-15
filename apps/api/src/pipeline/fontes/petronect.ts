import { HttpClient } from '../../lib/http.js';
import { casaKeyword, pickStr, type Fonte, type LicitacaoNormalizada } from './comum.js';

const BASE = 'https://www.petronect.com.br/sap/opu/odata/SAP';
// '01' = oportunidades publicadas (todas de uma vez, ~2.5 MB, sem login nem paginação).
const LISTA_URL = `${BASE}/YPCON_GET_XML_SRV/getXMLSet('01')?$format=json`;
const CACHE_MS = 10 * 60_000;

type Item = Record<string, unknown>;

const http = new HttpClient('Petronect', undefined, undefined, 60_000);
let cache: { em: number; itens: Promise<Item[]> } | null = null;

/** Lista inteira 1x por run (cache curto); cada keyword filtra localmente. */
function listar(): Promise<Item[]> {
  if (!cache || Date.now() - cache.em > CACHE_MS) {
    const itens = http.getJson(LISTA_URL).then((json) => {
      // EvXml é JSON serializado dentro do JSON.
      const evXml = (json as { d?: { EvXml?: string } }).d?.EvXml;
      if (!evXml) throw new Error('Petronect: resposta sem d.EvXml');
      const tab = (JSON.parse(evXml) as { TAB?: Item[] }).TAB;
      return Array.isArray(tab) ? tab : [];
    });
    itens.catch(() => (cache = null)); // não cachear falha
    cache = { em: Date.now(), itens };
  }
  return cache.itens;
}

/** Petrobras, Transpetro e PBio. Lei 13.303: não publicam no PNCP. */
export const petronect: Fonte = {
  nome: 'petronect',
  async *buscar(keyword) {
    for (const item of await listar()) {
      if (casaKeyword(textoBusca(item), keyword)) {
        const lic = mapPetronect(item);
        if (lic) yield lic;
      }
    }
  },
};

function itensDesc(item: Item): string[] {
  return (Array.isArray(item.ITEMS) ? item.ITEMS : [])
    .map((i) => (i as Item).ITEM_DESC)
    .filter((d): d is string => typeof d === 'string' && d.trim() !== '');
}

function textoBusca(item: Item): string {
  return [pickStr(item, ['DESC_OBJ_CONTRAT']), pickStr(item, ['OPPORT_DESCR']), ...itensDesc(item)].join(' ');
}

function data(item: Item, dia: string, hora?: string): Date | null {
  const d = pickStr(item, [dia]);
  if (!d || d.startsWith('0000')) return null;
  const h = (hora && pickStr(item, [hora])) || '00:00:00';
  const dt = new Date(`${d}T${h}-03:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function mapPetronect(item: Item): LicitacaoNormalizada | null {
  const num = pickStr(item, ['OPPORT_NUM']);
  if (!num) return null;

  const objeto = pickStr(item, ['DESC_OBJ_CONTRAT', 'OPPORT_DESCR']);
  const itens = itensDesc(item);
  const regioes = (Array.isArray(item.REGIONS) ? item.REGIONS : [])
    .map((r) => (r as Item).REGION)
    .filter((r): r is string => typeof r === 'string');
  const anexo = (Array.isArray(item.ANEXOS) ? item.ANEXOS : [])
    .map((a) => (a as Item).PHIO_OBJID)
    .find((id): id is string => typeof id === 'string' && id !== '');

  return {
    id_pncp: `petronect:${num}`,
    titulo: objeto ? objeto.slice(0, 200) : `Oportunidade ${num}`,
    objeto: [objeto, itens.length ? `Itens: ${itens.slice(0, 10).join('; ')}` : null]
      .filter(Boolean)
      .join('\n') || null,
    orgao: pickStr(item, ['COMPANY_DESC']),
    // Várias regiões (às vezes as 27): só gravamos UF quando é uma só, pro filtro de UF não mentir.
    uf: regioes.length === 1 ? regioes[0]! : null,
    municipio: null,
    modalidade: null, // OPPORT_TYPE (LICI, LIDT…) sem tabela de nomes conhecida; fica no raw.
    valor_estimado: null, // Petronect não publica valor.
    status: pickStr(item, ['STATUS_DESC']),
    data_publicacao: data(item, 'DOU_PUBL_DATE') ?? data(item, 'START_DATE', 'START_HOUR'),
    data_abertura: data(item, 'START_DATE', 'START_HOUR'),
    data_encerramento: data(item, 'END_DATE', 'END_HOUR'),
    // Sem página por oportunidade no portal (é modal JS); o edital (zip/pdf) é público.
    url_pncp: anexo
      ? `${BASE}/YPCON_PUB_ATTACHMENT_DOWNLOAD_SRV/attachmentSet('${anexo}')/$value`
      : 'https://www.petronect.com.br/',
    raw: item,
  };
}
