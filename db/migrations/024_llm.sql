CREATE TABLE IF NOT EXISTS llm_api_keys (
  id             SERIAL PRIMARY KEY,
  provider       VARCHAR(20)  NOT NULL CHECK (provider IN ('gemini', 'groq')),
  key_label      VARCHAR(80)  NOT NULL,
  api_key        TEXT         NOT NULL,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  quota_limit    INTEGER      DEFAULT NULL,
  quota_used     INTEGER      NOT NULL DEFAULT 0,
  quota_reset_at TIMESTAMPTZ  DEFAULT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_keys_provider
  ON llm_api_keys(provider, is_active);

CREATE TABLE IF NOT EXISTS llm_usage_log (
  id                SERIAL PRIMARY KEY,
  api_key_id        INTEGER REFERENCES llm_api_keys(id) ON DELETE SET NULL,
  provider          VARCHAR(20) NOT NULL,
  model             VARCHAR(60),
  prompt_tokens     INTEGER     NOT NULL DEFAULT 0,
  completion_tokens INTEGER     NOT NULL DEFAULT 0,
  total_tokens      INTEGER     NOT NULL DEFAULT 0,
  latency_ms        INTEGER,
  status            VARCHAR(20) NOT NULL CHECK (status IN ('ok', 'failback', 'error')),
  error_code        VARCHAR(40),
  context           VARCHAR(60),
  used_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_date ON llm_usage_log(used_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_key  ON llm_usage_log(api_key_id, used_at DESC);
