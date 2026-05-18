import { randomUUID } from "node:crypto";

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

