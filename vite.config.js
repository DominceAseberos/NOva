import fs from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function scrollStorySavePlugin() {
  return {
    name: "scroll-story-save",
    configureServer(server) {
      server.middlewares.use("/__scroll-story/save", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });

        req.on("end", async () => {
          try {
            const payload = JSON.parse(body || "{}");
            const relativePath = String(payload.path || "");
            const root = process.cwd();
            const target = path.resolve(root, relativePath);
            const allowedRoot = path.resolve(root, "src", "story");

            if (!target.startsWith(allowedRoot + path.sep)) {
              throw new Error("Story save path is outside src/story");
            }

            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(
              target,
              JSON.stringify(payload.story, null, 2) + "\n",
              "utf8"
            );

            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: true, path: relativePath }));
          } catch (error) {
            res.statusCode = 400;
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                ok: false,
                error: error instanceof Error ? error.message : String(error),
              })
            );
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), scrollStorySavePlugin()],
  server: {
    host: "0.0.0.0",
  },
  build: {
    // The only large chunk is the intentionally lazy Three.js product engine.
    chunkSizeWarningLimit: 700,
  },
});
