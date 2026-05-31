import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { startListener, stopListener, setupSignalHandlers } from "./listener";
import { config } from "./config";

@Injectable()
export class ListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ListenerService.name);

  async onModuleInit() {
    setupSignalHandlers();
    this.logger.log("Starting event listener...");
    startListener().catch((err) => {
      const rpcUrl = new URL(config.sorobanRpcUrl);
      const redactedUrl = `${rpcUrl.protocol}//${rpcUrl.host}${rpcUrl.pathname}`;
      const presentCount = config.contractIds.length;
      this.logger.error(
        `Listener failed: rpc=${redactedUrl} contract_ids=${presentCount} ` +
          `next_action=restart error=${err instanceof Error ? err.message : err}`,
      );
    });
  }

  async onModuleDestroy() {
    this.logger.log("Stopping event listener...");
    stopListener();
  }
}