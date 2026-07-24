import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const cwd = resolve(import.meta.dirname, "..");
const temp = mkdtempSync(join(tmpdir(), "work-sdk-pack-"));
const npm = process.platform === "win32" ? process.execPath : "npm";
const npmPrefix = process.platform === "win32"
  ? [join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")]
  : [];

try {
  const output = execFileSync(npm, [...npmPrefix, "pack", "--json", "--ignore-scripts"], {
    cwd,
    encoding: "utf8",
  });
  const [{ filename }] = JSON.parse(output);
  const tarball = join(cwd, filename);
  writeFileSync(join(temp, "package.json"), JSON.stringify({ type: "module", private: true }));
  execFileSync(npm, [...npmPrefix, "install", "--ignore-scripts", tarball], {
    cwd: temp,
    stdio: "pipe",
  });
  const smoke = `
    import { createWorkClient, MemoryIdempotencyStore } from "work-sdk";
    import { github } from "work-sdk/github";
    import { gitlab } from "work-sdk/gitlab";
    import { linear } from "work-sdk/linear";
    import { jira } from "work-sdk/jira";
    import { azureDevOps } from "work-sdk/azure-devops";
    import { memoryWorkAdapter } from "work-sdk/testing";
    const client = createWorkClient({ adapter: memoryWorkAdapter(), idempotencyStore: new MemoryIdempotencyStore() });
    if (client.provider !== "memory" || !github || !gitlab || !linear || !jira || !azureDevOps) process.exit(1);
  `;
  writeFileSync(join(temp, "smoke.mjs"), smoke);
  execFileSync(process.execPath, ["smoke.mjs"], { cwd: temp, stdio: "pipe" });
  const manifest = JSON.parse(readFileSync(join(temp, "node_modules", "work-sdk", "package.json"), "utf8"));
  if (manifest.name !== "work-sdk") throw new Error("Packed manifest has the wrong name");
  console.log(`Packed consumer smoke passed for ${manifest.name}@${manifest.version}`);
  rmSync(tarball, { force: true });
} finally {
  rmSync(temp, { recursive: true, force: true });
}
