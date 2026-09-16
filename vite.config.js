import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Development plugin to simulate Vercel serverless functions in local Vite dev server
function apiDevServerPlugin() {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlObj = new URL(req.url, 'http://localhost');
        const pathname = urlObj.pathname;

        if (pathname === '/api/upload' && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk) => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              req.body = bodyStr ? JSON.parse(bodyStr) : {};
              res.status = (code) => { res.statusCode = code; return res; };
              res.json = (data) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return res;
              };
              const { default: handler } = await server.ssrLoadModule('/api/upload.js');
              await handler(req, res);
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (pathname === '/api/asset' && req.method === 'GET') {
          req.query = Object.fromEntries(urlObj.searchParams);
          res.status = (code) => { res.statusCode = code; return res; };
          res.json = (data) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return res;
          };
          res.send = (data) => {
            res.end(data);
            return res;
          };
          try {
            const { default: handler } = await server.ssrLoadModule('/api/asset.js');
            await handler(req, res);
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables into process.env for serverless dev handlers
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [react(), apiDevServerPlugin()],
    server: {
      headers: {
        'Cache-Control': 'no-store',
      },
      hmr: {
        protocol: 'ws',
        host: 'localhost',
      },
    },
  };
});
