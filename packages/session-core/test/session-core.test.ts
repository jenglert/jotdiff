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

test("createSession applies path scope relative to the launch cwd", async () => {
  const repo = await createTempRepo();

  try {
    await repo.write("packages/a/file-a.txt", "alpha\n");
    await repo.write("packages/b/file-b.txt", "beta\n");
    await repo.git(["add", "."]);
    await repo.git(["commit", "-m", "init"]);

    await repo.write("packages/a/file-a.txt", "alpha\nchanged\n");
    await repo.write("packages/b/file-b.txt", "beta\nchanged\n");

    const session = await createSession({
      cwd: path.join(repo.dir, "packages"),
      pathScope: "a",
      viewMode: "unified",
      filters: { staged: true, unstaged: true, untracked: true },
    });

    assert.equal(session.kind, "repo");
    assert.deepEqual(
      session.files.map((file) => file.path),
      ["packages/a/file-a.txt"],
    );
    assert.equal(session.summary.totalFiles, 1);
  } finally {
    await repo.cleanup();
  }
});

test("createSession honors disabled filters in summary and file list", async () => {
  const repo = await createTempRepo();

  try {
    await repo.write("tracked.txt", "alpha\n");
    await repo.git(["add", "tracked.txt"]);
    await repo.git(["commit", "-m", "init"]);

    await repo.write("tracked.txt", "alpha\nbeta\n");
    await repo.git(["add", "tracked.txt"]);
    await repo.write("tracked.txt", "alpha\nbeta\ngamma\n");
    await repo.write("new.txt", "new file\n");

    const session = await createSession({
      cwd: repo.dir,
      viewMode: "unified",
      filters: { staged: false, unstaged: true, untracked: false },
    });

    assert.equal(session.kind, "repo");
    assert.deepEqual(
      session.files.map((file) => file.path),
      ["tracked.txt"],
    );
    assert.equal(session.summary.totalFiles, 1);
    assert.equal(session.summary.stagedFiles, 1);
    assert.equal(session.summary.unstagedFiles, 1);
    assert.equal(session.summary.untrackedFiles, 0);
  } finally {
    await repo.cleanup();
  }
});
