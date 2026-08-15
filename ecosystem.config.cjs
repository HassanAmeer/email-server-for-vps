module.exports = {
  apps: [
    {
      name: 'mail-backend',
      script: 'backend/receive-mail/receive-mail.js',
      interpreter: '/root/.bun/bin/bun',
      env: {
        live: 'true',
        LIVE: 'true',
        SMTP_PORT: 25,
        HTTP_PORT: 8081
      }
    },
    {
      name: 'mail-frontend',
      script: 'frontend-server.js',
      interpreter: '/root/.bun/bin/bun',
      env: {
        NODE_ENV: 'production',
        PORT: 80
      }
    }
  ]
};
