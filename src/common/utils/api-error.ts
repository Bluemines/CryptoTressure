export class ApiError extends Error {
  statusCode: number;
  errors: any[];
  data: any;

  constructor(
    statusCode: number,
    message = 'Something went wrong',
    errors: any[] = [],
    stack?: string,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
    this.data = null;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
