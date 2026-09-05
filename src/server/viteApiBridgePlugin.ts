import type { Plugin, ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import fs from "node:fs";

interface RouteMatch {
  filePath: string;
  params: Record<string, string>;
}

function findMatchingRoute(pathname: string, appApiDir: string): RouteMatch | null {
  const cleanPath = pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
  const segments = cleanPath ? cleanPath.split("/") : [];

  // 1. Direct match: app/api/<segments>/route.ts
  const directPath = path.join(appApiDir, ...segments, "route.ts");
  if (fs.existsSync(directPath)) {
    return { filePath: directPath, params: {} };
  }

  // 2. Dynamic route match: e.g. /api/quotations/:id -> app/api/quotations/[id]/route.ts
  if (segments.length >= 2) {
    const parentSegments = segments.slice(0, -1);
    const lastParam = segments[segments.length - 1];

    const dynamicDir = path.join(appApiDir, ...parentSegments);
    if (fs.existsSync(dynamicDir)) {
      const entries = fs.readdirSync(dynamicDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith("[") && entry.name.endsWith("]")) {
          const paramName = entry.name.slice(1, -1);
          const candidatePath = path.join(dynamicDir, entry.name, "route.ts");
          if (fs.existsSync(candidatePath)) {
            return {
              filePath: candidatePath,
              params: { [paramName]: lastParam },
            };
          }
        }
      }
    }
  }

  return null;
}

export function viteApiBridgePlugin(): Plugin {
  return {
    name: "vite-next-api-bridge",
    configureServer(server: ViteDevServer) {
      const appApiDir = path.resolve(server.config.root, "app/api");

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const urlStr = req.url || "/";
        const pathname = urlStr.split("?")[0];

        if (!pathname.startsWith("/api")) {
          return next();
        }

        const match = findMatchingRoute(pathname, appApiDir);
        if (!match) {
          return next();
        }

        try {
          // Construct Web API standard Request
          const protocol = (req.headers["x-forwarded-proto"] as string) || "http";
          const host = req.headers.host || "localhost:5173";
          const fullUrl = new URL(urlStr, `${protocol}://${host}`);
          const method = req.method?.toUpperCase() || "GET";

          let bodyStr: string | undefined;
          if (method !== "GET" && method !== "HEAD") {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
            }
            if (chunks.length > 0) {
              bodyStr = Buffer.concat(chunks).toString("utf-8");
            }
          }

          const headers = new Headers();
          for (const [key, val] of Object.entries(req.headers)) {
            if (val !== undefined) {
              if (Array.isArray(val)) {
                val.forEach((v) => headers.append(key, v));
              } else {
                headers.set(key, val);
              }
            }
          }

          const webRequest = new Request(fullUrl.toString(), {
            method,
            headers,
            body: bodyStr,
            // @ts-ignore
            duplex: "half",
          });

          // Dynamically execute route handler via Vite SSR
          const routeModule = await server.ssrLoadModule(match.filePath);
          const handler = routeModule[method];

          if (typeof handler !== "function") {
            res.statusCode = 405;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: `Method ${method} Not Allowed` }));
            return;
          }

          const response: Response = await handler(webRequest, { params: match.params });

          res.statusCode = response.status;
          response.headers.forEach((val, key) => {
            res.setHeader(key, val);
          });

          const arrayBuffer = await response.arrayBuffer();
          res.end(Buffer.from(arrayBuffer));
        } catch (err: any) {
          console.error(`[API Bridge Error] ${req.method} ${pathname}:`, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: err?.message || "Internal Server Error in API Route" }));
          }
        }
      });
    },
  };
}
