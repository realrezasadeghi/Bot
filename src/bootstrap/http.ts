import "dotenv/config";
import { loadConfig } from "../config/env.js";
import { createAppContainer } from "./container.js";
import { createHttpApp } from "./http-app.js";

const config = loadConfig();
const container = createAppContainer(config);
const app = createHttpApp(container);

const server = app.listen(config.http.port, () => {
  container.logger.info(
    {
      port: config.http.port,
      environment: config.nodeEnv,
      platforms: [...container.configuredPlatforms],
    },
    "HTTP server started",
  );
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  container.logger.info({ signal }, "Shutting down HTTP server");

  const forceTimer = setTimeout(() => {
    container.logger.error({}, "Forced shutdown after timeout");
    server.closeAllConnections();
    process.exit(1);
  }, 10_000);
  forceTimer.unref();

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await container.close();
  clearTimeout(forceTimer);
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
