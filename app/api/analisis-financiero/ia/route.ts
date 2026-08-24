import { NextRequest, NextResponse } from "next/server";
import { getSesionFromRequest } from "@/lib/auth";
import { callLLM } from "@/lib/llm/llm-service";

export const dynamic = "force-dynamic";

type IATipo = "rentabilidad" | "caja" | "eficiencia" | "asesor";

const SYSTEM_BASE = `Eres un asesor financiero especializado en análisis de negocios PYME.
Tu respuesta debe basarse ÚNICAMENTE en los datos financieros proporcionados en el contexto.
NO hagas referencias a datos externos, estimaciones de mercado, ni información que no esté en el contexto.
Si no hay suficientes datos para responder, dilo claramente.
Responde en español. Sé conciso, directo y accionable.
Usa formato: hallazgos numerados con emoji de semáforo (✅ bueno, ⚠️ atención, 🔴 crítico).`;

function buildPromptRentabilidad(ctx: Record<string, unknown>): string {
  return `Analiza la rentabilidad del negocio con estos datos:

${JSON.stringify(ctx, null, 2)}

Diagnóstica:
1. Salud del margen bruto vs benchmark F&B (>55% = bueno, >60% = excelente)
2. Tendencia de compresión o expansión de márgenes mes a mes
3. Peso de COGS sobre ingresos y si está en rango óptimo
4. Impacto de cortesías sobre la rentabilidad
5. Un índice de salud financiera del 0 al 100 con justificación

Termina con 3 acciones concretas para mejorar la rentabilidad basadas en los datos.`;
}

function buildPromptCaja(ctx: Record<string, unknown>): string {
  return `Analiza la presión de caja y liquidez del negocio:

${JSON.stringify(ctx, null, 2)}

Diagnóstica:
1. Días de runway estimados (ingresos mensuales / compromisos pendientes)
2. Semanas con mayor presión de pagos
3. Concentración de riesgo: ¿hay demasiado comprometido en un solo período?
4. Ratio obligaciones próximas / ingreso diario promedio
5. Nivel de riesgo: BAJO / MEDIO / ALTO con justificación

Termina con 3 acciones para mejorar la posición de liquidez.`;
}

function buildPromptEficiencia(ctx: Record<string, unknown>): string {
  return `Analiza la eficiencia operativa del negocio:

${JSON.stringify(ctx, null, 2)}

Diagnóstica:
1. Ingreso por empleado (si hay datos de nómina y número de empleados)
2. Ratio nómina/ingresos vs benchmark F&B (<15% = óptimo)
3. Estructura de costos fijos vs variables y su impacto en el punto de equilibrio
4. Eficiencia del capital: cortesías como % de egresos totales
5. Índice de eficiencia operativa del 0 al 100

Termina con 3 oportunidades concretas de optimización de costos.`;
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await request.json()) as {
    tipo: IATipo;
    contexto: Record<string, unknown>;
    pregunta?: string;
    toggles?: string[];
  };

  if (!body.tipo || !body.contexto) {
    return NextResponse.json({ error: "tipo y contexto requeridos" }, { status: 400 });
  }

  let prompt: string;

  switch (body.tipo) {
    case "rentabilidad":
      prompt = buildPromptRentabilidad(body.contexto);
      break;
    case "caja":
      prompt = buildPromptCaja(body.contexto);
      break;
    case "eficiencia":
      prompt = buildPromptEficiencia(body.contexto);
      break;
    case "asesor": {
      if (!body.pregunta) {
        return NextResponse.json({ error: "pregunta requerida para el asesor" }, { status: 400 });
      }
      const togglesActivos = body.toggles?.join(", ") ?? "general";
      prompt = `Contexto financiero del negocio (${togglesActivos}):

${JSON.stringify(body.contexto, null, 2)}

Pregunta del usuario: ${body.pregunta}

Responde basándote SOLO en los datos del contexto. Si la pregunta está fuera del ámbito financiero/operativo del negocio, responde: "Esta consulta está fuera del ámbito de análisis del negocio."`;
      break;
    }
    default:
      return NextResponse.json({ error: "tipo no reconocido" }, { status: 400 });
  }

  try {
    const result = await callLLM(prompt, {
      system: SYSTEM_BASE,
      maxTokens: 1200,
      context: `analisis-financiero-${body.tipo}`,
    });

    return NextResponse.json({
      texto: result.text,
      provider: result.provider,
      tokens: result.tokens,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    if (msg.includes("LLM_NO_KEYS")) {
      return NextResponse.json(
        { error: "No hay API keys de IA configuradas. Configure una clave en Admin → IA." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
