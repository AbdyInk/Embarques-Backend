module.exports = {
  apps: [{
    name: 'culligan-backend',
    script: 'server.js',
    cwd: '/home/culligan/app',
    user: 'culligan',
    instances: 2, // o 'max' para usar todos los cores disponibles
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    max_memory_restart: '1G',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    watch: false,
    ignore_watch: [
      'node_modules',
      'logs',
      'data',
      '.git'
    ],
    autorestart: true,
    time: true,
    source_map_support: true,
    merge_logs: true
  }]
};