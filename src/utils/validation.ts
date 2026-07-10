import { ValidationError } from "../errors/index.js";

/** Fails fast on a missing required string argument, before a request is ever sent. */
export function required(field: string, value: string | undefined | null): void {
  if (!value) throw new ValidationError(field, `${field} is required`);
}
