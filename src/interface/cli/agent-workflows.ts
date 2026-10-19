#!/usr/bin/env bun
import { homedir } from "node:os";
import { join } from "node:path";
import { startDaemon } from "../../composition-root";
import { InstanceAlreadyRunningError } from "../../infrastructure/process/pid-file-instance-lock";

const DEFAULT_PORT = 7318;
const USAGE = "Uso: agent-workflows start";

const [command] = process.argv.slice(2);

if (command !== "start") {
  console.error(USAGE);
  process.exit(1);
}

try {
  const claudeDirectory = process.env.AGENT_WORKFLOWS_CLAUDE_DIR ?? join(homedir(), ".claude");
  const daemon = await startDaemon({
    dataDirectory: process.env.AGENT_WORKFLOWS_HOME ?? join(homedir(), ".agent-workflows"),
    claudeDirectory,
    uiDirectory: join(import.meta.dir, "..", "..", "..", "ui", "dist"),
    preferredPort: Number(process.env.AGENT_WORKFLOWS_PORT ?? DEFAULT_PORT),
  });

  if (daemon.skillInstallation !== "mantida") {
    console.log(`Skill /workflow ${daemon.skillInstallation} em ${join(claudeDirectory, "skills", "workflow")}. Reinicie as sessões do Claude Code abertas.`);
  }
  console.log(`agent-workflows rodando sobre ${claudeDirectory}. Abra: ${daemon.launchLink}`);

  const stopAndExit = async () => {
    await daemon.stop();
    process.exit(0);
  };
  process.on("SIGINT", stopAndExit);
  process.on("SIGTERM", stopAndExit);
} catch (error) {
  if (!(error instanceof InstanceAlreadyRunningError)) throw error;
  console.error(error.message);
  process.exit(1);
}
