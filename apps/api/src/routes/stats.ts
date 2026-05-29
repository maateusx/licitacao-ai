import type { FastifyInstance } from 'fastify';
import { getStats } from '../db/repositories/stats.js';

export async function statsRoutes(app: FastifyInstance) {
  app.get('/api/stats', async () => {
    return getStats();
  });
}
