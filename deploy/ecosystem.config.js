module.exports = {
  apps: [
    {
      name: 'jameslandreth',
      script: './dist/server/entry.mjs',
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: 4321,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '256M',
      watch: false,
    },
  ],
};
