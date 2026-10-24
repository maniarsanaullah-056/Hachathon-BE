export default class ApiError extends Error {
  constructor(statusCode, message, { errors = null, code = null } = {}) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}
