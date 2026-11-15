import assert from 'node:assert/strict';
import { fontesAtivas } from '../pipeline/fontes/index.js';
import { casaKeyword } from '../pipeline/fontes/comum.js';
import { mapGoBuyer } from '../pipeline/fontes/gobuyer.js';
import { mapParadigma } from '../pipeline/fontes/paradigma.js';
import { mapPetronect } from '../pipeline/fontes/petronect.js';
import { mapPncpItem } from '../pipeline/fontes/pncp.js';
import { mapGazette } from '../pipeline/fontes/querido-diario.js';

/**
 * Testa as fontes sem banco: asserts dos mapeadores + busca real opcional.
 *   pnpm fonte:test                          # só asserts (offline)
 *   pnpm fonte:test querido_diario chatbot   # + busca real, 1 página, imprime 3 resultados
 */
function asserts() {
  const p = mapPncpItem({ numero_controle_pncp: 'X-1', title: 'T', item_url: '/compras/1/2024/3', valor_global: '1500.5' });
  assert.equal(p?.id_pncp, 'X-1');
  assert.equal(p?.valor_estimado, 1500.5);
  assert.equal(p?.url_pncp, 'https://pncp.gov.br/app/editais/1/2024/3');
  assert.equal(mapPncpItem({ title: 'sem id' }), null);

  const g = mapGazette({
    territory_id: '3550308', date: '2026-11-10', territory_name: 'São Paulo', state_code: 'SP',
    edition: '210', is_extra_edition: true, url: 'https://x/d.pdf',
    excerpts: ['Pregão <em>chatbot</em>\n  atendimento', 'outro trecho'],
  });
  assert.equal(g?.id_pncp, 'querido_diario:3550308-2026-11-10-210-extra');
  assert.equal(g?.objeto, 'Pregão chatbot atendimento\n…\noutro trecho');
  assert.equal(g?.uf, 'SP');
  assert.equal(g?.url_pncp, 'https://x/d.pdf');
  assert.equal(mapGazette({ date: '2026-11-10' }), null);

  assert.ok(casaKeyword('Plataforma de IA generativa', 'IA'));
  assert.ok(!casaKeyword('Aquisição de materiais', 'IA'));
  assert.ok(casaKeyword('INTELIGENCIA ARTIFICIAL aplicada', 'inteligência artificial'));

  const pn = mapPetronect({
    OPPORT_NUM: '7004687604', COMPANY_DESC: 'Petrobras', DESC_OBJ_CONTRAT: 'Licença SaaS',
    END_DATE: '2026-11-26', END_HOUR: '17:00:00', AUC_START_DATE: '0000-00-00',
    REGIONS: [{ REGION: 'RJ' }, { REGION: 'SP' }], ANEXOS: [{ PHIO_OBJID: 'ABC' }], ITEMS: [{ ITEM_DESC: 'SOFTWARE' }],
  });
  assert.equal(pn?.id_pncp, 'petronect:7004687604');
  assert.equal(pn?.uf, null); // várias regiões
  assert.equal(pn?.data_encerramento?.toISOString(), '2026-11-26T20:00:00.000Z');
  assert.ok(pn?.objeto?.includes('Itens: SOFTWARE'));
  assert.ok(pn?.url_pncp?.includes("attachmentSet('ABC')"));

  const pd = mapParadigma(
    { chave: 'fieb', base: 'https://x/Portal', uf: 'BA' },
    { nCdProcesso: 21526, nCdModulo: 59, sNrProcessoDisplay: 'SDE 1', sDsObjeto: 'Chatbot',
      sNmEmpresa: 'SENAI', sNmModalidade: '\u0013\u0012\u0012\u0013', tDtFinal: '/Date(1794945600000)/',
      tDtInicial: '/Date(-62135586000000)/', dVlEstimado: 0 },
  );
  assert.equal(pd?.id_pncp, 'paradigma:fieb:21526');
  assert.equal(pd?.modalidade, null); // sentinela vazia
  assert.equal(pd?.valor_estimado, null);
  assert.equal(pd?.data_abertura, null);
  assert.equal(pd?.data_encerramento?.getTime(), 1794945600000);
  assert.equal(pd?.url_pncp, 'https://x/Portal/Mural.aspx?nCdModulo=59&nCdProcesso=21526&sDsProcesso=SDE+1');

  const gb = mapGoBuyer({ Id: 'g-1', Objeto: ' Chatbot ', NomeEmpresa: 'SENAI', DataAbertura: '2026-11-19T09:59:00', RotaDetalhamento: '/edital/*/itens' });
  assert.equal(gb?.id_pncp, 'gobuyer:g-1');
  assert.equal(gb?.objeto, 'Chatbot');
  assert.equal(gb?.data_encerramento?.toISOString(), '2026-11-19T12:59:00.000Z');
  assert.equal(gb?.url_pncp, 'https://compras.sistemaindustria.com.br/compras/app/portalpublico/edital/g-1/itens');
  console.log('asserts ok');
}

async function main() {
  asserts();
  const [nome, keyword = 'chatbot'] = process.argv.slice(2);
  if (!nome) return;
  const [fonte] = fontesAtivas([nome]);
  let n = 0;
  for await (const lic of fonte!.buscar(keyword, 1)) {
    if (n++ < 3) console.log(JSON.stringify({ ...lic, raw: undefined }, null, 2));
  }
  console.log(`${nome}: ${n} resultado(s) para "${keyword}" na 1ª página`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
