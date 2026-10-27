import "dotenv/config";
import { loadConfig } from "../config/env.js";
import { createAppContainer } from "../bootstrap/container.js";
import { syncTerm } from "../bootstrap/sync-term.js";

const config = loadConfig();
const container = createAppContainer(config);

try {
  const result = await syncTerm(container, config.university.termCode);
  console.log(
    JSON.stringify(
      {
        synchronization: result.synchronization,
        termId: result.termId,
        occurrences: result.occurrences,
        warnings: result.snapshot.warnings,
        complete: result.snapshot.complete,
      },
      null,
      2,
    ),
  );
} finally {
  await container.close();
}
