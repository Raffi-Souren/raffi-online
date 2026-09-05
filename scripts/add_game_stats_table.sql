-- Run create_game_scores_table.sql first; both scripts preserve existing scores.
BEGIN;
SELECT pg_advisory_xact_lock(742419201);

-- Add game_stats table for tracking player statistics and unlocked levels
CREATE TABLE IF NOT EXISTS game_stats (
  id SERIAL PRIMARY KEY,
  player_id VARCHAR(100),
  game_name VARCHAR(50) NOT NULL,
  highest_level INTEGER DEFAULT 1,
  total_score INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  total_time_played INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(player_id, game_name)
);

-- Keep the expanded allowlist when this older setup script is run again.
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

-- Create index for stats queries
CREATE INDEX IF NOT EXISTS idx_game_stats_player ON game_stats(player_id, game_name);
COMMIT;
