import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBRL(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

export function truncate(s: string | null | undefined, n: number): string {
  if (!s) return '';
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';
}

// Preâmbulos burocráticos que abrem o objeto e não dizem o que se compra.
const PREAMBULOS = [
  /^\[[^\]]+\]\s*-?\s*/, // "[Portal de Compras Públicas] - "
  /^trata-se\s+d[aoe]\s+/i,
  /^(o\s+)?objeto\s+d[ao]\s+present\S*\s+\S+(\s+\S+)?\s+(é|consiste\s+(em|n[ao]))\s+/i,
  /^(a|o)\s+present\S*\s+\S+\s+tem\s+(como|por)\s+objeto\s+/i,
  // "Constitui objeto do presente Pregão Eletrônico a aquisição…" (corta até o artigo)
  /^constitui\s+objeto\s+d[ao]\s+present\S*\s+(\S+\s+){0,2}?(a|o)\s+/i,
  /^constitui\s+objeto\s+d[ao]\s+present\S*\s+\S+\s*/i,
  /^objeto\s*[:\-]\s*/i,
  // Exige conector: "Contratação de empresa do ramo de…" fica como está.
  /^(a\s+)?contrata[çc][ãa]o\s+de\s+(empresa|pessoa\s+jur[íi]dica)(\s+especializada)?\s+(em|para|na|no|nos|nas|visando(\s+[àa])?)\s+/i,
  /^(a\s+|o\s+)?(constitui[çc][ãa]o\s+de\s+(sistema\s+de\s+)?|inten[çc][ãa]o\s+de\s+)?registro\s+de\s+pre[çc]os?\s+(para|visando)(\s+(a|o|à))?(\s+(futura,?\s+e\s+eventual|eventual\s+e\s+futura|eventual|futura))?\s+/i,
  /^(a\s+|o\s+)/i,
];

/**
 * Objeto sem o preâmbulo ("Contratação de empresa especializada para…",
 * "Registro de preços para futura e eventual…") e sem CAIXA ALTA, pra ler
 * o que a licitação quer direto na listagem.
 * ponytail: heurística por regex; resumo de verdade = campo gerado pelo Gemini na classificação.
 */
export function resumoObjeto(objeto: string | null, titulo: string | null): string {
  let s = (objeto ?? titulo ?? '').replace(/\s+/g, ' ').trim();
  for (let mudou = true; mudou; ) {
    mudou = false;
    for (const re of PREAMBULOS) {
      const novo = s.replace(re, '');
      if (novo !== s && novo.length > 10) {
        s = novo;
        mudou = true;
      }
    }
  }
  const letras = s.replace(/[^a-zà-ú]/gi, '');
  const maiusculas = s.replace(/[^A-ZÀ-Ú]/g, '');
  if (letras.length && maiusculas.length / letras.length > 0.6) s = s.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
