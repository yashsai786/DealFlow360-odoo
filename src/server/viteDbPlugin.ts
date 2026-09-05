import type { Plugin } from "vite";
import type { IncomingMessage } from "node:http";
import { handleSignup, getUsers, updateProfile } from "./dbApi";

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

export function viteDbPlugin(): Plugin {
  return {
    name: "dealflow-sqlite-db-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];

        if (url === "/api/users/signup" && req.method === "POST") {
          try {
            const data = await readBody(req);
            const user = await handleSignup(data);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 201;
            res.end(JSON.stringify(user));
            return;
          } catch (err: any) {
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 400;
            res.end(JSON.stringify({ error: err?.message || "Failed to save in SQLite database" }));
            return;
          }
        }

        if (url === "/api/users" && req.method === "GET") {
          try {
            const users = await getUsers();
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify(users));
            return;
          } catch (err: any) {
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err?.message || "Failed to read SQLite database" }));
            return;
          }
        }

        if (url === "/api/users/profile" && req.method === "POST") {
          try {
            const data = await readBody(req);
            const user = await updateProfile(data);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify(user));
            return;
          } catch (err: any) {
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 400;
            res.end(JSON.stringify({ error: err?.message || "Failed to update profile in SQLite database" }));
            return;
          }
        }

        next();
      });
    },
  };
}
