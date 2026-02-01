module.exports = {
  apps: [
    {
      name: 'legal-ai-platform',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=legal-ai-production --local --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
}
