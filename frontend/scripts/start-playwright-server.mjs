import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const env = {
  ...process.env,
  CI: "1",
  NEXT_DISABLE_VERSION_CHECK: "1",
  NEXT_PUBLIC_USE_MOCK_TREASURY: "1",
  NEXT_PUBLIC_TREASURY_CONTRACT_ID: "mock-treasury-contract",
  NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID: "mock-governance-contract",
  NEXT_PUBLIC_VAULT_CONTRACT_ID: "mock-vault-contract",
  NEXT_PUBLIC_ACL_CONTRACT_ID: "mock-acl-contract",
  NEXT_PUBLIC_SOROBAN_SIMULATION_ACCOUNT:
    "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
};

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", "3005"], {
  cwd,
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
