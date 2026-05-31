jest.mock("./config", () => ({
  config: {
    sorobanRpcUrl: "https://soroban-testnet.stellar.org/soroban/rpc",
    contractIds: ["CTREASURY", "CGOV"],
  },
}));

jest.mock("./listener", () => ({
  startListener: jest.fn(),
  stopListener: jest.fn(),
  setupSignalHandlers: jest.fn(),
}));

import { ListenerService } from "./listener.service";
import { startListener } from "./listener";

describe("ListenerService", () => {
  let service: ListenerService;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    loggerErrorSpy = jest.spyOn(console, "error").mockImplementation();
    service = new ListenerService();
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  describe("onModuleInit", () => {
    it("starts the listener and logs on success", async () => {
      (startListener as jest.Mock).mockResolvedValue(undefined);
      await service.onModuleInit();
      expect(startListener).toHaveBeenCalled();
    });

    it("logs detailed error when listener fails", async () => {
      const error = new Error("RPC connection refused");
      (startListener as jest.Mock).mockRejectedValue(error);

      const loggerSpy = jest
        .spyOn(service["logger"], "error")
        .mockImplementation();

      await service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining("rpc=https://soroban-testnet.stellar.org/soroban/rpc"),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining("contract_ids=2"),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining("next_action=restart"),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining("error=RPC connection refused"),
      );
    });
  });
});
