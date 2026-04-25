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

      // Cluster mode — one worker per CPU core.
      // Schedulers and DB sweep jobs run only on instance 0 (see server/index.js).
      // Socket.IO requires the Redis adapter when running in cluster mode (see socketServer.js).
      instances: "max",
      exec_mode: "cluster",
      instance_var: "NODE_APP_INSTANCE", // exposed as process.env.NODE_APP_INSTANCE

      // Graceful shutdown: PM2 sends SIGINT, waits kill_timeout, then SIGKILL
      kill_timeout: 20000,   // 20s — must be > your 15s hard-kill timer
      wait_ready: false,

      // Health check — PM2 uses this for zero-downtime reload
      health_check_url: "http://localhost:5000/api/health/ready",
      health_check_grace_period: 5000,

      // Restart policy
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      min_uptime: "10s",

      // Env vars for production
      env_production: {
        NODE_ENV: "production",
      },
      env_development: {
        NODE_ENV: "development",
        instances: 1, // single instance in dev to keep logs readable
      },

      // Logs — merge_logs combines all instance logs into one file
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
