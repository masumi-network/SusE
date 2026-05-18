import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import { startSokosumiTaskWorker } from "./sokosumi/taskWorker.js";
import { createConversationStore } from "./storage/index.js";

const config = loadConfig();
const store = await createConversationStore(config);
const app = createApp({ config, store });
const taskWorker = startSokosumiTaskWorker({ config, taskRunStore: store });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    taskWorker?.stop();
    await app.close();
    await store.close();
    process.exit(0);
  });
}

await app.listen({
  port: config.port,
  host: "0.0.0.0"
});
