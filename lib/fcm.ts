/**
 * Envía una notificación push via FCM HTTP v1 API.
 * Requiere variable de entorno: FIREBASE_SERVICE_ACCOUNT_JSON
 * (contenido JSON del service account de Firebase, en una sola línea)
 *
 * Si la variable no está configurada, la función retorna sin error
 * para que el resto del flujo continúe sin notificaciones.
 */

type FcmPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

async function getAccessToken(): Promise<string> {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON no configurado");

  const sa = JSON.parse(serviceAccountJson) as {
    client_email: string;
    private_key: string;
    project_id: string;
  };

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");

  const { createSign } = await import("crypto");
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(sa.private_key, "base64url");
  const jwt = `${header}.${payload}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = (await tokenRes.json()) as { access_token: string };
  return tokenData.access_token;
}

export async function sendPushNotification(
  fcmToken: string,
  payload: FcmPayload
): Promise<void> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON || !process.env.FIREBASE_PROJECT_ID) {
    return; // FCM no configurado — silencioso
  }

  try {
    const accessToken = await getAccessToken();
    const projectId = process.env.FIREBASE_PROJECT_ID;

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: { title: payload.title, body: payload.body },
            data: payload.data ?? {},
            android: {
              priority: "HIGH",
              notification: { sound: "default", channel_id: "pedidos" },
            },
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[FCM] Error enviando notificación:", err);
    }
  } catch (err) {
    console.error("[FCM] Error:", err);
  }
}

export async function notificarNuevoPedido(
  motorizadoId: number,
  pedidoId: number,
  cliente: string
): Promise<void> {
  const { pool } = await import("@/lib/db");
  const result = await pool.query(
    `SELECT fcm_token FROM motorizados WHERE id = $1 AND fcm_token IS NOT NULL`,
    [motorizadoId]
  );

  const fcmToken = result.rows[0]?.fcm_token;
  if (!fcmToken) return;

  await sendPushNotification(fcmToken, {
    title: "Nuevo pedido asignado",
    body: `Pedido #${pedidoId} para ${cliente}`,
    data: { pedidoId: String(pedidoId), tipo: "nuevo_pedido" },
  });
}
