-- FCM token por motorizado (notificaciones push)
ALTER TABLE motorizados ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Ubicación GPS en tiempo real (upsert por motorizado)
CREATE TABLE IF NOT EXISTS motorizado_ubicaciones (
  motorizado_id INTEGER PRIMARY KEY REFERENCES motorizados(id) ON DELETE CASCADE,
  lat            NUMERIC(10, 7) NOT NULL,
  lng            NUMERIC(10, 7) NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
