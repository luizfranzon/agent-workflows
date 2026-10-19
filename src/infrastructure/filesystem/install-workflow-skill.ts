import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BUNDLED_SKILL = join(import.meta.dir, "..", "..", "..", "skill", "SKILL.md");
const MANAGED_MARKER = "gerenciado por agent-workflows";
const FIRST_RELEASE_DESCRIPTION = "description: Executa um Workflow de Etapas com subagents sobre uma tarefa.\ndisable-model-invocation: true";

export type SkillInstallation = "instalada" | "atualizada" | "mantida";

export async function installWorkflowSkill(claudeDirectory: string): Promise<SkillInstallation> {
  const skillDirectory = join(claudeDirectory, "skills", "workflow");
  const installedPath = join(skillDirectory, "SKILL.md");
  const bundled = await readFile(BUNDLED_SKILL, "utf8");
  const installed = await readFile(installedPath, "utf8").catch(() => null);

  if (installed === null) {
    await mkdir(skillDirectory, { recursive: true });
    await writeFile(installedPath, bundled);
    return "instalada";
  }
  const isManagedByApp = installed.includes(MANAGED_MARKER) || installed.includes(FIRST_RELEASE_DESCRIPTION);
  if (!isManagedByApp || installed === bundled) return "mantida";
  await writeFile(installedPath, bundled);
  return "atualizada";
}
