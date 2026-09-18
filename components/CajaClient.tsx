"use client";

import { useEffect, useRef, useState } from "react";

type Extra = { id: number; nombre: string; precioAdicional: number };
type Producto = { id: number; nombre: string; precioVenta: number; categoriaNombre: string | null; lineaNombre: string | null; extras: Extra[] };
type Motorizado = { id: number; nombre: string; apellido: string };
type LineaCarrito = { uid: string; productoId: number; nombre: string; precio: number; qty: number; extraId: number | null; extraNombre: string | null; extraPrecio: number };
type Theme = "dark" | "light" | "azul" | "beige";

let _uid = 0;
function uid() { return `c${++_uid}`; }
function fmt(n: number) { return `$${n.toFixed(2)}`; }
function fmtBs(n: number, tasa: number) {
  return `Bs ${(n * tasa).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function today() { return new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" }); }

const PAY_OPTS = [
  { key: "EFECTIVO_BS",  label: "Efectivo Bs", icon: "💵" },
  { key: "PUNTO_VENTA",  label: "Punto",        icon: "💳" },
  { key: "PAGO_MOVIL",   label: "Pago Móvil",   icon: "📱" },
  { key: "EFECTIVO_USD", label: "USD Cash",      icon: "💲" },
  { key: "CASHEA",       label: "Cashea",        icon: "📋" },
  { key: "CXC_DIRECTA",  label: "CxC",           icon: "🤝" },
] as const;

const CXP_METHODS = ["CASHEA", "CXC_DIRECTA"];

const THEMES: { key: Theme; label: string; icon: string }[] = [
  { key: "dark",  label: "Oscuro",  icon: "🌑" },
  { key: "light", label: "Claro",   icon: "☀️" },
  { key: "azul",  label: "Azul",    icon: "🔷" },
  { key: "beige", label: "Hechizo", icon: "🪙" },
];

const THEME_VARS: Record<Theme, string> = {
  dark: `--bg:#F5F2ED;--surface:#FFF;--topbar:#1C1C1E;--tb-text:#ccc;--tb-border:#2e2e2e;
         --dk:#242426;--dk2:#2E2E30;--dk3:#383838;
         --accent:#C8960C;--al:rgba(200,150,12,.13);--ab:#D4A820;
         --text:#1C1C1E;--t2:#78786E;--t3:#AEAE9E;--border:#E8E4DC;
         --tt:#F0EDE8;--tt2:#888880;--tt3:#555550;--tl:#343434;
         --catbg:#1C1C1E;--cattext:#fff;--bs:#7ec8ff;--bbg:#F8F7F4;--bborder:#E0DDD8;`,
  light: `--bg:#F0F0EE;--surface:#FFF;--topbar:#FFF;--tb-text:#444;--tb-border:#E0E0DC;
          --dk:#FFF;--dk2:#F5F5F3;--dk3:#E8E8E5;
          --accent:#C8960C;--al:rgba(200,150,12,.1);--ab:#D4A820;
          --text:#1C1C1E;--t2:#78786E;--t3:#AEAE9E;--border:#E0DDD8;
          --tt:#1C1C1E;--tt2:#78786E;--tt3:#AEAE9E;--tl:#E0DDD8;
          --catbg:#1C1C1E;--cattext:#fff;--bs:#1A6FA8;--bbg:#FAFAF8;--bborder:#E0DDD8;`,
  azul: `--bg:#EBF2FA;--surface:#FFF;--topbar:#1A3A5C;--tb-text:#BDD5EE;--tb-border:#142E48;
         --dk:#3278B4;--dk2:#3A86C4;--dk3:#4294D4;
         --accent:#3A9BD5;--al:rgba(58,155,213,.15);--ab:#4AAEE0;
         --text:#1A2A3A;--t2:#4A6A8A;--t3:#7A9AB8;--border:#C5D9EC;
         --tt:#F0F8FF;--tt2:#C8E0F4;--tt3:#90BBD8;--tl:#2060A0;
         --catbg:#1A3A5C;--cattext:#BDD5EE;--bs:#7ec8ff;--bbg:#EBF2FA;--bborder:#B5CEEA;`,
  beige: `--bg:#FEF9F0;--surface:#FFF;--topbar:#1A1A1A;--tb-text:#D4A84A;--tb-border:#111;
          --dk:#3D2B1A;--dk2:#4A3520;--dk3:#5A4228;
          --accent:#C8960C;--al:rgba(200,150,12,.15);--ab:#D4A820;
          --text:#1A1A1A;--t2:#5C3A1E;--t3:#A07040;--border:#F0DEB8;
          --tt:#F5EAD8;--tt2:#9A7A5A;--tt3:#6A4A2A;--tl:#2E1C0E;
          --catbg:#1A1A1A;--cattext:#D4A84A;--bs:#F0C860;--bbg:#FAF3E8;--bborder:#EDD5A8;`,
};

const CSS = `
html,body{height:100%;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:13px}
*,*::before,*::after{box-sizing:border-box}
button,input{font-family:inherit}
button{cursor:pointer}

.pos{display:flex;flex-direction:column;height:100vh;background:var(--bg)}

/* ── Topbar ── */
.topbar{background:var(--topbar);color:var(--tb-text);height:44px;display:flex;align-items:center;gap:12px;padding:0 14px;flex-shrink:0;border-bottom:1px solid var(--tb-border)}
.tb-brand{font-weight:700;font-size:11px;color:var(--accent);letter-spacing:.06em;text-transform:uppercase}
.tb-sep{color:var(--tb-border)}
.tb-title{font-size:13px;font-weight:500;color:var(--tb-text)}
.tb-space{flex:1}
.theme-btns{display:flex;gap:3px}
.theme-btn{padding:2px 7px;border-radius:5px;border:1px solid var(--tb-border);background:none;color:var(--tb-text);font-size:10px;transition:all .15s}
.theme-btn.active{border-color:var(--ab);color:var(--accent)}
.tb-clock{font-size:11px;color:var(--tt3)}

/* ── Body split ── */
.pos-body{flex:1;display:flex;min-height:0;overflow:hidden}

/* ── LEFT PANEL ── */
.left-panel{flex:1;min-width:360px;display:flex;flex-direction:column;background:var(--bg);overflow:hidden;border-right:1px solid var(--border)}

/* Catalog top */
.cat-head{padding:8px 14px 0;display:flex;flex-direction:column;gap:6px;flex-shrink:0}
.search-wrap{position:relative}
.s-icon{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--t3);font-size:13px;pointer-events:none}
.search-input{width:100%;padding:7px 10px 7px 28px;border:1.5px solid var(--border);border-radius:7px;font-size:12px;background:var(--surface);color:var(--text);outline:none;transition:border-color .15s}
.search-input:focus{border-color:var(--accent)}
.search-input::placeholder{color:var(--t3)}
.cats{display:flex;gap:5px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none}
.cats::-webkit-scrollbar{display:none}
.cat-pill{flex-shrink:0;padding:4px 11px;border-radius:20px;font-size:11px;font-weight:500;border:1.5px solid var(--border);background:var(--surface);color:var(--t2);transition:all .15s;white-space:nowrap}
.cat-pill.active{background:var(--catbg);color:var(--cattext);border-color:var(--catbg)}

/* Product grid */
.product-grid{flex:1;overflow-y:auto;padding:6px 14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;align-content:start;scrollbar-width:thin;scrollbar-color:var(--border) transparent}
.p-card{background:var(--surface);border:1.5px solid var(--border);border-radius:9px;overflow:hidden;cursor:pointer;transition:border-color .15s,box-shadow .15s;user-select:none;position:relative}
.p-card:hover{border-color:var(--ab);box-shadow:0 2px 8px rgba(0,0,0,.08)}
.p-card.in-cart{border-color:var(--ab)}
.p-card.expanded{border-color:var(--ab);box-shadow:0 3px 12px rgba(0,0,0,.12)}
.p-thumb{width:100%;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--bg) 0%,var(--border) 100%);position:relative;font-size:11px;font-weight:700;color:var(--t2);letter-spacing:.03em;text-align:center;padding:4px}
.p-badge{position:absolute;top:4px;right:4px;background:var(--accent);color:#fff;font-size:9px;font-weight:700;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.p-info{padding:6px 8px}
.p-name{font-size:11px;font-weight:500;color:var(--text);line-height:1.25;margin-bottom:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.p-row{display:flex;align-items:center;justify-content:space-between;gap:4px}
.p-price{font-size:12px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums}
.p-opts-tag{font-size:9px;color:var(--accent);font-weight:600}
.p-extras-overlay{position:absolute;inset:0;z-index:20;background:var(--dk);border:1.5px solid var(--ab);border-radius:9px;padding:7px 8px 8px;display:flex;flex-direction:column;gap:5px}
.p-extras-label{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t3)}
.p-extras-wrap{display:flex;flex-wrap:wrap;gap:4px;flex:1;align-content:flex-start}
.p-extra-btn{padding:3px 8px;border-radius:5px;border:1.5px solid var(--border);background:var(--surface);color:var(--t2);font-size:10px;font-weight:500;transition:all .15s}
.p-extra-btn:hover{border-color:var(--ab);color:var(--accent);background:var(--al)}
.p-extra-sin{padding:3px 8px;border-radius:5px;border:1.5px dashed var(--border);background:none;color:var(--t3);font-size:10px;transition:all .15s}
.p-extra-sin:hover{border-color:var(--t3);color:var(--t2)}
.p-extra-close{position:absolute;top:4px;right:5px;background:none;border:none;color:var(--t3);font-size:11px;cursor:pointer;padding:0;line-height:1}
.p-extra-close:hover{color:var(--text)}
.pg-btn{padding:3px 10px;border-radius:6px;border:1.5px solid var(--border);background:var(--surface);color:var(--t2);font-size:13px;font-weight:700;cursor:pointer;transition:all .15s}
.pg-btn:disabled{opacity:.3;cursor:default}
.pg-btn:not(:disabled):hover{border-color:var(--ab);color:var(--accent)}

/* ── BOTTOM BAR (left panel) ── */
.bottom-bar{flex-shrink:0;background:var(--bbg);border-top:2px solid var(--bborder);display:flex;gap:0;overflow:hidden}
.bb-col{flex:1;padding:8px 12px;display:flex;flex-direction:column;gap:5px;min-width:0}
.bb-col+.bb-col{border-left:1px solid var(--bborder)}
.bb-label{font-size:9px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--t2);margin-bottom:1px}
.toggle-row{display:flex;gap:5px}
.tog-opt{flex:1;padding:5px 6px;border-radius:6px;border:1.5px solid var(--border);background:var(--surface);color:var(--t2);font-size:11px;font-weight:500;transition:all .15s;text-align:center}
.tog-opt.active{border-color:var(--ab);color:var(--accent);background:var(--al)}
.f-label{font-size:10px;color:var(--t2);margin-bottom:1px}
.f-input{width:100%;padding:5px 8px;border:1.5px solid var(--border);border-radius:5px;background:var(--surface);color:var(--text);font-size:11px;outline:none;transition:border-color .15s}
.f-input:focus{border-color:var(--accent)}
.f-input::placeholder{color:var(--t3)}
.hora-row{display:flex;gap:5px}
.hora-row .f-input{flex:1}
.moto-wrap{display:flex;gap:4px;flex-wrap:wrap}
.moto-btn{padding:3px 8px;border-radius:4px;border:1px solid var(--border);background:var(--surface);color:var(--t2);font-size:10px;transition:all .15s}
.moto-btn.active{border-color:var(--ab);color:var(--accent);background:var(--al)}

/* ── RIGHT PANEL (ticket) ── */
.ticket{width:380px;flex-shrink:0;background:var(--dk);display:flex;flex-direction:column;overflow:hidden}
.t-head{padding:9px 14px;border-bottom:1px solid var(--tl);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.t-num-lbl{font-size:10px;color:var(--tt2);font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.t-num{font-size:15px;font-weight:700;color:var(--tt);font-variant-numeric:tabular-nums}
.t-clear{font-size:11px;color:var(--tt2);padding:3px 8px;border-radius:5px;border:1px solid var(--tl);background:none;transition:all .15s}
.t-clear:hover{color:#e57373;border-color:#e57373}
.t-scroll{flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(128,128,128,.2) transparent;min-height:0}
.t-bottom{flex-shrink:0;border-top:2px solid var(--tl);background:var(--dk2);display:flex;flex-direction:column}

/* Items */
.t-empty{padding:24px 14px;text-align:center;color:var(--tt2);font-size:12px;display:flex;flex-direction:column;align-items:center;gap:8px}
.t-empty-icon{font-size:26px;opacity:.35}
.line{display:flex;align-items:flex-start;gap:8px;padding:7px 14px;border-bottom:1px solid var(--tl)}
.line:hover{background:rgba(128,128,128,.04)}
.li{flex:1;min-width:0}
.li-name{font-size:12px;font-weight:500;color:var(--tt);line-height:1.2}
.li-nota{font-size:10px;color:var(--accent);margin-top:1px}
.li-unit{font-size:10px;color:var(--tt2);margin-top:1px;font-variant-numeric:tabular-nums}
.qty{display:flex;align-items:center;background:var(--dk);border-radius:5px;overflow:hidden;flex-shrink:0;border:1px solid var(--tl)}
.q-btn{width:22px;height:22px;background:none;border:none;color:var(--tt2);font-size:13px;display:flex;align-items:center;justify-content:center;transition:color .1s}
.q-btn:hover{color:var(--tt)}
.q-btn.rm:hover{color:#e57373}
.q-val{font-size:11px;font-weight:700;color:var(--tt);width:18px;text-align:center;font-variant-numeric:tabular-nums}
.li-total{font-size:12px;font-weight:600;color:var(--tt);font-variant-numeric:tabular-nums;min-width:44px;text-align:right;flex-shrink:0;margin-top:2px}

/* Fixed bottom */
.iva-row{display:flex;align-items:center;gap:8px;padding:6px 13px;border-bottom:1px solid var(--tl)}
.iva-lbl{font-size:11px;color:var(--tt2);flex:1}
.iva-badge{font-size:10px;padding:2px 6px;border-radius:4px}
.iva-on{background:rgba(39,174,96,.15);color:#4ade80}
.iva-off{background:rgba(128,128,128,.1);color:var(--tt3)}
.switch{position:relative;width:34px;height:18px}
.switch input{opacity:0;width:0;height:0}
.slider{position:absolute;inset:0;background:var(--dk3);border-radius:18px;cursor:pointer;transition:background .2s}
.slider::before{content:'';position:absolute;height:12px;width:12px;left:3px;bottom:3px;background:#888;border-radius:50%;transition:all .2s}
.switch input:checked+.slider{background:var(--accent)}
.switch input:checked+.slider::before{transform:translateX(16px);background:#fff}

.totals-row{display:flex;align-items:center;padding:5px 13px;gap:10px;border-bottom:1px solid var(--tl)}
.tot-lines{flex:1;display:flex;flex-direction:column;gap:1px}
.tot-item{display:flex;justify-content:space-between;font-size:10px;color:var(--tt2);font-variant-numeric:tabular-nums}
.tot-grand{font-size:15px;font-weight:700;color:var(--tt);font-variant-numeric:tabular-nums;text-align:right}
.tot-bs{font-size:10px;color:var(--bs);font-variant-numeric:tabular-nums;text-align:right}

.bcv-conv{display:flex;align-items:center;gap:6px;padding:5px 13px;border-bottom:1px solid var(--tl)}
.bcv-lbl{font-size:10px;color:var(--tt2);white-space:nowrap}
.bcv-inp{width:68px;padding:3px 5px;border:1px solid var(--tl);border-radius:5px;background:var(--dk);color:var(--tt);font-size:11px;text-align:right;outline:none;font-variant-numeric:tabular-nums}
.bcv-inp:focus{border-color:var(--ab)}
.vdiv{width:1px;height:20px;background:var(--tl)}
.c-sym{font-size:11px;color:var(--tt2);font-weight:600}
.c-inp{flex:1;padding:3px 5px;border:1px solid var(--tl);border-radius:5px;background:var(--dk);color:var(--tt);font-size:11px;outline:none;font-variant-numeric:tabular-nums;min-width:0}
.c-inp:focus{border-color:var(--ab)}
.c-arr{font-size:12px;color:var(--tt2)}

.pay-sec{padding:6px 13px 4px}
.pay-lbl{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--tt2);margin-bottom:4px}
.pay-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.pay-btn{padding:5px 3px;border:1.5px solid var(--tl);border-radius:6px;background:none;color:var(--tt2);font-size:10px;font-weight:500;display:flex;flex-direction:column;align-items:center;gap:2px;transition:all .15s}
.pay-btn.active{border-color:var(--ab);color:var(--accent);background:var(--al)}
.pay-btn:hover:not(.active){border-color:var(--tt3);color:var(--tt)}
.pay-ico{font-size:13px}
.cxp-note{margin:0 10px 4px;padding:5px 8px;border-radius:6px;background:rgba(41,128,185,.12);border:1px solid rgba(41,128,185,.3);color:#7ec8e3;font-size:10px;line-height:1.35}
.cxc-wrap{padding:2px 13px 4px;display:flex;flex-direction:column;gap:1px}
.cxc-lbl{font-size:9px;color:var(--tt2)}
.t-inp-dark{width:100%;padding:4px 7px;border:1.5px solid var(--tl);border-radius:5px;background:var(--dk);color:var(--tt);font-size:11px;outline:none;transition:border-color .15s}
.t-inp-dark:focus{border-color:var(--ab)}
.cobrar-wrap{padding:7px 12px 10px}
.cobrar-btn{width:100%;padding:11px;background:var(--accent);color:#1c1c1e;border:none;border-radius:9px;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;transition:opacity .15s,transform .1s;font-variant-numeric:tabular-nums}
.cobrar-btn:hover:not(:disabled){opacity:.9}
.cobrar-btn:active:not(:disabled){transform:scale(.98)}
.cobrar-btn:disabled{background:var(--dk3);color:var(--tt2);cursor:not-allowed;border:1px solid var(--tl)}

/* Confirm overlay */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100;display:flex;align-items:center;justify-content:center}
.ov-card{background:var(--dk);border:1px solid var(--tl);border-radius:14px;padding:20px;min-width:260px;max-width:340px;width:90%;display:flex;flex-direction:column;gap:10px;text-align:center}
.cf-icon{font-size:44px}
.cf-title{font-size:17px;font-weight:700;color:var(--tt)}
.cf-detail{font-size:12px;color:var(--tt2);line-height:1.6}
.cf-detail strong{color:var(--tt)}
.cf-ok{padding:10px;background:var(--accent);color:#1c1c1e;border:none;border-radius:8px;font-size:13px;font-weight:700}
.cf-ok:hover{opacity:.9}

@media(max-width:700px){.pos-body{flex-direction:column}.ticket{width:100%;border-left:none;border-top:1px solid var(--tl)}.left-panel{min-width:unset}.bottom-bar{flex-direction:column}}
`;

export default function CajaClient() {
  const [theme, setTheme] = useState<Theme>(() => {
    try { const t = localStorage.getItem("caja_theme"); if (t === "dark" || t === "light" || t === "azul" || t === "beige") return t; } catch { /* ignore */ }
    return "dark";
  });

  function changeTheme(t: Theme) { setTheme(t); try { localStorage.setItem("caja_theme", t); } catch { /* ignore */ } }
  const [productos, setProductos] = useState<Producto[]>([]);
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [bcvRate, setBcvRate] = useState(1);
  const [bcvInput, setBcvInput] = useState("1.00");

  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [catActiva, setCatActiva] = useState("Tradicional");
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [payMethod, setPayMethod] = useState("EFECTIVO_BS");
  const [entrega, setEntrega] = useState<"LOCAL" | "DELIVERY">("LOCAL");
  const [direccion, setDireccion] = useState("");
  const [horaEntrega, setHoraEntrega] = useState("");
  const [horaPreparacion, setHoraPreparacion] = useState("");
  const [horaRetiro, setHoraRetiro] = useState("");
  const [motorizadoId, setMotorizadoId] = useState<number | null>(null);
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTel, setClienteTel] = useState("");
  const [ivaActivo, setIvaActivo] = useState(false);
  const [convUsd, setConvUsd] = useState("");
  const [convBs, setConvBs] = useState("");
  const [fechaCxC, setFechaCxC] = useState("");
  const [confirmOverlay, setConfirmOverlay] = useState<{ icon: string; titulo: string; detalle: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const ticketRef = useRef(47);
  const [ticketNum, setTicketNum] = useState(47);
  const clockRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    fetch("/api/productos?grupo=PARA_LA_VENTA")
      .then((r) => r.json())
      .then((data: Record<string, unknown>[]) => {
        setProductos(data.map((p) => ({
          id: p.id as number,
          nombre: p.nombre as string,
          precioVenta: Number(p.precioVenta ?? 0),
          categoriaNombre: (p.categoriaNombre ?? null) as string | null,
          lineaNombre: (p.lineaNombre ?? null) as string | null,
          extras: ((p.extras ?? []) as Record<string, unknown>[]).map((e) => ({
            id: e.id as number,
            nombre: e.nombre as string,
            precioAdicional: Number(e.precioAdicional ?? 0),
          })),
        })));
      }).catch(() => {});

    fetch("/api/motorizados")
      .then((r) => r.json())
      .then((data: Record<string, unknown>[]) => {
        setMotorizados(data.filter((m) => m.activo !== false) as unknown as Motorizado[]);
      }).catch(() => {});

    fetch("/api/tasa-bcv")
      .then((r) => r.json())
      .then((d) => { if (d.tasa) { setBcvRate(Number(d.tasa)); setBcvInput(Number(d.tasa).toFixed(2)); } })
      .catch(() => {});

    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((cfg: Record<string, string>) => { setIvaActivo(cfg.iva_activo === "true"); })
      .catch(() => {});

    const tick = () => {
      if (clockRef.current) {
        clockRef.current.textContent = new Date().toLocaleString("es-VE", {
          timeZone: "America/Caracas", day: "2-digit", month: "2-digit",
          year: "numeric", hour: "2-digit", minute: "2-digit",
        });
      }
    };
    tick();
    const iv = setInterval(tick, 30000);
    return () => clearInterval(iv);
  }, []);

  const subtotal = carrito.reduce((s, c) => s + (c.precio + c.extraPrecio) * c.qty, 0);
  const ivaAmt = ivaActivo ? subtotal * 0.16 : 0;
  const total = subtotal + ivaAmt;
  const isCxP = CXP_METHODS.includes(payMethod);
  const FILTROS = [
    { key: "Todos",              label: "Todos" },
    { key: "Premium",            label: "Premium" },
    { key: "Especiales",         label: "Especiales" },
    { key: "Tradicional",        label: "Tradicional" },
    { key: "Bandejas",           label: "Bandejas y Experiencias" },
    { key: "Combos",             label: "Combos y Pack" },
    { key: "Raciones",           label: "Raciones" },
    { key: "Bebidas",            label: "Bebidas" },
  ] as const;
  type FiltroKey = typeof FILTROS[number]["key"];

  function matchFiltro(p: Producto, key: FiltroKey): boolean {
    if (key === "Todos") return true;
    const linea = (p.lineaNombre ?? "").toLowerCase();
    const cat = (p.categoriaNombre ?? "").toLowerCase();
    if (key === "Premium")   return linea.includes("premium");
    if (key === "Especiales") return linea.includes("especial");
    if (key === "Tradicional") return linea.includes("tradicional");
    if (key === "Bandejas")  return cat.includes("bandeja") || cat.includes("experiencia");
    if (key === "Combos")    return cat.includes("combo") || cat.includes("pack");
    if (key === "Raciones")  return cat.includes("racion") || cat.includes("ración") || cat.includes("ravion") || cat.includes("ravión");
    if (key === "Bebidas")   return cat.includes("bebida");
    return false;
  }

  const cats = FILTROS.filter((f) => f.key === "Todos" || productos.some((p) => matchFiltro(p, f.key as FiltroKey)));
  const filtrados = productos.filter((p) => {
    const mc = matchFiltro(p, catActiva as FiltroKey);
    const mq = !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return mc && mq;
  });
  const POR_PAGINA = 24;
  const totalPags = catActiva === "Todos" ? Math.max(1, Math.ceil(filtrados.length / POR_PAGINA)) : 1;
  const filtradosPag = catActiva === "Todos" ? filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA) : filtrados;

  const cartMap: Record<number, number> = {};
  carrito.forEach((c) => { cartMap[c.productoId] = (cartMap[c.productoId] ?? 0) + c.qty; });

  function addToCart(prod: Producto, extra: Extra | null) {
    const extraId = extra?.id ?? null;
    setCarrito((prev) => {
      const ex = prev.find((c) => c.productoId === prod.id && c.extraId === extraId);
      if (ex) return prev.map((c) => c.uid === ex.uid ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { uid: uid(), productoId: prod.id, nombre: prod.nombre, precio: prod.precioVenta, qty: 1, extraId, extraNombre: extra?.nombre ?? null, extraPrecio: extra?.precioAdicional ?? 0 }];
    });
    setExpandedId(null);
  }
  function setQty(u: string, delta: number) {
    setCarrito((prev) => prev.map((c) => c.uid === u ? { ...c, qty: c.qty + delta } : c).filter((c) => c.qty > 0));
  }
  function clearCart() {
    setCarrito([]);
    ticketRef.current += 1;
    setTicketNum(ticketRef.current);
  }
  function clickProducto(prod: Producto) {
    if (prod.extras.length > 0) { setExpandedId(expandedId === prod.id ? null : prod.id); }
    else { addToCart(prod, null); }
  }

  function fromUsd(v: string) { setConvUsd(v); const n = parseFloat(v) || 0; setConvBs(n > 0 ? (n * bcvRate).toFixed(2) : ""); }
  function fromBs(v: string) { setConvBs(v); const n = parseFloat(v) || 0; setConvUsd(n > 0 ? (n / bcvRate).toFixed(2) : ""); }
  function onBcv(v: string) { setBcvInput(v); setBcvRate(parseFloat(v) || 1); }

  async function cobrar() {
    if (carrito.length === 0) return;
    if (entrega === "DELIVERY" && (!horaEntrega || !horaPreparacion)) {
      alert("Indica la hora de entrega y de preparación para el delivery.");
      return;
    }
    setGuardando(true);
    try {
      const body = {
        fecha: today(),
        tasaDelDia: bcvRate,
        cliente: clienteNombre.trim() || "Consumidor Final",
        clienteTelefono: clienteTel || null,
        direccion: entrega === "DELIVERY" ? direccion || null : null,
        modoEntrega: entrega,
        tipoDelivery: entrega === "DELIVERY" ? "MOTORIZADO" : null,
        motorizadoId: entrega === "DELIVERY" ? motorizadoId : null,
        costoDelivery: 0,
        despachoPendiente: entrega === "DELIVERY",
        horaEntrega: entrega === "DELIVERY" ? horaEntrega || null : null,
        horaPreparacion: entrega === "DELIVERY" ? horaPreparacion || null : null,
        horaRetiro: entrega === "DELIVERY" ? horaRetiro || null : null,
        items: carrito.map((c) => ({ productoId: c.productoId, cantidad: c.qty, extraId: c.extraId ?? undefined })),
        pagos: isCxP ? [] : [{ metodo: payMethod, monto: total }],
        fechaLimitePago: isCxP ? (fechaCxC || null) : null,
      };
      const res = await fetch("/api/ventas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error ?? "Error al registrar la venta"); return; }
      const payLabel = PAY_OPTS.find((p) => p.key === payMethod)?.label ?? payMethod;
      const det = [
        `Total: <strong>${fmt(total)}</strong> (${fmtBs(total, bcvRate)})`,
        `Método: <strong>${payLabel}</strong>`,
        clienteNombre ? `Cliente: <strong>${clienteNombre}</strong>` : "",
        entrega === "DELIVERY" && horaEntrega ? `Entrega: <strong>${horaEntrega}</strong>` : "",
        entrega === "DELIVERY" && motorizadoId
          ? `Motorizado: <strong>${motorizados.find((m) => m.id === motorizadoId)?.nombre ?? ""}</strong>`
          : "",
      ].filter(Boolean).join("<br>");
      setConfirmOverlay({ icon: isCxP ? "📋" : "✅", titulo: isCxP ? "CxC generada" : "Cobro registrado", detalle: det });
      clearCart();
      setClienteNombre(""); setClienteTel(""); setDireccion("");
      setHoraEntrega(""); setHoraPreparacion(""); setHoraRetiro("");
      setMotorizadoId(null); setFechaCxC(""); setPayMethod("EFECTIVO_BS");
    } finally { setGuardando(false); }
  }

  const ticketLabel = `#${String(ticketNum).padStart(4, "0")}`;
  const canCobrar = carrito.length > 0 && !guardando && (!isCxP || !!fechaCxC) && (entrega === "LOCAL" || (!!horaEntrega && !!horaPreparacion));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `:root{${THEME_VARS[theme]}}${CSS}` }} />

      <div className="pos">
        {/* Topbar */}
        <div className="topbar">
          <span className="tb-brand">VentasHG</span>
          <span className="tb-sep">›</span>
          <span className="tb-title">Caja Rápida</span>
          <div className="tb-space" />
          <div className="theme-btns">
            {THEMES.map((t) => (
              <button key={t.key} className={`theme-btn${theme === t.key ? " active" : ""}`} onClick={() => changeTheme(t.key)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <span className="tb-clock" ref={clockRef} />
        </div>

        <div className="pos-body">
          {/* ══ LEFT PANEL ══ */}
          <div className="left-panel">
            <div className="cat-head">
              <div className="search-wrap">
                <span className="s-icon">⌕</span>
                <input className="search-input" type="text" placeholder="Buscar producto…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              </div>
              <div className="cats">
                {cats.map((f) => (
                  <button key={f.key} className={`cat-pill${catActiva === f.key ? " active" : ""}`} onClick={() => { setCatActiva(f.key); setPagina(1); }}>{f.label}</button>
                ))}
              </div>
            </div>

            <div className="product-grid">
              {filtrados.length === 0 && (
                <div style={{ gridColumn: "1/-1", padding: "32px 0", textAlign: "center", color: "var(--t3)", fontSize: 12 }}>
                  {productos.length === 0 ? "Cargando productos…" : "Sin resultados"}
                </div>
              )}
              {filtradosPag.map((prod) => {
                const qty = cartMap[prod.id] ?? 0;
                const isExp = expandedId === prod.id;
                return (
                  <div key={prod.id} className={`p-card${qty > 0 ? " in-cart" : ""}`} style={{ position: "relative" }}>
                    <div onClick={() => clickProducto(prod)}>
                      <div className="p-thumb">
                        {qty > 0 && <span className="p-badge">{qty}</span>}
                        <span style={{ wordBreak: "break-word", overflow: "hidden" }}>{prod.nombre}</span>
                      </div>
                      <div className="p-info">
                        <div className="p-name">{prod.nombre}</div>
                        <div className="p-row">
                          <span className="p-price">{fmt(prod.precioVenta)}</span>
                          {prod.extras.length > 0 && <span className="p-opts-tag">opciones ▾</span>}
                        </div>
                      </div>
                    </div>
                    {isExp && (
                      <div className="p-extras-overlay" onClick={(e) => e.stopPropagation()}>
                        <div className="p-extras-label">{fmt(prod.precioVenta)} · Preparación</div>
                        <div className="p-extras-wrap">
                          {prod.extras.map((ex) => (
                            <button key={ex.id} className="p-extra-btn" onClick={() => addToCart(prod, ex)}>
                              {ex.nombre}{ex.precioAdicional > 0 ? ` +${fmt(ex.precioAdicional)}` : ""}
                            </button>
                          ))}
                          <button className="p-extra-sin" onClick={() => addToCart(prod, null)}>Sin preferencia</button>
                        </div>
                        <button className="p-extra-close" onClick={() => setExpandedId(null)}>✕</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {catActiva === "Todos" && totalPags > 1 && (
                <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0" }}>
                  <button className="pg-btn" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>‹</button>
                  <span style={{ fontSize: 11, color: "var(--t2)" }}>{pagina} / {totalPags}</span>
                  <button className="pg-btn" disabled={pagina === totalPags} onClick={() => setPagina((p) => p + 1)}>›</button>
                </div>
              )}
            </div>

            {/* ── Bottom bar: Entrega | Cliente ── */}
            <div className="bottom-bar">
              {/* Entrega */}
              <div className="bb-col">
                <div className="bb-label">Entrega</div>
                <div className="toggle-row">
                  <button className={`tog-opt${entrega === "LOCAL" ? " active" : ""}`} onClick={() => setEntrega("LOCAL")}>🏠 Local</button>
                  <button className={`tog-opt${entrega === "DELIVERY" ? " active" : ""}`} onClick={() => setEntrega("DELIVERY")}>🛵 Delivery</button>
                </div>
                {entrega === "DELIVERY" && (
                  <>
                    <div>
                      <div className="f-label">Dirección</div>
                      <input className="f-input" type="text" placeholder="Av. Principal…" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                    </div>
                    <div className="hora-row">
                      <div style={{ flex: 1 }}>
                        <div className="f-label">Hora entrega *</div>
                        <input className="f-input" type="time" value={horaEntrega} onChange={(e) => setHoraEntrega(e.target.value)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="f-label">Hora preparación *</div>
                        <input className="f-input" type="time" value={horaPreparacion} onChange={(e) => setHoraPreparacion(e.target.value)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="f-label">Hora retiro</div>
                        <input className="f-input" type="time" value={horaRetiro} onChange={(e) => setHoraRetiro(e.target.value)} />
                      </div>
                    </div>
                    {motorizados.length > 0 && (
                      <div>
                        <div className="f-label">Motorizado</div>
                        <div className="moto-wrap">
                          {motorizados.map((m) => (
                            <button key={m.id} className={`moto-btn${motorizadoId === m.id ? " active" : ""}`}
                              onClick={() => setMotorizadoId(motorizadoId === m.id ? null : m.id)}>
                              {m.nombre}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Cliente */}
              <div className="bb-col">
                <div className="bb-label">Cliente</div>
                <div>
                  <div className="f-label">Nombre</div>
                  <input className="f-input" type="text" placeholder="Consumidor Final" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} />
                </div>
                <div>
                  <div className="f-label">Teléfono</div>
                  <input className="f-input" type="tel" placeholder="0414-000-0000" value={clienteTel} onChange={(e) => setClienteTel(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* ══ RIGHT PANEL (ticket) ══ */}
          <div className="ticket">
            <div className="t-head">
              <div>
                <div className="t-num-lbl">Ticket</div>
                <div className="t-num">{ticketLabel}</div>
              </div>
              <button className="t-clear" onClick={clearCart}>Limpiar</button>
            </div>

            <div className="t-scroll">
              {carrito.length === 0 ? (
                <div className="t-empty">
                  <span className="t-empty-icon">🛒</span>
                  <span>Toca un producto para agregar</span>
                </div>
              ) : carrito.map((c) => (
                <div key={c.uid} className="line">
                  <div className="li">
                    <div className="li-name">{c.nombre}</div>
                    {c.extraNombre && <div className="li-nota">· {c.extraNombre}</div>}
                    <div className="li-unit">{fmt(c.precio + c.extraPrecio)} c/u</div>
                  </div>
                  <div className="qty">
                    <button className="q-btn rm" onClick={() => setQty(c.uid, -1)}>−</button>
                    <span className="q-val">{c.qty}</span>
                    <button className="q-btn" onClick={() => setQty(c.uid, +1)}>+</button>
                  </div>
                  <div className="li-total">{fmt((c.precio + c.extraPrecio) * c.qty)}</div>
                </div>
              ))}
            </div>

            <div className="t-bottom">
              {/* IVA */}
              <div className="iva-row">
                <span className="iva-lbl">IVA (16%)</span>
                <span className={`iva-badge ${ivaActivo ? "iva-on" : "iva-off"}`}>{ivaActivo ? "Activado" : "Desactivado"}</span>
                <label className="switch">
                  <input type="checkbox" checked={ivaActivo} onChange={(e) => setIvaActivo(e.target.checked)} />
                  <span className="slider" />
                </label>
              </div>

              {/* Totals */}
              <div className="totals-row">
                <div className="tot-lines">
                  <div className="tot-item"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                  {ivaActivo && <div className="tot-item"><span>IVA 16%</span><span>{fmt(ivaAmt)}</span></div>}
                </div>
                <div>
                  <div className="tot-grand">{fmt(total)}</div>
                  <div className="tot-bs">{fmtBs(total, bcvRate)}</div>
                </div>
              </div>

              {/* BCV + Converter */}
              <div className="bcv-conv">
                <span className="bcv-lbl">Bs/$</span>
                <input className="bcv-inp" type="number" step="0.01" min="1" value={bcvInput} onChange={(e) => onBcv(e.target.value)} />
                <div className="vdiv" />
                <span className="c-sym">$</span>
                <input className="c-inp" type="number" placeholder="0.00" value={convUsd} onChange={(e) => fromUsd(e.target.value)} />
                <span className="c-arr">⇄</span>
                <span className="c-sym">Bs</span>
                <input className="c-inp" type="number" placeholder="0,00" value={convBs} onChange={(e) => fromBs(e.target.value)} />
              </div>

              {/* Pay methods */}
              <div className="pay-sec">
                <div className="pay-lbl">Forma de Pago</div>
                <div className="pay-grid">
                  {PAY_OPTS.map((p) => (
                    <button key={p.key} className={`pay-btn${payMethod === p.key ? " active" : ""}`} onClick={() => setPayMethod(p.key)}>
                      <span className="pay-ico">{p.icon}</span>{p.label}
                    </button>
                  ))}
                </div>
              </div>

              {isCxP && (
                <>
                  <div className="cxp-note">ℹ️ Genera <strong>Cuenta por Cobrar</strong> pendiente.</div>
                  <div className="cxc-wrap">
                    <div className="cxc-lbl">Fecha límite de pago</div>
                    <input className="t-inp-dark" type="date" value={fechaCxC} onChange={(e) => setFechaCxC(e.target.value)} style={{ fontSize: 11 }} />
                  </div>
                </>
              )}

              <div className="cobrar-wrap">
                <button className="cobrar-btn" disabled={!canCobrar} onClick={cobrar}>
                  <span>⚡</span>
                  <span>
                    {carrito.length === 0 ? "Sin productos"
                      : guardando ? "Registrando…"
                      : isCxP ? `Generar CxC · ${fmt(total)}`
                      : `Cobrar ${fmt(total)}`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {confirmOverlay && (
        <div className="overlay">
          <div className="ov-card">
            <div className="cf-icon">{confirmOverlay.icon}</div>
            <div className="cf-title">{confirmOverlay.titulo}</div>
            <div className="cf-detail" dangerouslySetInnerHTML={{ __html: confirmOverlay.detalle }} />
            <button className="cf-ok" onClick={() => setConfirmOverlay(null)}>Nueva venta</button>
          </div>
        </div>
      )}
    </>
  );
}
