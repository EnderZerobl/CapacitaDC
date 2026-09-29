const backendUrl = (process.env.API_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allows tests to run alongside a developer's server without sharing its cache.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // A verificação de tipos roda no build de propósito: `tsc --noEmit` passa limpo,
  // então ignorar erros aqui só esconderia regressões antes de publicar.
  //
  // O Next 16 bloqueia recursos de desenvolvimento vindos de outra origem. Os
  // scripts de teste e a documentação usam 127.0.0.1, que o servidor trata como
  // origem diferente de localhost; liberar aqui vale só em desenvolvimento.
  allowedDevOrigins: ['127.0.0.1'],
  // Não gerar AGENTS.md e CLAUDE.md dentro do repositório a cada build.
  agentRules: false,
  // Allow a 20 MB material upload plus multipart headers through the local API
  // proxy. On Vercel, /api goes straight to the function, which accepts 4.5 MB.
  experimental: { proxyClientMaxBodySize: '25mb' },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
