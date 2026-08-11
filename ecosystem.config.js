const path = require('path');

module.exports = {
  apps: [
    {
      name: 'wireguard-backend',
      script: 'src/app.js',
      cwd: path.join(__dirname, 'backend'),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
    },
    {
      name: 'wireguard-frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: path.join(__dirname, 'frontend'),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};
