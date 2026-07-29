/**
 * Share-link password must travel in a POST JSON body only — never in a GET query.
 */
export function sharePasswordFromRequest(input: {
  method: string;
  queryPassword?: string | null;
  bodyPassword?: string | null;
}): string | null {
  if (input.method.toUpperCase() === "GET") {
    return null;
  }
  const fromBody = input.bodyPassword?.trim();
  return fromBody || null;
}
