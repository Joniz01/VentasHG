"use client";

import React, { CSSProperties } from "react";

interface InputFechaProps {
  value: string;
  onChange: (valor: string) => void;
  style?: CSSProperties;
  className?: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  /** Background CSS value for the overlay — defaults to var(--erp-bg).
   *  Pass "var(--erp-surface)" for inputs without explicit background. */
  bg?: string;
}

export default function InputFecha({
  value,
  onChange,
  style,
  className,
  min,
  max,
  required,
  disabled,
  bg = "var(--erp-bg)",
}: InputFechaProps) {
  const parts = value ? value.split("-") : [];
  const [anio, mes, dia] = parts;
  const texto = dia ? `${dia}/${mes}/${anio}` : "dd/mm/aaaa";

  const overlayPadLeft =
    (style?.paddingLeft as number | string) ??
    (style?.padding !== undefined ? style.padding : 11);

  return (
    <div style={{ position: "relative", display: "inline-block", width: style?.width ?? "100%" }}>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={style}
        className={className}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 1,
          top: 1,
          bottom: 1,
          right: 32,
          display: "flex",
          alignItems: "center",
          paddingLeft: overlayPadLeft,
          borderRadius: 7,
          background: bg,
          fontSize: style?.fontSize ?? 14,
          color: dia ? "var(--erp-text)" : "var(--erp-text-3)",
          pointerEvents: "none",
          fontFamily: "inherit",
        }}
      >
        {texto}
      </span>
    </div>
  );
}
