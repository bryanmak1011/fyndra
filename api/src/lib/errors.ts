export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const Errors = {
  unauthorized: (message = 'Missing or invalid bearer token') =>
    new ApiError(401, 'unauthorized', message),
  notFound: (message = 'Not found') => new ApiError(404, 'not_found', message),
  conflict: (code: string, message: string) => new ApiError(409, code, message),
  unprocessable: (code: string, message: string) => new ApiError(422, code, message),
  gone: (message = 'No longer available') => new ApiError(410, 'gone', message),
  tooManyRequests: (message = 'Too many requests') => new ApiError(429, 'rate_limited', message),
};
