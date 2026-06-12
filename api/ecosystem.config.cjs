/**
 * pm2 process definitions.
 *
 * El API y el worker se ejecutan directamente desde los fuentes TypeScript
 * usando bun como intérprete (sin compilar a dist/).
 *
 * dev  (NODE_ENV !== 'production'): pm2 vigila src/ y reinicia al detectar cambios.
 * prod (NODE_ENV === 'production'): sin watch.
 *
 * Uso desde docker-compose:
 *   bunx pm2-runtime start ecosystem.config.cjs --only api
 *   bunx pm2-runtime start ecosystem.config.cjs --only worker
 */

const isDev = process.env.NODE_ENV !== 'production';

const common = {
  interpreter: 'bun',
  exec_mode: 'fork',      // cluster mode no es fiable bajo bun
  instances: 1,
  watch: isDev ? ['src'] : false,
  ignore_watch: ['node_modules', '*.log', 'tests'],
  watch_delay: 500,
  kill_timeout: 10000,    // tiempo para los handlers SIGTERM (cierre DB/Redis)
  env: { NODE_ENV: process.env.NODE_ENV || 'development' },
};

module.exports = {
  apps: [
    { name: 'api',    script: 'src/server.ts', ...common },
    { name: 'worker', script: 'src/worker.ts', ...common },
  ],
};
