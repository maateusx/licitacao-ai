/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Tabela virou a home; mantém links antigos funcionando (query string é preservada).
  redirects: async () => [{ source: '/tabela', destination: '/', permanent: false }],
};

export default nextConfig;
