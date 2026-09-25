/**
 * Database & Persistence Layer
 * Production-grade PostgreSQL integration with parameterized SQL queries,
 * automated schema verification, and robust structured fallback storage.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const MIGRATIONS_FILE = path.join(__dirname, '..', 'migrations', '001_initial_schema.sql');

class DatabaseService {
  constructor() {
    this.type = 'FALLBACK_STORAGE';
    this.isPostgres = false;
    this.pgPool = null;

    // In-memory / JSON fallback collections
    this.collections = {
      users: new Map(),
      bannedUsers: new Map(),
      questions: [],
      questionSets: [],
      answers: [],
      scores: [],
      giftEvents: [],
      chatMessages: [],
      gameEvents: [],
      winners: [],
      settings: new Map()
    };

    this.ready = this.init();
  }

  async init() {
    if (process.env.DATABASE_URL) {
      try {
        const { default: pg } = await import('pg');
        this.pgPool = new pg.Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000
        });

        // Run migrations
        if (fs.existsSync(MIGRATIONS_FILE)) {
          const schemaSql = fs.readFileSync(MIGRATIONS_FILE, 'utf8');
          await this.pgPool.query(schemaSql);
          logger.info('PostgreSQL schema migrations verified successfully');
        }

        this.type = 'POSTGRESQL';
        this.isPostgres = true;
        logger.audit('Database connected in PostgreSQL mode', { status: 'CONNECTED' });
        return;
      } catch (err) {
        logger.warn('PostgreSQL initialization failed. Active fallback storage engaged:', { error: err.message });
      }
    }

    // Load initial data from disk for fallback mode
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

      const qFile = path.join(DATA_DIR, 'questions.json');
      if (fs.existsSync(qFile)) {
        this.collections.questions = JSON.parse(fs.readFileSync(qFile, 'utf8'));
      }

      const qsFile = path.join(DATA_DIR, 'questionSets.json');
      if (fs.existsSync(qsFile)) {
        this.collections.questionSets = JSON.parse(fs.readFileSync(qsFile, 'utf8'));
      }
    } catch (e) {
      logger.warn('Error reading data files from disk:', { error: e.message });
    }
  }

  saveToDisk(fileKey) {
    try {
      if (fileKey === 'questions') {
        fs.writeFileSync(path.join(DATA_DIR, 'questions.json'), JSON.stringify(this.collections.questions, null, 2), 'utf8');
      } else if (fileKey === 'questionSets') {
        fs.writeFileSync(path.join(DATA_DIR, 'questionSets.json'), JSON.stringify(this.collections.questionSets, null, 2), 'utf8');
      }
    } catch (e) {
      logger.error('Error saving data to disk:', { error: e.message });
    }
  }

  // 1. Question CRUD
  getQuestionsSync() {
    return this.collections.questions;
  }

  async getQuestions() {
    if (this.isPostgres && this.pgPool) {
      try {
        const res = await this.pgPool.query('SELECT * FROM questions ORDER BY created_at DESC');
        return res.rows.map(r => ({
          ...r,
          options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options,
          answers: typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers,
          tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags
        }));
      } catch (err) {
        logger.error('PostgreSQL getQuestions error:', { error: err.message });
      }
    }
    return this.collections.questions;
  }

  async setQuestions(list) {
    this.collections.questions = list;
    this.saveToDisk('questions');

    if (this.isPostgres && this.pgPool) {
      try {
        for (const q of list) {
          await this.pgPool.query(`
            INSERT INTO questions (id, category, subcategory, difficulty, type, question, options, answers, correct_answer, explanation, time_limit, points, image, audio, enabled, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (id) DO UPDATE SET
              category = EXCLUDED.category,
              difficulty = EXCLUDED.difficulty,
              question = EXCLUDED.question,
              options = EXCLUDED.options,
              answers = EXCLUDED.answers,
              correct_answer = EXCLUDED.correct_answer,
              explanation = EXCLUDED.explanation,
              time_limit = EXCLUDED.time_limit,
              points = EXCLUDED.points,
              enabled = EXCLUDED.enabled,
              updated_at = EXCLUDED.updated_at
          `, [
            q.id, q.category, q.subcategory || '', q.difficulty || 'MEDIUM', q.type || 'MULTIPLE_CHOICE',
            q.question, JSON.stringify(q.options || []), JSON.stringify(q.answers || [q.correctAnswer]),
            q.correctAnswer, q.explanation || '', q.timeLimit || 15, q.points || 100, q.image || '', q.audio || '',
            q.enabled !== false, q.createdAt || Date.now(), Date.now()
          ]);
        }
      } catch (err) {
        logger.error('PostgreSQL setQuestions error:', { error: err.message });
      }
    }
  }

  async getQuestionSets() {
    return this.collections.questionSets;
  }

  async setQuestionSets(list) {
    this.collections.questionSets = list;
    this.saveToDisk('questionSets');
  }

  // 2. Users & Participants
  async upsertUser(userData) {
    const id = (userData.id || userData.uniqueId).toString();
    const existing = this.collections.users.get(id) || {
      id,
      uniqueId: userData.uniqueId || id,
      nickname: userData.nickname || id,
      displayName: userData.displayName || userData.nickname || id,
      avatar: userData.avatar,
      totalScore: 0,
      totalWins: 0,
      totalAnswers: 0,
      totalCorrect: 0,
      totalWrong: 0,
      totalGifts: 0,
      totalDiamonds: 0,
      isBanned: false,
      createdAt: Date.now()
    };

    Object.assign(existing, {
      nickname: userData.nickname || existing.nickname,
      displayName: userData.displayName || existing.displayName,
      avatar: userData.avatar || existing.avatar,
      updatedAt: Date.now()
    });

    this.collections.users.set(id, existing);

    if (this.isPostgres && this.pgPool) {
      try {
        await this.pgPool.query(`
          INSERT INTO users (id, unique_id, nickname, display_name, avatar, total_score, total_wins, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            nickname = EXCLUDED.nickname,
            display_name = EXCLUDED.display_name,
            avatar = EXCLUDED.avatar,
            updated_at = EXCLUDED.updated_at
        `, [
          existing.id, existing.uniqueId, existing.nickname, existing.displayName, existing.avatar,
          existing.totalScore || 0, existing.totalWins || 0, existing.createdAt, existing.updatedAt || Date.now()
        ]);
      } catch (err) {
        logger.error('PostgreSQL upsertUser error:', { error: err.message });
      }
    }

    return existing;
  }

  getUser(id) {
    return this.collections.users.get(id.toString()) || null;
  }

  // 3. User Banning
  async banUser(userId, reason = 'مخالفة القوانين', bannedBy = 'admin') {
    const id = userId.toString();
    const banRecord = {
      userId: id,
      uniqueId: id,
      reason,
      bannedBy,
      bannedAt: Date.now()
    };
    this.collections.bannedUsers.set(id, banRecord);
    const u = this.collections.users.get(id);
    if (u) u.isBanned = true;

    if (this.isPostgres && this.pgPool) {
      try {
        await this.pgPool.query(`
          INSERT INTO banned_users (user_id, unique_id, reason, banned_by, banned_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (user_id) DO UPDATE SET reason = EXCLUDED.reason, banned_at = EXCLUDED.banned_at
        `, [id, id, reason, bannedBy, banRecord.bannedAt]);
      } catch (err) {
        logger.error('PostgreSQL banUser error:', { error: err.message });
      }
    }

    logger.audit('User banned', { userId: id, reason, bannedBy });
    return banRecord;
  }

  async unbanUser(userId) {
    const id = userId.toString();
    const existed = this.collections.bannedUsers.delete(id);
    const u = this.collections.users.get(id);
    if (u) u.isBanned = false;

    if (this.isPostgres && this.pgPool) {
      try {
        await this.pgPool.query('DELETE FROM banned_users WHERE user_id = $1', [id]);
      } catch (err) {
        logger.error('PostgreSQL unbanUser error:', { error: err.message });
      }
    }

    logger.audit('User unbanned', { userId: id });
    return existed;
  }

  isUserBanned(userId) {
    return this.collections.bannedUsers.has(userId.toString());
  }

  getBannedUsers() {
    return Array.from(this.collections.bannedUsers.values());
  }

  // 4. Persistence for Answers & Scores & Winners
  async recordAnswer(answerData) {
    this.collections.answers.push(answerData);
    if (this.isPostgres && this.pgPool) {
      try {
        await this.pgPool.query(`
          INSERT INTO answers (id, round_id, question_id, user_id, answer_raw, is_correct, attempt_number, speed_seconds, points_awarded, submitted_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          `ans_${Date.now()}_${Math.random().toString(36).substring(4)}`,
          answerData.roundId || 'round_1',
          answerData.questionId || 'q_1',
          answerData.userId,
          answerData.answerRaw || '',
          Boolean(answerData.isCorrect),
          answerData.attemptNumber || 1,
          answerData.speedSeconds || 0,
          answerData.pointsAwarded || 0,
          Date.now()
        ]);
      } catch (err) {
        logger.error('PostgreSQL recordAnswer error:', { error: err.message });
      }
    }
  }

  async recordWinner(winnerData) {
    this.collections.winners.push(winnerData);
    if (this.isPostgres && this.pgPool) {
      try {
        await this.pgPool.query(`
          INSERT INTO winners (id, round_id, user_id, winner_type, prize_details, won_at)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          `win_${Date.now()}_${Math.random().toString(36).substring(4)}`,
          winnerData.roundId || 'round_1',
          winnerData.userId,
          winnerData.type || 'LUCKY_DRAW',
          winnerData.prize || 'Champion',
          Date.now()
        ]);
      } catch (err) {
        logger.error('PostgreSQL recordWinner error:', { error: err.message });
      }
    }
  }

  // 5. Persistent Settings
  async getSettings() {
    if (this.isPostgres && this.pgPool) {
      try {
        const res = await this.pgPool.query('SELECT key, value FROM settings ORDER BY key');
        return Object.fromEntries(res.rows.map(r => [r.key, typeof r.value === 'string' ? JSON.parse(r.value) : r.value]));
      } catch (err) { logger.error('PostgreSQL getSettings error:', { error: err.message }); }
    }
    const file = path.join(DATA_DIR, 'settings.json');
    try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')) || {}; }
    catch (err) { logger.warn('Error reading settings from disk:', { error: err.message }); }
    return Object.fromEntries(this.collections.settings.entries());
  }

  async setSettings(settings = {}) {
    for (const [key, value] of Object.entries(settings)) this.collections.settings.set(key, value);
    if (this.isPostgres && this.pgPool) {
      try {
        for (const [key, value] of Object.entries(settings)) {
          await this.pgPool.query('INSERT INTO settings (key, value, updated_at) VALUES ($1, $2::jsonb, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at', [key, JSON.stringify(value), Date.now()]);
        }
        return true;
      } catch (err) { logger.error('PostgreSQL setSettings error:', { error: err.message }); }
    }
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(path.join(DATA_DIR, 'settings.json'), JSON.stringify(Object.fromEntries(this.collections.settings.entries()), null, 2), 'utf8');
      return true;
    } catch (err) { logger.error('Error saving settings to disk:', { error: err.message }); return false; }
  }

  // 5. Status & Diagnostics
  getStatus() {
    return {
      type: this.type,
      isPostgres: this.isPostgres,
      totalQuestions: this.collections.questions.length,
      totalQuestionSets: this.collections.questionSets.length,
      knownUsers: this.collections.users.size,
      bannedUsers: this.collections.bannedUsers.size,
      recordedAnswers: this.collections.answers.length,
      recordedWinners: this.collections.winners.length
    };
  }
}

export const db = new DatabaseService();
export default db;
