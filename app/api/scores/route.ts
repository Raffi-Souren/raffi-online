import { neon } from "@neondatabase/serverless"
import { NextResponse } from "next/server"
import { getScoreboard, parseScoreQuery, SCORE_SCHEMA_VERSION, validateScoreSubmission } from "@/lib/scoreboards"

export const dynamic = "force-dynamic"
const responseHeaders = { "Cache-Control": "no-store" }
let schemaReady: Promise<void> | null = null

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: responseHeaders })
}

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error("Score database is unavailable")
  return neon(process.env.DATABASE_URL)
}

async function ensureScoreSchema(sql: ReturnType<typeof getSql>) {
  if (!schemaReady) {
    schemaReady = (async () => {
      const [schema] = await sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = to_regclass('public.game_scores')
            AND conname = 'valid_game_name_scoreboards_v2' AND convalidated
        ) AS ready
      `
      if (schema.ready) return

      // The transaction lock serializes cold starts; the DO block rechecks after acquiring it.
      // Replacing the old CHECK widens the allowlist without deleting or rewriting any scores.
      await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(742419201)`,
        sql`
          CREATE TABLE IF NOT EXISTS public.game_scores (
            id SERIAL PRIMARY KEY,
            player_name VARCHAR(50) NOT NULL,
            game_name VARCHAR(50) NOT NULL,
            score INTEGER NOT NULL,
            level INTEGER DEFAULT 1,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          )
        `,
        sql`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conrelid = 'public.game_scores'::regclass
                AND conname = 'valid_game_name_scoreboards_v2' AND convalidated
            ) THEN
              ALTER TABLE public.game_scores DROP CONSTRAINT IF EXISTS valid_game_name;
              ALTER TABLE public.game_scores ADD CONSTRAINT valid_game_name_scoreboards_v2
                CHECK (game_name IN (
                  'snake', 'brickbreaker', 'parachute', 'block-party-brawl',
                  'borough-gp', 'dockyard', 'minesweeper', 'signal-lost'
                ));
            END IF;
          END;
          $$
        `,
        sql`CREATE INDEX IF NOT EXISTS idx_game_scores_game_score ON public.game_scores(game_name, score DESC)`,
        sql`CREATE INDEX IF NOT EXISTS idx_game_scores_created_at ON public.game_scores(created_at DESC)`,
      ])
    })().catch((error) => {
      schemaReady = null
      throw error
    })
  }
  await schemaReady
}

export async function GET(request: Request) {
  const query = parseScoreQuery(new URL(request.url).searchParams)
  if (!query.ok) return json({ error: query.error }, 400)
  const { gameName, limit, level } = query.value
  const board = getScoreboard(gameName)!
  try {
    const sql = getSql()
    await ensureScoreSchema(sql)
    // Only this allowlisted constant enters SQL as syntax; all user values remain parameters.
    const direction = sql.unsafe(board.order === "asc" ? "ASC" : "DESC")
    const scores = await sql`
      WITH best_runs AS (
        SELECT player_name, score, level, created_at, id,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(BTRIM(player_name))
            ORDER BY score ${direction}, created_at ASC, id ASC
          ) AS player_rank
        FROM public.game_scores
        WHERE game_name = ${gameName}
          AND (${level}::integer IS NULL OR level = ${level})
      )
      SELECT player_name, score, level, created_at
      FROM best_runs
      WHERE player_rank = 1
      ORDER BY score ${direction}, created_at ASC, id ASC
      LIMIT ${limit}
    `
    return json({
      scores,
      game: gameName,
      metric: board.metric,
      order: board.order,
      schemaVersion: SCORE_SCHEMA_VERSION,
    })
  } catch {
    return json({ error: "Leaderboards are temporarily unavailable. Try again shortly." }, 503)
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: "Invalid JSON submission." }, 400)
  }
  const submission = validateScoreSubmission(body)
  if (!submission.ok) return json({ error: submission.error }, 400)
  const { playerName, gameName, score, level } = submission.value
  try {
    const sql = getSql()
    await ensureScoreSchema(sql)
    const result = await sql`
      INSERT INTO public.game_scores (player_name, game_name, score, level)
      VALUES (${playerName}, ${gameName}, ${score}, ${level})
      RETURNING id, player_name, score, level, created_at
    `
    return json({ success: true, score: result[0] })
  } catch {
    return json({ error: "Couldn't save your result. Try again shortly." }, 503)
  }
}
