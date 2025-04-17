export class ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  data: T | null;
  message: string;

  constructor(statusCode: number, data: T, message = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}
