import { createHash } from "crypto";

// Token derivado de DATABASE_URL: idéntico en todos los proyectos que
// comparten la misma base de datos, sin necesidad de coordinar env vars.
export function getDashboardToken(): string {
  return createHash("sha256")
    .update(process.env.DATABASE_URL ?? "no-db-url")
    .digest("hex")
    .slice(0, 32);
}
