import { createServer } from 'node:http';
import { config } from './config';

/**
 * Tiny liveness probe on a separate port from the Restate SDK server. Uses the
 * Node built-in `http` module deliberately — the agent service stays free of
 * Express/Fastify (an HTTP framework here would clash with the Restate endpoint
 * and bloat the image for a one-route health check).
 */
export function startHealthServer(): void {
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }
    res.writeHead(404).end();
  });

  server.listen(config.healthPort, () => {
    console.log(`Agent health probe listening on :${config.healthPort}`);
  });
}
