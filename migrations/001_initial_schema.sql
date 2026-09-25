-- ==========================================================
-- BYE BYE GAME SHOW - COMPLETE POSTGRESQL PRODUCTION SCHEMA
-- ==========================================================

-- 1. Admin Users & RBAC
CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'OPERATOR',
    display_name VARCHAR(128) NOT NULL,
    created_at BIGINT NOT NULL,
    last_login BIGINT
);

CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);

-- 2. Auth Sessions
CREATE TABLE IF NOT EXISTS sessions (
    token VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    username VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    ip VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 3. TikTok Participants / Users Master
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    unique_id VARCHAR(64) UNIQUE NOT NULL,
    nickname VARCHAR(128) NOT NULL,
    display_name VARCHAR(128) NOT NULL,
    avatar TEXT,
    total_score BIGINT DEFAULT 0,
    total_wins INT DEFAULT 0,
    total_answers INT DEFAULT 0,
    total_correct INT DEFAULT 0,
    total_wrong INT DEFAULT 0,
    total_gifts INT DEFAULT 0,
    total_diamonds BIGINT DEFAULT 0,
    is_banned BOOLEAN DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_unique_id ON users(unique_id);
CREATE INDEX IF NOT EXISTS idx_users_score ON users(total_score DESC);

-- 4. Banned Users
CREATE TABLE IF NOT EXISTS banned_users (
    user_id VARCHAR(64) PRIMARY KEY,
    unique_id VARCHAR(64) NOT NULL,
    reason TEXT,
    banned_by VARCHAR(64) NOT NULL,
    banned_at BIGINT NOT NULL
);

-- 5. Games & Broadcast Sessions
CREATE TABLE IF NOT EXISTS games (
    id VARCHAR(64) PRIMARY KEY,
    room_id VARCHAR(64),
    tiktok_username VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    started_at BIGINT NOT NULL,
    ended_at BIGINT,
    total_rounds INT DEFAULT 0,
    peak_viewers INT DEFAULT 0,
    total_likes BIGINT DEFAULT 0,
    total_shares BIGINT DEFAULT 0,
    total_diamonds BIGINT DEFAULT 0
);

-- 6. Game Rounds
CREATE TABLE IF NOT EXISTS rounds (
    id VARCHAR(64) PRIMARY KEY,
    game_id VARCHAR(64) REFERENCES games(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'LOBBY',
    question_id VARCHAR(64),
    target_participants INT DEFAULT 36,
    started_at BIGINT NOT NULL,
    ended_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_rounds_game_round ON rounds(game_id, round_number);

-- 7. Question Bank
CREATE TABLE IF NOT EXISTS questions (
    id VARCHAR(64) PRIMARY KEY,
    category VARCHAR(64) NOT NULL,
    subcategory VARCHAR(64),
    difficulty VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
    type VARCHAR(32) NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    question TEXT NOT NULL,
    options JSONB DEFAULT '[]'::jsonb,
    answers JSONB DEFAULT '[]'::jsonb,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    time_limit INT DEFAULT 15,
    points INT DEFAULT 100,
    image TEXT,
    audio TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    language VARCHAR(10) DEFAULT 'ar',
    enabled BOOLEAN DEFAULT TRUE,
    usage_count INT DEFAULT 0,
    last_used_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);

-- 8. Question Sets
CREATE TABLE IF NOT EXISTS question_sets (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(128) NOT NULL,
    description TEXT,
    category VARCHAR(64),
    question_ids JSONB DEFAULT '[]'::jsonb,
    created_at BIGINT NOT NULL
);

-- 9. Active Participants per Round
CREATE TABLE IF NOT EXISTS participants (
    id VARCHAR(64) PRIMARY KEY,
    round_id VARCHAR(64) NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT,
    score INT DEFAULT 0,
    rank INT,
    status VARCHAR(32) DEFAULT 'ACTIVE',
    eligible_for_draw BOOLEAN DEFAULT TRUE,
    joined_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_participants_round ON participants(round_id);

-- 10. Answers Submitted
CREATE TABLE IF NOT EXISTS answers (
    id VARCHAR(64) PRIMARY KEY,
    round_id VARCHAR(64) NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    question_id VARCHAR(64) NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    answer_raw TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    attempt_number INT NOT NULL DEFAULT 1,
    speed_seconds FLOAT NOT NULL DEFAULT 0,
    points_awarded INT NOT NULL DEFAULT 0,
    submitted_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_answers_round_question ON answers(round_id, question_id);

-- 11. Scores & Points Ledger
CREATE TABLE IF NOT EXISTS scores (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    round_id VARCHAR(64) REFERENCES rounds(id) ON DELETE SET NULL,
    points INT NOT NULL,
    reason VARCHAR(64) NOT NULL,
    awarded_at BIGINT NOT NULL
);

-- 12. TikTok Gifts Ledger & Events
CREATE TABLE IF NOT EXISTS gifts (
    id VARCHAR(64) PRIMARY KEY,
    gift_id VARCHAR(64) NOT NULL,
    gift_name VARCHAR(128) NOT NULL,
    diamond_cost INT NOT NULL DEFAULT 1,
    action_type VARCHAR(64) DEFAULT 'SCORE_BONUS',
    action_value INT DEFAULT 100,
    enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS gift_events (
    id VARCHAR(64) PRIMARY KEY,
    gift_id VARCHAR(64) NOT NULL,
    gift_name VARCHAR(128) NOT NULL,
    sender_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gift_count INT NOT NULL DEFAULT 1,
    diamonds BIGINT NOT NULL DEFAULT 0,
    points_awarded INT DEFAULT 0,
    received_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gift_events_sender ON gift_events(sender_user_id);

-- 13. Chat Messages Ledger
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    is_command BOOLEAN DEFAULT FALSE,
    command_name VARCHAR(32),
    timestamp BIGINT NOT NULL
);

-- 14. Game Events History
CREATE TABLE IF NOT EXISTS game_events (
    id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(64) NOT NULL,
    source VARCHAR(32) NOT NULL,
    user_id VARCHAR(64),
    payload JSONB DEFAULT '{}'::jsonb,
    timestamp BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_events_type ON game_events(type);

-- 15. Round Winners
CREATE TABLE IF NOT EXISTS winners (
    id VARCHAR(64) PRIMARY KEY,
    round_id VARCHAR(64) NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    winner_type VARCHAR(32) DEFAULT 'LUCKY_DRAW',
    prize_details TEXT,
    won_at BIGINT NOT NULL
);

-- 16. Dynamic Settings
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at BIGINT NOT NULL
);
