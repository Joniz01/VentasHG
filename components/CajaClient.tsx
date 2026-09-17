"use client";

import { useEffect, useRef, useState } from "react";

/* ── Types ── */
type Extra = { id: number; nombre: string; precioAdicional: number };
type Producto = { id: number; nombre: string; precioVenta: number; categoriaNombre: string | null; extras: Extra[] };
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
  { key: "EFECTIVO_BS",  label: "Efectivo Bs",  icon: "💵" },
  { key: "PUNTO_VENTA",  label: "Punto",         icon: "💳" },
  { key: "PAGO_MOVIL",   label: "Pago Móvil",    icon: "📱" },
  { key: "EFECTIVO_USD", label: "USD Cash",       icon: "💲" },
  { key: "CASHEA",       label: "Cashea",         icon: "📋" },
  { key: "CXC_DIRECTA",  label: "CxC",            icon: "🤝" },
] as const;

const CXP_METHODS = ["CASHEA", "CXC_DIRECTA"];

const THEMES: { key: Theme; label: string; icon: string }[] = [
  { key: "dark",  label: "Oscuro",  icon: "🌑" },
  { key: "light", label: "Claro",   icon: "☀️" },
  { key: "azul",  label: "Azul",    icon: "🔷" },
  { key: "beige", label: "Hechizo", icon: "🪙" },
];

/* ── Theme CSS vars ── */
const THEME_VARS: Record<Theme, string> = {
  dark: `
    --bg:#F5F2ED; --surface:#FFFFFF; --topbar:#1C1C1E; --topbar-text:#ccc; --topbar-border:#2e2e2e;
    --dk:#242426; --dk2:#2E2E30; --dk3:#383838;
    --accent:#C8960C; --accent-lite:rgba(200,150,12,.13); --accent-bd:#D4A820;
    --text:#1C1C1E; --text2:#78786E; --text3:#AEAE9E; --border:#E8E4DC;
    --tt:#F0EDE8; --tt2:#888880; --tt3:#555550; --ttline:#343434;
    --cat-bg:#1C1C1E; --cat-text:#fff; --bs-color:#7ec8ff;
  `,
  light: `
    --bg:#F0F0EE; --surface:#FFFFFF; --topbar:#FFFFFF; --topbar-text:#444; --topbar-border:#E0E0DC;
    --dk:#FFFFFF; --dk2:#F5F5F3; --dk3:#E8E8E5;
    --accent:#C8960C; --accent-lite:rgba(200,150,12,.1); --accent-bd:#D4A820;
    --text:#1C1C1E; --text2:#78786E; --text3:#AEAE9E; --border:#E0DDD8;
    --tt:#1C1C1E; --tt2:#78786E; --tt3:#AEAE9E; --ttline:#E0DDD8;
    --cat-bg:#1C1C1E; --cat-text:#fff; --bs-color:#1A6FA8;
  `,
  azul: `
    --bg:#EBF2FA; --surface:#FFFFFF; --topbar:#1A3A5C; --topbar-text:#BDD5EE; --topbar-border:#142E48;
    --dk:#1E3D5E; --dk2:#254B73; --dk3:#2E5A88;
    --accent:#3A9BD5; --accent-lite:rgba(58,155,213,.15); --accent-bd:#4AAEE0;
    --text:#1A2A3A; --text2:#4A6A8A; --text3:#7A9AB8; --border:#C5D9EC;
    --tt:#E8F2FA; --tt2:#8AAAC5; --tt3:#5A80A0; --ttline:#1E3550;
    --cat-bg:#1A3A5C; --cat-text:#BDD5EE; --bs-color:#7ec8ff;
  `,
  beige: `
    --bg:#FAF6EE; --surface:#FFFFFF; --topbar:#3B2416; --topbar-text:#D4B896; --topbar-border:#2A1A0E;
    --dk:#3B2416; --dk2:#4A2E1A; --dk3:#5A3A22;
    --accent:#C8960C; --accent-lite:rgba(200,150,12,.15); --accent-bd:#D4A820;
    --text:#2A1A0A; --text2:#7A5A3A; --text3:#A8845A; --border:#E8DCC8;
    --tt:#F5EAD8; --tt2:#9A7A5A; --tt3:#6A4A2A; --ttline:#2E1C0E;
    --cat-bg:#3B2416; --cat-text:#D4B896; --bs-color:#F0C860;
  `,
};

const BASE_CSS = `
html,body{height:100%;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:13px}
*,*::before,*::after{box-sizing:border-box}
button{font-family:inherit;cursor:pointer}
input{font-family:inherit}
.pos{display:flex;flex-direction:column;height:100vh;background:var(--bg)}
.topbar{background:var(--topbar);color:var(--topbar-text);height:46px;display:flex;align-items:center;gap:14px;padding:0 16px;flex-shrink:0;border-bottom:1px solid var(--topbar-border)}
.tb-brand{font-weight:700;font-size:12px;color:var(--accent);letter-spacing:.05em;text-transform:uppercase}
.tb-sep{color:var(--topbar-border)}
.tb-title{font-size:13px;font-weight:500;color:var(--topbar-text)}
.tb-space{flex:1}
.tb-meta{font-size:11px;color:var(--tt3);display:flex;gap:10px;align-items:center}
.tb-dot{width:6px;height:6px;background:var(--accent);border-radius:50%;display:inline-block;margin-right:4px}
.theme-btns{display:flex;gap:4px}
.theme-btn{padding:3px 8px;border-radius:5px;border:1px solid var(--topbar-border);background:none;color:var(--topbar-text);font-size:10px;transition:all .15s;cursor:pointer}
.theme-btn.active{border-color:var(--accent-bd);color:var(--accent)}
.pos-body{flex:1;display:flex;min-height:0;overflow:hidden}

/* ── Catalog (left, wider) ── */
.catalog{flex:1;min-width:380px;display:flex;flex-direction:column;background:var(--bg);overflow:hidden}
.cat-head{padding:10px 16px 0;display:flex;flex-direction:column;gap:8px;flex-shrink:0}
.search-wrap{position:relative}
.s-icon{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:13px;pointer-events:none}
.search-input{width:100%;padding:7px 10px 7px 28px;border:1.5px solid var(--border);border-radius:7px;font-size:12px;background:var(--surface);color:var(--text);outline:none;transition:border-color .15s}
.search-input:focus{border-color:var(--accent)}
.search-input::placeholder{color:var(--text3)}
.cats{display:flex;gap:5px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none}
.cats::-webkit-scrollbar{display:none}
.cat-pill{flex-shrink:0;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:500;cursor:pointer;border:1.5px solid var(--border);background:var(--surface);color:var(--text2);transition:all .15s;white-space:nowrap}
.cat-pill.active{background:var(--cat-bg);color:var(--cat-text);border-color:var(--cat-bg)}
.product-grid{flex:1;overflow-y:auto;padding:8px 16px 16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:9px;align-content:start;scrollbar-width:thin;scrollbar-color:var(--border) transparent}
.p-card{background:var(--surface);border:1.5px solid var(--border);border-radius:10px;overflow:hidden;cursor:pointer;transition:transform .1s,border-color .15s,box-shadow .15s;user-select:none;position:relative}
.p-card:hover{border-color:var(--accent-bd);box-shadow:0 3px 12px rgba(200,150,12,.1)}
.p-card.in-cart{border-color:var(--accent-bd)}
.p-card.expanded{border-color:var(--accent-bd);box-shadow:0 4px 16px rgba(0,0,0,.12)}
.p-img{width:100%;aspect-ratio:3/2;display:flex;align-items:center;justify-content:center;font-size:26px;background:var(--bg);position:relative}
.p-badge{position:absolute;top:5px;right:5px;background:var(--accent);color:#fff;font-size:9px;font-weight:700;width:17px;height:17px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.p-info{padding:7px 9px}
.p-name{font-size:11px;font-weight:500;color:var(--text);line-height:1.3;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.p-price{font-size:12px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums}
.p-extras-panel{padding:6px 9px 9px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:5px}
.p-extras-label{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:2px}
.p-extras-grid{display:flex;flex-wrap:wrap;gap:4px}
.p-extra-btn{padding:3px 8px;border-radius:5px;border:1.5px solid var(--border);background:var(--surface);color:var(--text2);font-size:10px;font-weight:500;transition:all .15s;cursor:pointer}
.p-extra-btn:hover{border-color:var(--accent-bd);color:var(--accent);background:var(--accent-lite)}
.p-extra-sin{padding:3px 8px;border-radius:5px;border:1.5px dashed var(--border);background:none;color:var(--text3);font-size:10px;transition:all .15s;cursor:pointer}
.p-extra-sin:hover{border-color:var(--text3);color:var(--text2)}

/* ── Ticket (right) ── */
.ticket{width:420px;flex-shrink:0;background:var(--dk);display:flex;flex-direction:column;border-left:1px solid var(--ttline);overflow:hidden}
.t-head{padding:10px 14px;border-bottom:1px solid var(--ttline);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.t-num-label{font-size:10px;color:var(--tt2);font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.t-num{font-size:15px;font-weight:700;color:var(--tt);font-variant-numeric:tabular-nums}
.t-clear-btn{font-size:11px;color:var(--tt2);padding:3px 8px;border-radius:5px;border:1px solid var(--ttline);background:none;transition:all .15s}
.t-clear-btn:hover{color:#e57373;border-color:#e57373}
.t-scroll{flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent;min-height:0}
.t-bottom{flex-shrink:0;border-top:2px solid var(--ttline);background:var(--dk2);display:flex;flex-direction:column}

/* Items */
.t-empty{padding:28px 14px;text-align:center;color:var(--tt2);font-size:12px;display:flex;flex-direction:column;align-items:center;gap:8px}
.t-empty-icon{font-size:28px;opacity:.35}
.line{display:flex;align-items:flex-start;gap:8px;padding:7px 14px;border-bottom:1px solid var(--ttline);transition:background .1s}
.line:hover{background:rgba(128,128,128,.05)}
.line-info{flex:1;min-width:0}
.line-name{font-size:12px;font-weight:500;color:var(--tt);line-height:1.2}
.line-nota{font-size:10px;color:var(--accent);margin-top:1px}
.line-unit{font-size:10px;color:var(--tt2);margin-top:1px;font-variant-numeric:tabular-nums}
.qty-ctrl{display:flex;align-items:center;background:var(--dk);border-radius:6px;overflow:hidden;flex-shrink:0;border:1px solid var(--ttline)}
.qty-btn{width:22px;height:22px;background:none;border:none;color:var(--tt2);font-size:13px;display:flex;align-items:center;justify-content:center;transition:background .1s,color .1s}
.qty-btn:hover{background:rgba(128,128,128,.1);color:var(--tt)}
.qty-btn.rm:hover{color:#e57373}
.qty-val{font-size:11px;font-weight:700;color:var(--tt);width:18px;text-align:center;font-variant-numeric:tabular-nums}
.line-total{font-size:12px;font-weight:600;color:var(--tt);font-variant-numeric:tabular-nums;min-width:44px;text-align:right;flex-shrink:0;margin-top:2px}

/* Bottom fixed area */
.iva-row{display:flex;align-items:center;gap:8px;padding:6px 14px;border-bottom:1px solid var(--ttline)}
.iva-label{font-size:11px;color:var(--tt2);flex:1}
.iva-badge{font-size:10px;padding:2px 6px;border-radius:4px}
.iva-on{background:rgba(39,174,96,.15);color:#4ade80}
.iva-off{background:rgba(128,128,128,.1);color:var(--tt3)}
.switch{position:relative;width:34px;height:18px}
.switch input{opacity:0;width:0;height:0}
.slider{position:absolute;inset:0;background:var(--dk3);border-radius:18px;cursor:pointer;transition:background .2s}
.slider::before{content:'';position:absolute;height:12px;width:12px;left:3px;bottom:3px;background:#888;border-radius:50%;transition:all .2s}
.switch input:checked+.slider{background:var(--accent)}
.switch input:checked+.slider::before{transform:translateX(16px);background:#fff}
.totals-row{display:flex;align-items:center;gap:0;padding:5px 14px;border-bottom:1px solid var(--ttline)}
.tot-sub{display:flex;flex-direction:column;gap:1px;flex:1}
.tot-item{display:flex;justify-content:space-between;font-size:10px;color:var(--tt2);font-variant-numeric:tabular-nums}
.tot-grand-row{display:flex;align-items:baseline;gap:6px}
.tot-grand{font-size:14px;font-weight:700;color:var(--tt);font-variant-numeric:tabular-nums}
.tot-bs{font-size:10px;color:var(--bs-color);font-variant-numeric:tabular-nums}
.bcv-conv-row{display:flex;align-items:center;gap:8px;padding:4px 14px;border-bottom:1px solid var(--ttline)}
.bcv-mini{display:flex;align-items:center;gap:4px;flex-shrink:0}
.bcv-lbl{font-size:10px;color:var(--tt2);white-space:nowrap}
.bcv-inp{width:68px;padding:3px 5px;border:1px solid var(--ttline);border-radius:5px;background:var(--dk);color:var(--tt);font-size:11px;text-align:right;outline:none;font-variant-numeric:tabular-nums}
.bcv-inp:focus{border-color:var(--accent-bd)}
.conv-sep{width:1px;height:22px;background:var(--ttline);margin:0 2px}
.conv-mini{display:flex;align-items:center;gap:4px;flex:1}
.conv-sym{font-size:11px;color:var(--tt2);font-weight:600}
.conv-inp{flex:1;padding:3px 5px;border:1px solid var(--ttline);border-radius:5px;background:var(--dk);color:var(--tt);font-size:11px;outline:none;font-variant-numeric:tabular-nums;min-width:0}
.conv-inp:focus{border-color:var(--accent-bd)}
.conv-arrow{font-size:12px;color:var(--tt2)}

/* Main bottom grid: entrega+cliente left | pay right */
.bottom-grid{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--ttline)}
.b-col{display:flex;flex-direction:column;gap:5px;padding:7px 10px}
.b-col+.b-col{border-left:1px solid var(--ttline)}
.b-sec-label{font-size:9px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--tt2);margin-bottom:3px}
.toggle-row{display:flex;gap:4px}
.toggle-opt{flex:1;padding:5px 4px;border-radius:6px;border:1.5px solid var(--ttline);background:none;color:var(--tt2);font-size:10px;font-weight:500;transition:all .15s;text-align:center}
.toggle-opt.active{border-color:var(--accent-bd);color:var(--accent);background:var(--accent-lite)}
.t-field-label{font-size:9px;color:var(--tt2);margin-bottom:1px}
.t-input{width:100%;padding:4px 7px;border:1.5px solid var(--ttline);border-radius:5px;background:var(--dk);color:var(--tt);font-size:11px;outline:none;transition:border-color .15s}
.t-input:focus{border-color:var(--accent-bd)}
.t-input::placeholder{color:var(--tt3)}
.moto-row{display:flex;gap:4px;flex-wrap:wrap}
.moto-btn{padding:3px 7px;border-radius:4px;border:1px solid var(--ttline);background:none;color:var(--tt2);font-size:10px;transition:all .15s}
.moto-btn.active{border-color:var(--accent-bd);color:var(--accent);background:var(--accent-lite)}
.pay-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px}
.pay-btn{padding:5px 3px;border:1.5px solid var(--ttline);border-radius:6px;background:none;color:var(--tt2);font-size:9px;font-weight:500;display:flex;flex-direction:column;align-items:center;gap:2px;transition:all .15s}
.pay-btn.active{border-color:var(--accent-bd);color:var(--accent);background:var(--accent-lite)}
.pay-btn:hover:not(.active){border-color:var(--tt3);color:var(--tt)}
.pay-icon{font-size:13px}
.cxp-note{margin:0 10px 4px;padding:5px 8px;border-radius:6px;background:rgba(41,128,185,.12);border:1px solid rgba(41,128,185,.3);color:#7ec8e3;font-size:10px;line-height:1.35}
.cxc-date-wrap{padding:2px 10px 4px;display:flex;flex-direction:column;gap:1px}
.cxc-lbl{font-size:9px;color:var(--tt2)}
.cobrar-wrap{padding:7px 12px 10px}
.cobrar-btn{width:100%;padding:11px;background:var(--accent);color:#1c1c1e;border:none;border-radius:9px;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;transition:opacity .15s,transform .1s;font-variant-numeric:tabular-nums}
.cobrar-btn:hover:not(:disabled){opacity:.9}
.cobrar-btn:active:not(:disabled){transform:scale(.98)}
.cobrar-btn:disabled{background:var(--dk3);color:var(--tt2);cursor:not-allowed;border:1px solid var(--ttline)}

/* Confirm overlay */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s}
.overlay.show{opacity:1;pointer-events:all}
.ov-card{background:var(--dk);border:1px solid var(--ttline);border-radius:14px;padding:20px;min-width:260px;max-width:340px;width:90%;display:flex;flex-direction:column;gap:10px;text-align:center}
.confirm-icon{font-size:44px}
.confirm-title{font-size:17px;font-weight:700;color:var(--tt)}
.confirm-detail{font-size:12px;color:var(--tt2);line-height:1.6}
.confirm-detail strong{color:var(--tt)}
.confirm-ok{padding:10px;background:var(--accent);color:#1c1c1e;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}
.confirm-ok:hover{opacity:.9}
@media(max-width:700px){.pos-body{flex-direction:column}.ticket{width:100%;border-left:none;border-top:1px solid var(--ttline)}.catalog{min-width:unset}.bottom-grid{grid-template-columns:1fr}}
`;

export default function CajaClient() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [bcvRate, setBcvRate] = useState(1);
  const [bcvInput, setBcvInput] = useState("1.00");

  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [catActiva, setCatActiva] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [payMethod, setPayMethod] = useState("EFECTIVO_BS");
  const [entrega, setEntrega] = useState<"LOCAL" | "DELIVERY">("LOCAL");
  const [direccion, setDireccion] = useState("");
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

  /* ── Computed ── */
  const subtotal = carrito.reduce((s, c) => s + (c.precio + c.extraPrecio) * c.qty, 0);
  const ivaAmt = ivaActivo ? subtotal * 0.16 : 0;
  const total = subtotal + ivaAmt;
  const isCxP = CXP_METHODS.includes(payMethod);
  const cats = ["Todos", ...Array.from(new Set(productos.map((p) => p.categoriaNombre ?? "Sin categoría")))];
  const filtrados = productos.filter((p) => {
    const mc = catActiva === "Todos" || (p.categoriaNombre ?? "Sin categoría") === catActiva;
    const mq = !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return mc && mq;
  });
  const cartMap: Record<number, number> = {};
  carrito.forEach((c) => { cartMap[c.productoId] = (cartMap[c.productoId] ?? 0) + c.qty; });

  /* ── Cart ── */
  function addToCart(prod: Producto, extra: Extra | null) {
    const extraId = extra?.id ?? null;
    const extraNombre = extra?.nombre ?? null;
    const extraPrecio = extra?.precioAdicional ?? 0;
    setCarrito((prev) => {
      const ex = prev.find((c) => c.productoId === prod.id && c.extraId === extraId);
      if (ex) return prev.map((c) => c.uid === ex.uid ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { uid: uid(), productoId: prod.id, nombre: prod.nombre, precio: prod.precioVenta, qty: 1, extraId, extraNombre, extraPrecio }];
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
    if (prod.extras.length > 0) {
      setExpandedId(expandedId === prod.id ? null : prod.id);
    } else {
      addToCart(prod, null);
    }
  }

  /* ── Converter ── */
  function fromUsd(v: string) { setConvUsd(v); const n = parseFloat(v) || 0; setConvBs(n > 0 ? (n * bcvRate).toFixed(2) : ""); }
  function fromBs(v: string) { setConvBs(v); const n = parseFloat(v) || 0; setConvUsd(n > 0 ? (n / bcvRate).toFixed(2) : ""); }
  function onBcvChange(v: string) { setBcvInput(v); setBcvRate(parseFloat(v) || 1); }

  /* ── Cobrar ── */
  async function cobrar() {
    if (carrito.length === 0) return;
    setGuardando(true);
    try {
      const body = {
        fecha: today(),
        tasaDelDia: bcvRate,
        cliente: clienteNombre.trim() || "Consumidor Final",
        clienteTelefono: clienteTel || null,
        direccion: entrega === "DELIVERY" ? direccion || null : null,
        modoEntrega: entrega,
        motorizadoId: entrega === "DELIVERY" ? motorizadoId : null,
        costoDelivery: 0,
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
        entrega === "DELIVERY" && motorizadoId
          ? `Motorizado: <strong>${motorizados.find((m) => m.id === motorizadoId)?.nombre ?? ""}</strong>`
          : "",
      ].filter(Boolean).join("<br>");
      setConfirmOverlay({ icon: isCxP ? "📋" : "✅", titulo: isCxP ? "CxC generada" : "Cobro registrado", detalle: det });
      clearCart();
      setClienteNombre(""); setClienteTel(""); setDireccion("");
      setMotorizadoId(null); setFechaCxC(""); setPayMethod("EFECTIVO_BS");
    } finally {
      setGuardando(false);
    }
  }

  const ticketLabel = `#${String(ticketNum).padStart(4, "0")}`;
  const themeVars = THEME_VARS[theme];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `:root{${themeVars}}${BASE_CSS}` }} />

      <div className="pos">
        {/* Topbar */}
        <div className="topbar">
          <span className="tb-brand">VentasHG</span>
          <span className="tb-sep">›</span>
          <span className="tb-title">Caja Rápida</span>
          <div className="tb-space" />
          <div className="theme-btns">
            {THEMES.map((t) => (
              <button key={t.key} className={`theme-btn${theme === t.key ? " active" : ""}`} onClick={() => setTheme(t.key)} title={t.label}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div className="tb-meta">
            <span ref={clockRef} />
          </div>
        </div>

        <div className="pos-body">
          {/* ── Catálogo ── */}
          <div className="catalog">
            <div className="cat-head">
              <div className="search-wrap">
                <span className="s-icon">⌕</span>
                <input className="search-input" type="text" placeholder="Buscar producto…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              </div>
              <div className="cats">
                {cats.map((cat) => (
                  <button key={cat} className={`cat-pill${catActiva === cat ? " active" : ""}`} onClick={() => setCatActiva(cat)}>{cat}</button>
                ))}
              </div>
            </div>

            <div className="product-grid">
              {filtrados.length === 0 && (
                <div style={{ gridColumn: "1/-1", padding: "40px 0", textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
                  {productos.length === 0 ? "Cargando productos…" : "Sin resultados"}
                </div>
              )}
              {filtrados.map((prod) => {
                const qty = cartMap[prod.id] ?? 0;
                const isExpanded = expandedId === prod.id;
                return (
                  <div
                    key={prod.id}
                    className={`p-card${qty > 0 ? " in-cart" : ""}${isExpanded ? " expanded" : ""}`}
                    style={isExpanded ? { gridColumn: "span 2" } : {}}
                  >
                    <div onClick={() => clickProducto(prod)} style={{ cursor: "pointer" }}>
                      <div className="p-img">
                        <span style={{ fontSize: isExpanded ? 22 : 26 }}>{prod.nombre.charAt(0)}</span>
                        {qty > 0 && <span className="p-badge">{qty}</span>}
                      </div>
                      <div className="p-info">
                        <div className="p-name">{prod.nombre}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div className="p-price">{fmt(prod.precioVenta)}</div>
                          {prod.extras.length > 0 && !isExpanded && (
                            <span style={{ fontSize: 9, color: "var(--accent)", fontWeight: 600 }}>opciones ▾</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && prod.extras.length > 0 && (
                      <div className="p-extras-panel">
                        <div className="p-extras-label">Selecciona preparación</div>
                        <div className="p-extras-grid">
                          {prod.extras.map((ex) => (
                            <button key={ex.id} className="p-extra-btn" onClick={() => addToCart(prod, ex)}>
                              {ex.nombre}{ex.precioAdicional > 0 ? ` +${fmt(ex.precioAdicional)}` : ""}
                            </button>
                          ))}
                          <button className="p-extra-sin" onClick={() => addToCart(prod, null)}>Sin preferencia</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Ticket ── */}
          <div className="ticket">
            <div className="t-head">
              <div>
                <div className="t-num-label">Ticket</div>
                <div className="t-num">{ticketLabel}</div>
              </div>
              <button className="t-clear-btn" onClick={clearCart}>Limpiar</button>
            </div>

            {/* Items scroll */}
            <div className="t-scroll">
              {carrito.length === 0 ? (
                <div className="t-empty">
                  <span className="t-empty-icon">🛒</span>
                  <span>Toca un producto para agregar</span>
                </div>
              ) : carrito.map((c) => (
                <div key={c.uid} className="line">
                  <div className="line-info">
                    <div className="line-name">{c.nombre}</div>
                    {c.extraNombre && <div className="line-nota">· {c.extraNombre}</div>}
                    <div className="line-unit">{fmt(c.precio + c.extraPrecio)} c/u</div>
                  </div>
                  <div className="qty-ctrl">
                    <button className="qty-btn rm" onClick={() => setQty(c.uid, -1)}>−</button>
                    <span className="qty-val">{c.qty}</span>
                    <button className="qty-btn" onClick={() => setQty(c.uid, +1)}>+</button>
                  </div>
                  <div className="line-total">{fmt((c.precio + c.extraPrecio) * c.qty)}</div>
                </div>
              ))}
            </div>

            {/* Fixed bottom */}
            <div className="t-bottom">
              {/* IVA */}
              <div className="iva-row">
                <span className="iva-label">IVA (16%)</span>
                <span className={`iva-badge ${ivaActivo ? "iva-on" : "iva-off"}`}>{ivaActivo ? "Activado" : "Desactivado"}</span>
                <label className="switch">
                  <input type="checkbox" checked={ivaActivo} onChange={(e) => setIvaActivo(e.target.checked)} />
                  <span className="slider" />
                </label>
              </div>

              {/* Totals */}
              <div className="totals-row">
                <div className="tot-sub">
                  <div className="tot-item"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                  {ivaActivo && <div className="tot-item"><span>IVA 16%</span><span>{fmt(ivaAmt)}</span></div>}
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div className="tot-grand">{fmt(total)}</div>
                  <div className="tot-bs">{fmtBs(total, bcvRate)}</div>
                </div>
              </div>

              {/* BCV + Converter */}
              <div className="bcv-conv-row">
                <div className="bcv-mini">
                  <span className="bcv-lbl">Bs/$</span>
                  <input className="bcv-inp" type="number" step="0.01" min="1" value={bcvInput} onChange={(e) => onBcvChange(e.target.value)} />
                </div>
                <div className="conv-sep" />
                <div className="conv-mini">
                  <span className="conv-sym">$</span>
                  <input className="conv-inp" type="number" placeholder="0.00" value={convUsd} onChange={(e) => fromUsd(e.target.value)} />
                  <span className="conv-arrow">⇄</span>
                  <span className="conv-sym">Bs</span>
                  <input className="conv-inp" type="number" placeholder="0,00" value={convBs} onChange={(e) => fromBs(e.target.value)} />
                </div>
              </div>

              {/* Entrega + Cliente | Pay methods */}
              <div className="bottom-grid">
                {/* Left: Entrega + Cliente */}
                <div className="b-col">
                  <div className="b-sec-label">Entrega</div>
                  <div className="toggle-row">
                    <button className={`toggle-opt${entrega === "LOCAL" ? " active" : ""}`} onClick={() => setEntrega("LOCAL")}>🏠 Local</button>
                    <button className={`toggle-opt${entrega === "DELIVERY" ? " active" : ""}`} onClick={() => setEntrega("DELIVERY")}>🛵 Delivery</button>
                  </div>
                  {entrega === "DELIVERY" && (
                    <>
                      <div>
                        <div className="t-field-label">Dirección</div>
                        <input className="t-input" type="text" placeholder="Av. Principal…" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                      </div>
                      {motorizados.length > 0 && (
                        <div>
                          <div className="t-field-label">Motorizado</div>
                          <div className="moto-row">
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
                  <div style={{ marginTop: 4 }}>
                    <div className="b-sec-label">Cliente</div>
                    <div>
                      <div className="t-field-label">Nombre</div>
                      <input className="t-input" type="text" placeholder="Consumidor Final" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} />
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <div className="t-field-label">Teléfono</div>
                      <input className="t-input" type="tel" placeholder="0414-000-0000" value={clienteTel} onChange={(e) => setClienteTel(e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Right: Pay methods */}
                <div className="b-col">
                  <div className="b-sec-label">Forma de Pago</div>
                  <div className="pay-grid">
                    {PAY_OPTS.map((p) => (
                      <button key={p.key} className={`pay-btn${payMethod === p.key ? " active" : ""}`} onClick={() => setPayMethod(p.key)}>
                        <span className="pay-icon">{p.icon}</span>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {isCxP && (
                <>
                  <div className="cxp-note">ℹ️ Genera una <strong>Cuenta por Cobrar</strong> pendiente.</div>
                  <div className="cxc-date-wrap">
                    <div className="cxc-lbl">Fecha límite de pago</div>
                    <input className="t-input" type="date" value={fechaCxC} onChange={(e) => setFechaCxC(e.target.value)} style={{ fontSize: 11 }} />
                  </div>
                </>
              )}

              <div className="cobrar-wrap">
                <button className="cobrar-btn" disabled={carrito.length === 0 || guardando || (isCxP && !fechaCxC)} onClick={cobrar}>
                  <span>⚡</span>
                  <span>
                    {carrito.length === 0 ? "Sin productos" : guardando ? "Registrando…" : isCxP ? `Generar CxC · ${fmt(total)}` : `Cobrar ${fmt(total)}`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm overlay */}
      {confirmOverlay && (
        <div className="overlay show">
          <div className="ov-card">
            <div className="confirm-icon">{confirmOverlay.icon}</div>
            <div className="confirm-title">{confirmOverlay.titulo}</div>
            <div className="confirm-detail" dangerouslySetInnerHTML={{ __html: confirmOverlay.detalle }} />
            <button className="confirm-ok" onClick={() => setConfirmOverlay(null)}>Nueva venta</button>
          </div>
        </div>
      )}
    </>
  );
}
