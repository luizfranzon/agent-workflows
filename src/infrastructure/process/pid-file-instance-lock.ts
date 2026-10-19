import { link, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export class InstanceAlreadyRunningError extends Error {
  constructor(holderPid: number) {
    super(`agent-workflows já está rodando (pid ${holderPid}).`);
  }
}

export type InstanceLock = {
  release: () => Promise<void>;
};

export async function acquireInstanceLock(dataDirectory: string): Promise<InstanceLock> {
  const lockPath = join(dataDirectory, "daemon.lock");

  const candidatePath = `${lockPath}.${process.pid}.${crypto.randomUUID()}`;
  await writeFile(candidatePath, String(process.pid));

  try {
    await link(candidatePath, lockPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const holderPid = Number(await readFile(lockPath, "utf8"));
    if (isProcessAlive(holderPid)) throw new InstanceAlreadyRunningError(holderPid);
    await rm(lockPath, { force: true });
    return acquireInstanceLock(dataDirectory);
  } finally {
    await rm(candidatePath, { force: true });
  }

  return { release: () => rm(lockPath, { force: true }) };
}

function isProcessAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
