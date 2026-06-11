"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

const HORAS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTOS = Array.from({ length: 60 }, (_, i) => i);

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parseHora24(value: string): { hora12: number; minuto: number; periodo: "AM" | "PM" } {
  const [hStr, mStr] = value.split(":");
  const h24 = Number(hStr) || 0;
  const minuto = Number(mStr) || 0;
  const periodo: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  let hora12 = h24 % 12;
  if (hora12 === 0) hora12 = 12;
  return { hora12, minuto, periodo };
}

function toHora24(hora12: number, minuto: number, periodo: "AM" | "PM"): string {
  let h24 = hora12 % 12;
  if (periodo === "PM") h24 += 12;
  return `${pad(h24)}:${pad(minuto)}`;
}

// Selector de hora en formato 12h (AM/PM) consistente, sin depender del
// formato de hora del sistema operativo o navegador del dispositivo.
export default function TimeInput12h({ value, onChange, required }: Props) {
  const { hora12, minuto, periodo } = parseHora24(value || "00:00");

  function update(nuevoHora12: number, nuevoMinuto: number, nuevoPeriodo: "AM" | "PM") {
    onChange(toHora24(nuevoHora12, nuevoMinuto, nuevoPeriodo));
  }

  return (
    <div className="flex gap-1">
      <select
        className="rounded-md border border-zinc-300 px-2 py-2 text-sm"
        value={hora12}
        onChange={(e) => update(Number(e.target.value), minuto, periodo)}
        required={required}
        aria-label="Hora"
      >
        {HORAS_12.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <select
        className="rounded-md border border-zinc-300 px-2 py-2 text-sm"
        value={minuto}
        onChange={(e) => update(hora12, Number(e.target.value), periodo)}
        required={required}
        aria-label="Minutos"
      >
        {MINUTOS.map((m) => (
          <option key={m} value={m}>
            {pad(m)}
          </option>
        ))}
      </select>
      <select
        className="rounded-md border border-zinc-300 px-2 py-2 text-sm"
        value={periodo}
        onChange={(e) => update(hora12, minuto, e.target.value as "AM" | "PM")}
        required={required}
        aria-label="AM/PM"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
