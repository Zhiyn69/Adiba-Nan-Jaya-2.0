import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';

function vercelApiPlugin(): Plugin {
  return {
    name: 'vercel-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        
        try {
          const parsedUrl = new URL(req.url, 'http://localhost');
          const route = parsedUrl.pathname;
          let filePath = path.join(process.cwd(), route + '.ts');
          
          if (!fs.existsSync(filePath)) {
            // maybe index file
            filePath = path.join(process.cwd(), route, 'index.ts');
            if (!fs.existsSync(filePath)) return next();
          }
          
          // read body if POST/PUT/PATCH
          if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
            await new Promise<void>((resolve, reject) => {
               let body = '';
               req.on('data', chunk => body += chunk);
               req.on('end', () => {
                 try {
                   (req as any).body = body ? JSON.parse(body) : {};
                   resolve();
                 } catch (e) {
                   (req as any).body = body;
                   resolve();
                 }
               });
               req.on('error', reject);
            });
          }

          const module = await server.ssrLoadModule(filePath);
          if (module.default) {
            // add query params from URL
            (req as any).query = Object.fromEntries(parsedUrl.searchParams.entries());
            
            // basic json response helper for Vercel emulation
            (res as any).status = function(code: number) {
              this.statusCode = code;
              return this;
            };
            (res as any).json = function(obj: any) {
              this.setHeader('Content-Type', 'application/json');
              this.end(JSON.stringify(obj));
            };
            
            await module.default(req, res);
            return;
          }
          next();
        } catch(e) {
          console.error('API Error:', e);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({error: 'Internal Server Error'}));
        }
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), vercelApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
