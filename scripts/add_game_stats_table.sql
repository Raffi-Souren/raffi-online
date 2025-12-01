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

-- Update constraint to include minesweeper
ALTER TABLE game_scores DROP CONSTRAINT IF EXISTS valid_game_name;
ALTER TABLE game_scores ADD CONSTRAINT valid_game_name 
  CHECK (game_name IN ('brickbreaker', 'snake', 'parachute', 'minesweeper'));

-- Create index for stats queries
CREATE INDEX IF NOT EXISTS idx_game_stats_player ON game_stats(player_id, game_name);
