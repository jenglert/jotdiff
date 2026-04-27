import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function run(command: string, args: string[], cwd: string): Promise<string> {
  const result = await execFileAsync(command, args, {
    cwd,
    encoding: "utf8",
  });

  return result.stdout;
}

export interface TempRepo {
  dir: string;
  write(relativePath: string, content: string | Buffer): Promise<void>;
  git(args: string[]): Promise<string>;
  cleanup(): Promise<void>;
}

export async function createTempRepo(): Promise<TempRepo> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jotdiff-test-"));
  await run("git", ["init"], dir);
  await run("git", ["config", "user.email", "test@example.com"], dir);
  await run("git", ["config", "user.name", "tester"], dir);

  return {
    dir,
    async write(relativePath: string, content: string | Buffer) {
      const absolutePath = path.join(dir, relativePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content);
    },
    async git(args: string[]) {
      return run("git", args, dir);
    },
    async cleanup() {
      await rm(dir, { force: true, recursive: true });
    },
  };
}
