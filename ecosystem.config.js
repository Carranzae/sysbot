module.exports = {
  apps: [
    {
      name: 'syst-backend',
      script: 'npm',
      args: 'run start:prod',
      cwd: './apps/backend',
      env_production: {
        NODE_ENV: 'production',
      },
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
    {
      name: 'syst-whatsapp-worker',
      script: 'node',
      script: 'npm',
      args: 'run start:prod', // Assuming a worker script if separate
      cwd: './apps/backend',
      env_production: {
        NODE_ENV: 'production',
      },
      autorestart: true,
      max_memory_restart: '800M',
    },
  ],
};
