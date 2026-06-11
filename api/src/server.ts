import { buildApp } from './app';
import { env } from './config/env';

async function main(): Promise<void> {
  const app = await buildApp();

  const closeGracefully = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, 'received shutdown signal, closing server');
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    void closeGracefully('SIGINT');
  });
  process.on('SIGTERM', () => {
    void closeGracefully('SIGTERM');
  });

  try {
    await app.listen({ host: '0.0.0.0', port: env.API_PORT });
  } catch (err) {
    app.log.error({ err }, 'failed to start server');
    process.exit(1);
  }
}

main().catch((err) => {
  // Last-resort handler if buildApp() itself throws (e.g. bad env).
  // eslint-disable-next-line no-console
  console.error('fatal: unable to bootstrap api', err);
  process.exit(1);
});
