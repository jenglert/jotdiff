import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createTempRepo } from "../../../tests/helpers/temp-repo";
import { detectRepo, listWorkingTreeChanges, loadFileDiff } from "../src/index";

test("listWorkingTreeChanges reports staged, unstaged, and untracked counts", async () => {
  const repo = await createTempRepo();

  try {
    await repo.write("tracked.txt", "alpha\n");
    await repo.git(["add", "tracked.txt"]);
    await repo.git(["commit", "-m", "init"]);

    await repo.write("tracked.txt", "alpha\nbeta\n");
    await repo.git(["add", "tracked.txt"]);
    await repo.write("tracked.txt", "alpha\nbeta\ngamma\n");
    await repo.write("new.txt", "new file\n");

    const detected = await detectRepo(repo.dir);
    assert.ok(detected);

    const files = await listWorkingTreeChanges(detected, {
      staged: true,
      unstaged: true,
      untracked: true,
    });

    const tracked = files.find((file) => file.path === "tracked.txt");
    const untracked = files.find((file) => file.path === "new.txt");

    assert.ok(tracked);
    assert.equal(tracked.stagedAdditions, 1);
    assert.equal(tracked.unstagedAdditions, 1);
    assert.equal(tracked.additions, 2);

    assert.ok(untracked);
    assert.equal(untracked.isUntracked, true);
    assert.ok(untracked.additions >= 1);
  } finally {
    await repo.cleanup();
  }
});

test("loadFileDiff supports preview and full load modes", async () => {
  const repo = await createTempRepo();

  try {
    const original = Array.from({ length: 12000 }, (_, index) => `line${index + 1}`).join("\n");
    const changed = Array.from({ length: 12000 }, (_, index) => `line${index + 1} changed`).join("\n");

    await repo.write("big.txt", original);
    await repo.git(["add", "big.txt"]);
    await repo.git(["commit", "-m", "init"]);
    await repo.write("big.txt", changed);

    const detected = await detectRepo(repo.dir);
    assert.ok(detected);

    const [entry] = await listWorkingTreeChanges(detected, {
      staged: true,
      unstaged: true,
      untracked: true,
    });

    assert.ok(entry);

    const preview = await loadFileDiff(
      detected,
      entry,
      "unified",
      { staged: true, unstaged: true, untracked: true },
      { full: false },
    );
    const full = await loadFileDiff(
      detected,
      entry,
      "unified",
      { staged: true, unstaged: true, untracked: true },
      { full: true },
    );

    assert.equal(preview.isTruncated, true);
    assert.equal(preview.canLoadFull, true);
    assert.equal(preview.isFull, false);
    assert.equal(full.isTruncated, false);
    assert.equal(full.isFull, true);
    assert.ok(full.raw.length > preview.raw.length);
  } finally {
    await repo.cleanup();
  }
});

test("loadFileDiff marks untracked binary files as binary", async () => {
  const repo = await createTempRepo();

  try {
    await repo.write("base.txt", "base\n");
    await repo.git(["add", "base.txt"]);
    await repo.git(["commit", "-m", "init"]);
    await repo.write("blob.bin", Buffer.from([0, 1, 2, 3, 4, 5, 0, 255]));

    const detected = await detectRepo(repo.dir);
    assert.ok(detected);

    const files = await listWorkingTreeChanges(detected, {
      staged: true,
      unstaged: true,
      untracked: true,
    });
    const entry = files.find((file) => file.path === "blob.bin");
    assert.ok(entry);

    const diff = await loadFileDiff(
      detected,
      entry,
      "unified",
      { staged: true, unstaged: true, untracked: true },
      { full: false },
    );

    assert.equal(diff.isBinary, true);
    assert.match(diff.binaryReason ?? "", /binary|non-text/i);
    assert.equal(diff.sections[0]?.isBinary, true);
  } finally {
    await repo.cleanup();
  }
});

test("detectRepo reports repo root and relative cwd for nested directories", async () => {
  const repo = await createTempRepo();

  try {
    await repo.write("src/nested/file.txt", "alpha\n");

    const detected = await detectRepo(`${repo.dir}/src/nested`);
    assert.ok(detected);
    assert.equal(path.normalize(detected.repoRoot), path.normalize(repo.dir));
    assert.equal(detected.relativeCwd, "src/nested");
    assert.equal(detected.repoName.length > 0, true);
  } finally {
    await repo.cleanup();
  }
});

test("listWorkingTreeChanges respects filters and path scopes", async () => {
  const repo = await createTempRepo();

  try {
    await repo.write("apps/one.txt", "base\n");
    await repo.write("docs/two.txt", "base\n");
    await repo.git(["add", "."]);
    await repo.git(["commit", "-m", "init"]);

    await repo.write("apps/one.txt", "base\nnext\n");
    await repo.git(["add", "apps/one.txt"]);
    await repo.write("apps/one.txt", "base\nnext\nfinal\n");
    await repo.write("docs/two.txt", "base\nnext\n");
    await repo.write("apps/new.txt", "new\n");

    const detected = await detectRepo(repo.dir);
    assert.ok(detected);

    const stagedOnly = await listWorkingTreeChanges(
      detected,
      { staged: true, unstaged: false, untracked: false },
      "apps",
    );
    assert.deepEqual(
      stagedOnly.map((entry) => entry.path),
      ["apps/one.txt"],
    );

    const unstagedAndUntracked = await listWorkingTreeChanges(
      detected,
      { staged: false, unstaged: true, untracked: true },
      "apps",
    );
    assert.deepEqual(
      unstagedAndUntracked.map((entry) => entry.path),
      ["apps/new.txt", "apps/one.txt"],
    );
  } finally {
    await repo.cleanup();
  }
});

test("loadFileDiff separates staged and unstaged sections for a mixed file", async () => {
  const repo = await createTempRepo();

  try {
    await repo.write("tracked.txt", "alpha\n");
    await repo.git(["add", "tracked.txt"]);
    await repo.git(["commit", "-m", "init"]);

    await repo.write("tracked.txt", "alpha\nbeta\n");
    await repo.git(["add", "tracked.txt"]);
    await repo.write("tracked.txt", "alpha\nbeta\ngamma\n");

    const detected = await detectRepo(repo.dir);
    assert.ok(detected);

    const [entry] = await listWorkingTreeChanges(detected, {
      staged: true,
      unstaged: true,
      untracked: true,
    });
    assert.ok(entry);

    const diff = await loadFileDiff(
      detected,
      entry,
      "unified",
      { staged: true, unstaged: true, untracked: true },
      { full: true },
    );

    assert.equal(diff.sections.length, 2);
    assert.equal(diff.sections[0]?.label, "Staged changes");
    assert.equal(diff.sections[1]?.label, "Unstaged changes");
    assert.ok((diff.sections[0]?.hunks.length ?? 0) > 0);
    assert.ok((diff.sections[1]?.hunks.length ?? 0) > 0);
  } finally {
    await repo.cleanup();
  }
});
