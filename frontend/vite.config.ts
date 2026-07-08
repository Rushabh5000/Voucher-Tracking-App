import { defineConfig, loadEnv, type Plugin, type ViteDevServer, type PreviewServer } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs/promises";
import type { IncomingMessage, ServerResponse } from "http";

const CARD_VAULT_ROUTE = "/__card-vault-file";

// Local-dev-only bridge for Card Vault: when CARD_VAULT_PATH is set (in
// frontend/.env.local, gitignored — never commit a real path), the browser
// can auto-load/auto-save that one fixed file via this endpoint. Node can
// read the filesystem; the browser sandbox can't, hence this exists only on
// the dev/preview server process and never in the static production build
// Vercel serves — the deployed site always falls back to the manual
// Open/Add screen.
function cardVaultFilePlugin(vaultPath: string | undefined): Plugin {
  async function handler(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (req.url !== CARD_VAULT_ROUTE) { next(); return; }
    if (!vaultPath) { res.statusCode = 404; res.end(); return; }

    if (req.method === "GET") {
      try {
        const buf = await fs.readFile(vaultPath);
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("X-Card-Vault-Filename", encodeURIComponent(path.basename(vaultPath)));
        res.end(buf);
      } catch {
        res.statusCode = 404;
        res.end();
      }
      return;
    }

    if (req.method === "PUT") {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        await fs.writeFile(vaultPath, Buffer.concat(chunks));
        res.statusCode = 204;
        res.end();
      } catch {
        res.statusCode = 500;
        res.end();
      }
      return;
    }

    next();
  }

  return {
    name: "card-vault-local-file",
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => { void handler(req, res, next); });
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use((req, res, next) => { void handler(req, res, next); });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), cardVaultFilePlugin(env.CARD_VAULT_PATH)],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": { target: "http://localhost:3001", changeOrigin: true },
      },
    },
  };
});
