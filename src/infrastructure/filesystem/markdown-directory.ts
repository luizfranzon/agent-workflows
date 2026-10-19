import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isSafeName } from "../../domain/agent";

const MARKDOWN_EXTENSION = ".md";

export class MarkdownDirectory {
  constructor(private readonly directory: string) {}

  async names() {
    await mkdir(this.directory, { recursive: true });
    return (await readdir(this.directory))
      .filter((fileName) => fileName.endsWith(MARKDOWN_EXTENSION))
      .map((fileName) => fileName.slice(0, -MARKDOWN_EXTENSION.length))
      .filter(isSafeName)
      .sort();
  }

  async read(name: string) {
    if (!isSafeName(name)) return null;
    return readFile(this.pathOf(name), "utf8").catch(() => null);
  }

  async write(name: string, document: string) {
    await mkdir(this.directory, { recursive: true });
    await writeFile(this.pathOf(name), document);
  }

  async delete(name: string) {
    if (isSafeName(name)) await rm(this.pathOf(name), { force: true });
  }

  private pathOf(name: string) {
    return join(this.directory, `${name}${MARKDOWN_EXTENSION}`);
  }
}
