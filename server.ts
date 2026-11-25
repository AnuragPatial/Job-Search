import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchLinkedInJobDetail } from './src/server/portals/linkedinJobSpy';
import {
  PORTAL_DEFINITIONS,
  runMultiPortalScrape,
  startAutoRefreshScheduler,
} from './src/server/portals/scraperOrchestrator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  startAutoRefreshScheduler();

  app.use(express.json());

  // Health & portal metadata endpoint
  app.get('/api/portals', (_req, res) => {
    res.json({ portals: PORTAL_DEFINITIONS });
  });

  // Main live multi-portal scrape endpoint
  app.get('/api/jobs', async (req, res) => {
    try {
      const location =
        typeof req.query.location === 'string' ? req.query.location : '';
      const remoteOnly = req.query.remoteOnly === 'true';
      const refresh = req.query.refresh === 'true';

      const data = await runMultiPortalScrape({
        location,
        remoteOnly,
        refresh,
      });
      res.json(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch job listings';
      res.status(500).json({ error: message });
    }
  });

  // On-demand full description fetcher for LinkedIn (JobSpy guest jobPosting API)
  app.get('/api/jobs/linkedin-detail/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const titleHint =
        typeof req.query.title === 'string' ? req.query.title : '';
      const detail = await fetchLinkedInJobDetail(id, titleHint);
      res.json(detail);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load LinkedIn job description';
      res.status(502).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EntryStack server running on http://localhost:${PORT}`);
  });
}

startServer();
