const TZ = "America/Caracas";

/** Returns today's date as YYYY-MM-DD in Venezuela timezone */
export function hoyCaracas(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/** PostgreSQL expression for today in Venezuela timezone */
export const PG_HOY = `(NOW() AT TIME ZONE 'America/Caracas')::date`;
