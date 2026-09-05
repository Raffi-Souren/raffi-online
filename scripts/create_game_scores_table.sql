-- Create or upgrade scoreboards without removing existing submissions.
BEGIN;
SELECT pg_advisory_xact_lock(742419201);

CREATE TABLE IF NOT EXISTS public.game_scores (
  id SERIAL PRIMARY KEY,
  player_name VARCHAR(50) NOT NULL,
  game_name VARCHAR(50) NOT NULL,
  score INTEGER NOT NULL,
  level INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
$$;

CREATE INDEX IF NOT EXISTS idx_game_scores_game_score ON public.game_scores(game_name, score DESC);
CREATE INDEX IF NOT EXISTS idx_game_scores_created_at ON public.game_scores(created_at DESC);
COMMIT;
