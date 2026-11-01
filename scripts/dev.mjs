import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const tsxBin = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");

const children = [
  spawn(process.execPath, [nextBin, "dev"], { cwd: root, stdio: "inherit" }),
  spawn(process.execPath, [tsxBin, "watch", "realtime/src/index.ts"], { cwd: root, stdio: "inherit" }),
];

let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 250).unref();
}

for (const child of children) {
  child.on("error", (error) => {
    console.error("[dev] Failed to start a development process:", error);
    stop(1);
  });
  child.on("exit", (code, signal) => {
    if (stopping) return;
    if (signal) console.error(`[dev] A development process stopped with ${signal}.`);
    stop(code ?? 1);
  });
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
