import { loadEmpresaPerfil } from '../../lib/empresa-perfil.js';

export const PROMPT_VERSION = 'classifier.v1';

/**
 * Prompt usa o perfil da empresa (DB-backed). Carregado uma vez no início da
 * execução pelo orchestrator e passado adiante para evitar IO por classificação.
 */

export interface PromptInput {
  titulo: string | null;
  orgao: string | null;
  uf: string | null;
  objeto: string | null;
  valor_estimado: number | null;
  modalidade: string | null;
}

const formatBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
});

export async function buildClassifierPrompt(input: PromptInput): Promise<string> {
  const perfil = await loadEmpresaPerfil();
  const valor = input.valor_estimado != null ? formatBRL.format(input.valor_estimado) : 'não informado';

  return [
    'Você é um analista de oportunidades comerciais para uma empresa de software brasileira.',
    'Avalie a licitação abaixo e classifique o fit com o perfil da empresa.',
    '',
    'PERFIL DA EMPRESA:',
    perfil,
    '',
    'LICITAÇÃO:',
    `Título: ${input.titulo ?? 'não informado'}`,
    `Órgão: ${input.orgao ?? 'não informado'}${input.uf ? ` (${input.uf})` : ''}`,
    `Objeto: ${input.objeto ?? 'não informado'}`,
    `Valor estimado: ${valor}`,
    `Modalidade: ${input.modalidade ?? 'não informada'}`,
    '',
    'Responda APENAS em JSON válido, sem markdown, sem cercas de código, no formato exato:',
    '{',
    '  "score": <inteiro de 0 a 100, sendo 0 nada a ver e 100 fit perfeito>,',
    '  "categoria": "core" | "adjacente" | "fora",',
    '  "justificativa": "<1-2 frases explicando a nota>",',
    '  "pontos_fortes": ["<no máximo 3 pontos>"],',
    '  "red_flags": ["<no máximo 3 pontos>"]',
    '}',
  ].join('\n');
}

export function buildCorrectionPrompt(originalPrompt: string, badOutput: string, errorMsg: string): string {
  return [
    originalPrompt,
    '',
    '---',
    'Sua resposta anterior foi inválida. Isto foi retornado:',
    badOutput.slice(0, 1000),
    '',
    'Erro de validação:',
    errorMsg,
    '',
    'Responda novamente APENAS com o JSON puro, sem markdown, sem texto antes ou depois, exatamente no schema descrito acima.',
  ].join('\n');
}
