export class AppError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400,
    public readonly retryable = false, public readonly details: { field: string; reason: string }[] = []) { super(message); }
}
export function requireThat(condition: unknown, code: string, message: string, status = 409): asserts condition {
  if (!condition) throw new AppError(code, message, status);
}
export function notFound(): never { throw new AppError('NOT_FOUND', '内容不存在或无权访问', 404); }
