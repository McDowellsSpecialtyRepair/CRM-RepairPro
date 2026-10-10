import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "node:http";
import { applyHttpSecurity, listenHost } from "./http-security";

const app = express();
app.set("case sensitive routing", true);
applyHttpSecurity(app, process.env.NODE_ENV === "production");
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const constraint = String(err.code || "").startsWith("SQLITE_CONSTRAINT");
    const status = err.status || err.statusCode || (constraint ? 409 : 500);
    const message = constraint
      ? (err.code === "SQLITE_CONSTRAINT_FOREIGNKEY"
        ? "This change would break a linked record or assign it to the wrong customer. Nothing was saved."
        : err.message)
      : err.message || "Internal Server Error";

    if (status >= 500) console.error("Request failed:", err.message);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Serves both the API and the client. Listens on loopback unless HOST is set
  // (see server/http-security.ts); put a TLS reverse proxy in front for remote access.
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = listenHost();
  httpServer.listen(
    {
      port,
      host,
      reusePort: true,
    },
    () => {
      log(`serving on ${host}:${port}`);
    },
  );
})();
