import { config } from '../../config.js';
import type { Fonte } from './comum.js';
import { gobuyer } from './gobuyer.js';
import { paradigma } from './paradigma.js';
import { petronect } from './petronect.js';
import { pncp } from './pncp.js';
import { queridoDiario } from './querido-diario.js';

export const TODAS_FONTES: Fonte[] = [pncp, queridoDiario, petronect, paradigma, gobuyer];

/** Fontes ligadas via env FONTES (lista separada por vírgula) ou override explícito. */
export function fontesAtivas(override?: string[]): Fonte[] {
  const nomes = override ?? config.FONTES;
  const desconhecidas = nomes.filter((n) => !TODAS_FONTES.some((f) => f.nome === n));
  if (desconhecidas.length) throw new Error(`fonte(s) desconhecida(s): ${desconhecidas.join(', ')}`);
  return TODAS_FONTES.filter((f) => nomes.includes(f.nome));
}
