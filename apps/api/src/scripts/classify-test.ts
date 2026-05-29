import { logger } from '../lib/logger.js';
import { GeminiClassifier } from '../pipeline/gemini-classifier.js';

/**
 * Testa o classificador Gemini com um payload sintético — sem tocar o banco
 * nem o PNCP. Útil para validar GEMINI_API_KEY, prompt e parsing.
 *
 * Uso:
 *   pnpm classify:test
 *   pnpm classify:test "Contratação de chatbot para SAC" 250000
 */
async function main() {
  const titulo = process.argv[2] ?? 'Contratação de chatbot com IA para atendimento ao cidadão';
  const valorArg = process.argv[3];
  const valor_estimado = valorArg ? Number(valorArg) : 250000;

  const classifier = new GeminiClassifier();
  const result = await classifier.classify({
    titulo,
    orgao: 'Prefeitura Municipal de Exemplo',
    uf: 'MG',
    objeto:
      'Contratação de empresa especializada para fornecimento de plataforma de chatbot ' +
      'com inteligência artificial para atendimento ao cidadão via WhatsApp e site oficial, ' +
      'com integração ao sistema de protocolo da prefeitura.',
    valor_estimado,
    modalidade: 'Pregão Eletrônico',
  });

  logger.info({ result }, 'classification result');
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.message : err }, 'classify-test failed');
  process.exit(1);
});
