import { sql } from '../client.js';

export interface EmpresaPerfilRow {
  conteudo: string;
  updated_at: Date;
}

export async function getEmpresaPerfil(): Promise<EmpresaPerfilRow | null> {
  const rows = await sql<EmpresaPerfilRow[]>`
    SELECT conteudo, updated_at FROM empresa_perfil WHERE id = 1 LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function upsertEmpresaPerfil(conteudo: string): Promise<EmpresaPerfilRow> {
  const rows = await sql<EmpresaPerfilRow[]>`
    INSERT INTO empresa_perfil (id, conteudo, updated_at)
    VALUES (1, ${conteudo}, now())
    ON CONFLICT (id) DO UPDATE
      SET conteudo = EXCLUDED.conteudo, updated_at = now()
    RETURNING conteudo, updated_at
  `;
  return rows[0]!;
}
