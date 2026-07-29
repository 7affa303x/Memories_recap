type LogFields = Record<string, unknown>;

export function logInfo(message: string, fields?: LogFields) {
  console.log(JSON.stringify({ level: "info", message, ...fields, at: new Date().toISOString() }));
}

export function logError(message: string, fields?: LogFields) {
  console.error(JSON.stringify({ level: "error", message, ...fields, at: new Date().toISOString() }));
}
