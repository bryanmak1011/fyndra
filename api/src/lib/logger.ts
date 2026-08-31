// ponytail: no logging library. Structured JSON to stdout is enough for a
// Phase 1 single-process API/worker; reach for pino if log volume or
// multi-transport routing ever demands it.

type Level = 'info' | 'warn' | 'error';

function write(level: Level, message: string, meta: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), ...meta });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
};

export function newCorrelationId(): string {
  return crypto.randomUUID();
}
