jest.mock("../config", () => ({
  config: {

}));

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { TreasuryController } from "./treasury.controller";
import { TreasuryService } from "./treasury.service";

describe("TreasuryController", () => {
  let service: jest.Mocked<
    Pick<
      TreasuryService,
      | "getBalance"
      | "getConfig"
      | "getTransactions"
      | "getTransactionById"
      | "getSigners"
    >
  >;
  let controller: TreasuryController;

  beforeEach(() => {
    service = {
      getBalance: jest.fn(),
      getConfig: jest.fn(),
      getTransactions: jest.fn(),
      getTransactionById: jest.fn(),
      getSigners: jest.fn(),
    };
    controller = new TreasuryController(service as unknown as TreasuryService);
  });

  it("returns the treasury balance envelope", async () => {
    service.getBalance.mockResolvedValue("1000.0000000");

    await expect(controller.getBalance()).resolves.toEqual({
      balance: "1000.0000000",
    });
  });

  it("returns config directly from the service", async () => {
    const config = {
      admin: "GADMIN",
      threshold: 2,
      signer_count: 3,
      balance: "1000000",
      tx_count: 4,
    };
    service.getConfig.mockResolvedValue(config);

    await expect(controller.getConfig()).resolves.toBe(config);
  });

  it("validates transaction pagination", async () => {
    await expect(controller.getTransactions("0", "101")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(service.getTransactions).not.toHaveBeenCalled();
  });

  it("passes normalized pagination to the service", async () => {
    service.getTransactions.mockResolvedValue({ data: [], pagination: { page: 2, limit: 25, total: 0 } });

    await controller.getTransactions("2", "25");

    expect(service.getTransactions).toHaveBeenCalledWith(2, 25);
  });

  it("throws NotFoundException when transaction is missing", async () => {
    service.getTransactionById.mockResolvedValue(null);

    await expect(controller.getTransaction("99")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("returns signers in an envelope", async () => {
    service.getSigners.mockResolvedValue(["GA", "GB"]);

    await expect(controller.getSigners()).resolves.toEqual({
      signers: ["GA", "GB"],
    });
  });
});
