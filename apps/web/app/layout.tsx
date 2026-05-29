import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Licitações AI',
  description: 'Timeline de licitações públicas com priorização por IA',
};

// Filtros vivem na URL (nuqs/useSearchParams) e o conteúdo depende da API
// rodando, então não vale a pena prerender.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
