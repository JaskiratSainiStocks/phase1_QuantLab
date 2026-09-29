import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import http from 'http';
import net from 'net';
import {defineConfig} from 'vite';

function streamlitProxy() {
  return {
    name: 'streamlit-proxy',
    configureServer(server: any) {
      const TARGET_HOST = 'localhost';
      const TARGET_PORT = 8501;

      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url?.startsWith('/@vite') || req.url?.startsWith('/@fs') || req.url?.startsWith('/node_modules')) {
          return next();
        }
        const headers = { ...req.headers, host: `${TARGET_HOST}:${TARGET_PORT}` };
        const proxyReq = http.request({
          hostname: TARGET_HOST,
          port: TARGET_PORT,
          path: req.url,
          method: req.method,
          headers,
        }, (proxyRes: any) => {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          proxyRes.pipe(res);
        });
        proxyReq.on('error', () => {
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/html' });
            res.end('<html><body style="font-family:sans-serif;padding:40px"><h2>Waiting for Streamlit…</h2><p>The Streamlit server on port 8501 is starting. Please wait a moment and refresh.</p></body></html>');
          }
        });
        req.pipe(proxyReq);
      });

      server.httpServer?.on('upgrade', (req: any, socket: any, head: Buffer) => {
        const target = net.connect(TARGET_PORT, TARGET_HOST, () => {
          let rawReq = `${req.method} ${req.url} HTTP/1.1\r\n`;
          for (let i = 0; i < req.rawHeaders.length; i += 2) {
            const key = req.rawHeaders[i];
            const val = key.toLowerCase() === 'host' ? `${TARGET_HOST}:${TARGET_PORT}` : req.rawHeaders[i + 1];
            rawReq += `${key}: ${val}\r\n`;
          }
          rawReq += '\r\n';
          target.write(rawReq);
          if (head && head.length) target.write(head);
          target.pipe(socket);
          socket.pipe(target);
        });
        target.on('error', () => socket.destroy());
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [streamlitProxy(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
