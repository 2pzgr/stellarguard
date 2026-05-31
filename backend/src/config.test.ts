const ORIGINAL_ENV = process.env;

function reloadConfig() {
  jest.resetModules();
  // Re-require the module so each test observes the environment it just set.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("./config") as typeof import("./config");
}

describe("config", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.DATABASE_URL;
    delete process.env.SOROBAN_RPC_URL;
    delete process.env.NETWORK_PASSPHRASE;
    delete process.env.POLL_INTERVAL_MS;
    delete process.env.CORS_ORIGIN;
    delete process.env.NODE_ENV;
    delete process.env.DB_POOL_MAX;
    delete process.env.TREASURY_CONTRACT_ID;
    delete process.env.GOVERNANCE_CONTRACT_ID;
    delete process.env.TOKEN_VAULT_CONTRACT_ID;
    delete process.env.ACCESS_CONTROL_CONTRACT_ID;
    // Set required critical env vars for loadConfig
    process.env.DATABASE_URL = "postgresql://localhost:5432/stellarguard";
    process.env.SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
    process.env.NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("loads defaults for local development", () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/stellarguard";
    process.env.SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
    process.env.NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
    const warn = jest.spyOn(console, "warn").mockImplementation();
    const { loadConfig } = reloadConfig();

    const result = loadConfig();

    expect(result.databaseUrl).toBe("postgresql://localhost:5432/stellarguard");
    expect(result.sorobanRpcUrl).toBe("https://soroban-testnet.stellar.org");
    expect(result.networkPassphrase).toBe("Test SDF Network ; September 2015");
    expect(result.pollIntervalMs).toBe(5000);
    expect(result.corsOrigin).toBe("http://localhost:3000");
    expect(result.dbPoolMax).toBe(10);
    expect(result.contractIds).toEqual([]);
    warn.mockRestore();
  });

  it("collects configured contract ids in stable order", () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/stellarguard";
    process.env.SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
    process.env.NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
    process.env.TREASURY_CONTRACT_ID = " CTREASURY ";
    process.env.GOVERNANCE_CONTRACT_ID = "CGOV";
    process.env.TOKEN_VAULT_CONTRACT_ID = "";
    process.env.ACCESS_CONTROL_CONTRACT_ID = "CACL";

    const { getContractIds } = reloadConfig();

    expect(getContractIds()).toEqual(["CTREASURY", "CGOV", "CACL"]);
  });

  it("parses comma-separated CORS origins", () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/stellarguard";
    process.env.SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
    process.env.NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
    process.env.CORS_ORIGIN =
      "https://app.example.com, https://admin.example.com";

    const { loadConfig } = reloadConfig();

    expect(loadConfig().corsOrigin).toEqual([
      "https://app.example.com",
      "https://admin.example.com",
    ]);
  });

  it("warns for wildcard CORS in production", () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/stellarguard";
    process.env.SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
    process.env.NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGIN = "*";
    process.env.TREASURY_CONTRACT_ID = "CTREASURY";
    const warn = jest.spyOn(console, "warn").mockImplementation();

    const { loadConfig } = reloadConfig();

    expect(loadConfig().corsOrigin).toBe("*");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("CORS_ORIGIN resolves to '*'"),
    );
    warn.mockRestore();
  });
});
