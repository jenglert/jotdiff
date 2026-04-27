import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createTempRepo } from "../../../tests/helpers/temp-repo";
import { createSession } from "../src/index";

test("createSession returns non-repo outside git", async () => {
  const repo = await createTempRepo();

  try {
    const outside = path.join(repo.dir, "..", `${path.basename(repo.dir)}-outside`);
    await mkdir(outside, { recursive: true });

    const session = await createSession({
      cwd: outside,
      viewMode: "unified",
      filters: { staged: true, unstaged: true, untracked: true },
    });

    assert.equal(session.kind, "non-repo");
  } finally {
    await repo.cleanup();
  }
});

test("createSession summarizes visible working tree files", async () => {
  const repo = await createTempRepo();

  try {
    await repo.write("tracked.txt", "alpha\n");
    await repo.git(["add", "tracked.txt"]);
    await repo.git(["commit", "-m", "init"]);

    await repo.write("tracked.txt", "alpha\nbeta\n");
    await repo.write("new.txt", "new file\n");

    const session = await createSession({
      cwd: repo.dir,
      viewMode: "unified",
      filters: { staged: true, unstaged: true, untracked: true },
    });

    assert.equal(session.kind, "repo");
    assert.equal(session.summary.totalFiles, 2);
    assert.equal(session.summary.untrackedFiles, 1);
    assert.ok(session.summary.additions >= 2);
  } finally {
    await repo.cleanup();
  }
});
