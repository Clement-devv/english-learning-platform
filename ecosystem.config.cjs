// PM2 ecosystem config — https://pm2.keymetrics.io/docs/usage/application-declaration/
// Usage:
//   pm2 start ecosystem.config.cjs            (production)
//   pm2 start ecosystem.config.cjs --env dev  (development)

module.exports = {
  apps: [
    {
      name: "english-platform",
      script: "./server/index.js",
      cwd: "./server",

      // Graceful shutdown: PM2 sends SIGINT, waits kill_timeout, then SIGKILL
      kill_timeout: 20000,   // 20s — must be > your 15s hard-kill timer
      wait_ready: false,

      // Health check — PM2 uses this for zero-downtime reload
      // (requires pm2 >= 5 with HTTP health check support)
      // Alternatively just use: pm2 reload --wait-ready
      health_check_url: "http://localhost:5000/api/health/ready",
      health_check_grace_period: 5000, // wait 5s before first check

      // Restart policy
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,   // wait 2s between restarts (avoid crash loop)
      min_uptime: "10s",     // if it dies before 10s, count as a failed start

      // Env vars for production
      env_production: {
        NODE_ENV: "production",
      },
      env_development: {
        NODE_ENV: "development",
      },

      // Logs
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
