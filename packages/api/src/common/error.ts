import httpStatus from 'http-status-codes';
import type { HttpError } from '@map-colonies/error-express-handler';

export class NotFoundError extends Error implements HttpError {
  public readonly status = httpStatus.NOT_FOUND;

  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}
