module.exports = {
  apps: [
    {
      name: 'alopop',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      max_restarts: 10,
      exp_backoff_restart_delay: 100,
      max_memory_restart: '512M',
      error_file: './logs/alopop-error.log',
      out_file: './logs/alopop-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3099
      }
    }
  ]
};
