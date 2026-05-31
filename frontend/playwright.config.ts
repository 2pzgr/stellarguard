import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

const systemBrowserChannel =
  process.platform === "win32" && fs.existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe")
    ? "chrome"
    : process.platform === "win32" &&
        fs.existsSync("C:/Program Files (x86)/Google/Chrome/Application/chrome.exe")
      ? "chrome"
      : process.platform === "win32" &&
          fs.existsSync("C:/Program Files/Microsoft/Edge/Application/msedge.exe")
        ? "msedge"
        : process.platform === "win32" &&
            fs.existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")
          ? "msedge"
          : undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3005",
    trace: "on-first-retry",
  },
  webServer: {
    command: "node ./scripts/start-playwright-server.mjs",
    url: "http://127.0.0.1:3005",
    reuseExistingServer: !process.env.CI,
    cwd: __dirname,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(systemBrowserChannel ? { channel: systemBrowserChannel } : {}),
      },
    },
  ],
});
