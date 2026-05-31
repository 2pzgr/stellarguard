import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { RequestContextService } from './request-context.service';

@Injectable({ scope: Scope.DEFAULT })
export class CustomLogger implements LoggerService {
  private readonly logger = new Logger();

  constructor(private readonly requestContext: RequestContextService) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(message: any, context?: string) {
    const requestId = this.requestContext.getRequestId();
    const prefix = requestId ? `[${requestId}] ` : '';
    this.logger.log(prefix + message, context);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(message: any, trace?: string, context?: string) {
    const requestId = this.requestContext.getRequestId();
    const prefix = requestId ? `[${requestId}] ` : '';
    this.logger.error(prefix + message, trace, context);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn(message: any, context?: string) {
    const requestId = this.requestContext.getRequestId();
    const prefix = requestId ? `[${requestId}] ` : '';
    this.logger.warn(prefix + message, context);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug(message: any, context?: string) {
    const requestId = this.requestContext.getRequestId();
    const prefix = requestId ? `[${requestId}] ` : '';
    this.logger.debug(prefix + message, context);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  verbose(message: any, context?: string) {
    const requestId = this.requestContext.getRequestId();
    const prefix = requestId ? `[${requestId}] ` : '';
    this.logger.verbose(prefix + message, context);
  }
}
