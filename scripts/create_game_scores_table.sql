-- Create game_scores table for leaderboards
CREATE TABLE IF NOT EXISTS game_scores (
  id SERIAL PRIMARY KEY,
  player_name VARCHAR(50) NOT NULL,
  game_name VARCHAR(50) NOT NULL,
  score INTEGER NOT NULL,
  level INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_game_name CHECK (game_name IN ('brickbreaker', 'snake', 'parachute'))
);

-- Create index for faster leaderboard queries
CREATE INDEX IF NOT EXISTS idx_game_scores_game_score ON game_scores(game_name, score DESC);
CREATE INDEX IF NOT EXISTS idx_game_scores_created_at ON game_scores(created_at DESC);
