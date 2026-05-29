import { sql } from '../client.js';

export interface Keyword {
  id: string;
  termo: string;
  ativo: boolean;
  peso: number;
  created_at: Date;
}

export interface KeywordPatch {
  termo?: string;
  ativo?: boolean;
  peso?: number;
}

export async function listAllKeywords(): Promise<Keyword[]> {
  const rows = await sql<Keyword[]>`
    SELECT id, termo, ativo, peso, created_at
    FROM keywords
    ORDER BY ativo DESC, peso DESC, termo ASC
  `;
  return [...rows];
}

export async function listActiveKeywords(): Promise<Keyword[]> {
  const rows = await sql<Keyword[]>`
    SELECT id, termo, ativo, peso, created_at
    FROM keywords
    WHERE ativo = true
    ORDER BY peso DESC, termo ASC
  `;
  return [...rows];
}

export async function getKeywordById(id: string): Promise<Keyword | null> {
  const rows = await sql<Keyword[]>`
    SELECT id, termo, ativo, peso, created_at
    FROM keywords
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function createKeyword(input: {
  termo: string;
  peso?: number;
  ativo?: boolean;
}): Promise<Keyword> {
  const peso = input.peso ?? 1.0;
  const ativo = input.ativo ?? true;
  const rows = await sql<Keyword[]>`
    INSERT INTO keywords (termo, peso, ativo)
    VALUES (${input.termo}, ${peso}, ${ativo})
    RETURNING id, termo, ativo, peso, created_at
  `;
  const row = rows[0];
  if (!row) throw new Error('createKeyword returned no rows');
  return row;
}

export async function updateKeyword(id: string, patch: KeywordPatch): Promise<Keyword | null> {
  // Constrói SET dinâmico só com os campos presentes — postgres.js não suporta
  // SET nativo com objeto parcial em todos os modos, então fazemos manualmente.
  const fragments = [];
  if (patch.termo !== undefined) fragments.push(sql`termo = ${patch.termo}`);
  if (patch.ativo !== undefined) fragments.push(sql`ativo = ${patch.ativo}`);
  if (patch.peso !== undefined) fragments.push(sql`peso = ${patch.peso}`);
  if (fragments.length === 0) return getKeywordById(id);

  // Junta os fragments com vírgula manualmente.
  let setExpr = fragments[0]!;
  for (let i = 1; i < fragments.length; i++) {
    setExpr = sql`${setExpr}, ${fragments[i]!}`;
  }

  const rows = await sql<Keyword[]>`
    UPDATE keywords SET ${setExpr}
    WHERE id = ${id}
    RETURNING id, termo, ativo, peso, created_at
  `;
  return rows[0] ?? null;
}

export async function deleteKeyword(id: string): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    DELETE FROM keywords WHERE id = ${id} RETURNING id
  `;
  return rows.length > 0;
}

export async function upsertKeyword(termo: string, peso: number): Promise<void> {
  await sql`
    INSERT INTO keywords (termo, peso)
    VALUES (${termo}, ${peso})
    ON CONFLICT (termo) DO UPDATE SET peso = EXCLUDED.peso
  `;
}
