import { getEmpresaPerfil } from '../db/repositories/empresa-perfil.js';

let cached: string | null = null;

/**
 * Lê o perfil do banco com cache em memória. Invalidar via {@link resetEmpresaPerfilCache}
 * após PATCH para que a próxima execução veja o conteúdo novo.
 */
export async function loadEmpresaPerfil(): Promise<string> {
  if (cached !== null) return cached;
  const row = await getEmpresaPerfil();
  cached = row?.conteudo ?? '';
  return cached;
}

export function resetEmpresaPerfilCache(): void {
  cached = null;
}
