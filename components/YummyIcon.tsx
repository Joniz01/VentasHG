"use client";

export function YummyIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#00C853" />
      <path d="M12 9 L19.5 21.5 L19.5 30 L24 30 L24 21.5 L31.5 9 L26.3 9 L21.75 17.2 L17.2 9 Z" fill="white" />
    </svg>
  );
}

type YummyToggleProps = {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

export function YummyToggle({ checked, onToggle, disabled }: YummyToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={checked ? "Cobrado — clic para marcar pendiente" : "Pendiente — clic para marcar cobrado"}
      className="flex items-center gap-1.5 rounded-full border pl-1 pr-1.5 py-1 transition disabled:opacity-50"
      style={{ borderColor: "#00C853", backgroundColor: checked ? "#e8f5e9" : "white" }}
    >
      <YummyIcon size={18} />
      <span
        className="relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors"
        style={{ backgroundColor: checked ? "#00C853" : "#d1d5db" }}
      >
        <span
          className="inline-block h-3 w-3 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? "translateX(16px)" : "translateX(2px)" }}
        />
      </span>
    </button>
  );
}
