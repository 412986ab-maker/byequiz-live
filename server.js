/**
 * Bye Bye - Production Game Server
 * Enterprise-grade Node.js Native HTTP & SSE Server with complete subsystem integration,
 * RBAC authorization, CSRF protection, Path Traversal defense, and PostgreSQL support.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Subsystems
import logger from './lib/logger.js';
import security, { apiRateLimiter, tiktokActionLimiter, isSafePath, safeJSONParse } from './lib/security.js';
import authManager, { ROLES } from './lib/auth.js';
import eventBus from './lib/eventBus.js';
import commandParser from './lib/commandParser.js';
import tiktokConnector, { CONNECTION_STATES } from './lib/tiktokConnector.js';
import db from './lib/database.js';
import giftEngine from './lib/giftEngine.js';
import serverGameState, { GAME_STATES } from './lib/serverGameState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load local environment configuration (.env)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(envPath); } catch (_) {}
}

const PORT = process.env.PORT || 3000;
const ENABLE_SIMULATOR = process.env.ENABLE_SIMULATOR === 'true';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const clients = new Set(); // Active SSE connections
const serverStartTime = Date.now();

// Broadcast event envelope to all connected SSE clients
function broadcast(envelope) {
  const dataString = `data: ${JSON.stringify(envelope)}\n\n`;
  for (const client of Array.from(clients)) {
    try {
      client.write(dataString);
    } catch (e) {
      clients.delete(client);
    }
  }
}

// Forward all central event bus events to connected broadcast & admin clients
eventBus.on('event', (envelope) => {
  broadcast(envelope);
});

// Periodic SSE Heartbeat (every 15 seconds) to keep connections alive and prune stale sockets
const heartbeatInterval = setInterval(() => {
  const pingData = `: ping\n\n`;
  for (const client of Array.from(clients)) {
    try {
      client.write(pingData);
    } catch (e) {
      clients.delete(client);
    }
  }
}, 15000);

// MIME Types Map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

// Helper to extract session from Authorization header or Cookie
function getSessionFromRequest(req) {
  const authHeader = req.headers['authorization'] || '';
  let token = authHeader.replace(/^Bearer\s+/i, '').trim();

  let isCookieAuth = false;
  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';');
    for (const c of cookies) {
      const [k, v] = c.trim().split('=');
      if (k === 'bye_bye_token') {
        token = v;
        isCookieAuth = true;
        break;
      }
    }
  }

  const session = token ? authManager.validateSession(token) : null;
  return { session, isCookieAuth, token };
}

// Helper to verify CSRF token for mutating requests when cookie auth is used
function verifyCSRF(req, session, isCookieAuth) {
  if (!isCookieAuth) return true; // Bearer tokens are immune to CSRF
  const csrfHeader = req.headers['x-csrf-token'];
  return authManager.validateCSRF(session, csrfHeader);
}

// Helper to send standardized JSON responses
function sendJSON(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    ...headers
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const clientIp = req.socket.remoteAddress || '127.0.0.1';

  // Global CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Rate Limiting for APIs
  if (pathname.startsWith('/api/')) {
    const rate = apiRateLimiter.check(clientIp);
    if (!rate.allowed) {
      return sendJSON(res, 429, { success: false, error: 'تم تجاوز الحد المسموح من الطلبات (Rate Limit Exceeded)', code: 429 });
    }
  }

  // ==========================================
  // 1. SSE EVENT STREAM (/api/events)
  // ==========================================
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(': connected\n\n');
    clients.add(res);

    // Send initial authoritative game snapshot on connect
    const initSnapshot = {
      id: `init_${Date.now()}`,
      type: 'INIT_SNAPSHOT',
      timestamp: Date.now(),
      source: 'SERVER',
      payload: {
        game: serverGameState.getSnapshot(),
        tiktok: tiktokConnector.getStatus(),
        serverTime: Date.now()
      }
    };
    res.write(`data: ${JSON.stringify(initSnapshot)}\n\n`);

    req.on('close', () => {
      clients.delete(res);
    });
    return;
  }

  // ==========================================
  // 2. HEALTH & SYSTEM DIAGNOSTICS APIS
  // ==========================================
  if (pathname === '/api/health' && req.method === 'GET') {
    const mem = process.memoryUsage();
    return sendJSON(res, 200, {
      status: 'healthy',
      uptime: Math.floor((Date.now() - serverStartTime) / 1000),
      database: db.getStatus(),
      tiktok: tiktokConnector.getStatus(),
      game: {
        state: serverGameState.state,
        roundNumber: serverGameState.roundNumber,
        participantsCount: serverGameState.drawPool.length
      },
      memory: {
        rssMB: Math.round(mem.rss / 1024 / 1024),
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024)
      },
      version: '2.0.0-production'
    });
  }

  if (pathname === '/api/status' && req.method === 'GET') {
    return sendJSON(res, 200, {
      success: true,
      server: 'Bye Bye Game Server',
      status: 'healthy',
      uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
      activeSSEClients: clients.size,
      tiktok: tiktokConnector.getStatus(),
      game: serverGameState.getSnapshot(),
      database: db.getStatus(),
      timestamp: Date.now()
    });
  }

  // ==========================================
  // 3. AUTHENTICATION & RBAC APIS
  // ==========================================
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = safeJSONParse(body, {});
      const result = authManager.authenticate(data.username, data.password, clientIp);
      if (!result.success) {
        return sendJSON(res, result.code || 400, result);
      }

      const isProd = process.env.NODE_ENV === 'production';
      const cookieHeader = `bye_bye_token=${result.token}; Path=/; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}; Max-Age=86400`;
      return sendJSON(res, 200, result, { 'Set-Cookie': cookieHeader });
    });
    return;
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const { session } = getSessionFromRequest(req);
    if (session) authManager.logout(session.token);
    return sendJSON(res, 200, { success: true }, { 'Set-Cookie': 'bye_bye_token=; Path=/; HttpOnly; Max-Age=0' });
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const { session } = getSessionFromRequest(req);
    if (!session) {
      return sendJSON(res, 401, { success: false, error: 'غير مصرح به (يرجى تسجيل الدخول)' });
    }
    return sendJSON(res, 200, { success: true, user: session });
  }

  if (pathname === '/api/auth/users' && req.method === 'GET') {
    const { session } = getSessionFromRequest(req);
    if (!session || session.role !== ROLES.SUPER_ADMIN) {
      return sendJSON(res, 403, { success: false, error: 'يتطلب صلاحية المدير العام (SUPER_ADMIN)' });
    }
    return sendJSON(res, 200, { success: true, users: authManager.getAllUsers() });
  }

  if (pathname === '/api/auth/users' && req.method === 'POST') {
    const { session, isCookieAuth } = getSessionFromRequest(req);
    if (!session || session.role !== ROLES.SUPER_ADMIN) {
      return sendJSON(res, 403, { success: false, error: 'يتطلب صلاحية المدير العام (SUPER_ADMIN)' });
    }
    if (!verifyCSRF(req, session, isCookieAuth)) {
      return sendJSON(res, 403, { success: false, error: 'رمز CSRF غير صالح' });
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = safeJSONParse(body, {});
      const result = authManager.createUser(data, session.role);
      return sendJSON(res, result.success ? 201 : 400, result);
    });
    return;
  }

  if (pathname.startsWith('/api/auth/users/') && req.method === 'DELETE') {
    const { session, isCookieAuth } = getSessionFromRequest(req);
    if (!session || session.role !== ROLES.SUPER_ADMIN) {
      return sendJSON(res, 403, { success: false, error: 'يتطلب صلاحية المدير العام (SUPER_ADMIN)' });
    }
    if (!verifyCSRF(req, session, isCookieAuth)) {
      return sendJSON(res, 403, { success: false, error: 'رمز CSRF غير صالح' });
    }

    const targetUsername = pathname.replace('/api/auth/users/', '').trim();
    const result = authManager.deleteUser(targetUsername, session.role);
    return sendJSON(res, result.success ? 200 : 400, result);
  }

  // ==========================================
  // 4. TIKTOK LIVE CONNECTION APIS
  // ==========================================
  if (pathname === '/api/connect-tiktok' && req.method === 'POST') {
    const rate = tiktokActionLimiter.check(clientIp);
    if (!rate.allowed) {
      return sendJSON(res, 429, { success: false, error: 'محاولات اتصال متكررة. يرجى الانتظار قليلاً.' });
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      const data = safeJSONParse(body, {});
      const targetUser = data.username || process.env.TIKTOK_USERNAME || null;
      const result = await tiktokConnector.connect(targetUser);
      return sendJSON(res, 200, result);
    });
    return;
  }

  if (pathname === '/api/disconnect-tiktok' && req.method === 'POST') {
    const result = tiktokConnector.disconnect();
    return sendJSON(res, 200, result);
  }

  if (pathname === '/api/reconnect-tiktok' && req.method === 'POST') {
    const result = await tiktokConnector.reconnect();
    return sendJSON(res, 200, result);
  }

  // ==========================================
  // 5.1 PERSISTENT GAME SETTINGS
  // ==========================================
  if (pathname === '/api/settings' && req.method === 'GET') {
    const settings = await db.getSettings();
    return sendJSON(res, 200, { success: true, settings });
  }

  if (pathname === '/api/settings' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      const incoming = safeJSONParse(body, {});
      const settings = incoming.settings && typeof incoming.settings === 'object' ? incoming.settings : incoming;
      const allowed = ['targetParticipants','questionDuration','questionSelectionMode','autoMode','autoTransition','autoNextRound','excludePreviousWinner','engagementEnabled','engagementSound','engagementIntensity','giftPointsRate'];
      const clean = {};
      for (const key of allowed) if (settings[key] !== undefined) clean[key] = settings[key];
      if (clean.targetParticipants !== undefined) clean.targetParticipants = parseInt(clean.targetParticipants, 10);
      if (clean.questionDuration !== undefined) clean.questionDuration = parseInt(clean.questionDuration, 10);
      if (clean.giftPointsRate !== undefined) clean.giftPointsRate = Number(clean.giftPointsRate);
      if (clean.autoMode !== undefined) serverGameState.autoMode = Boolean(clean.autoMode);
      if (clean.autoTransition !== undefined) serverGameState.autoTransition = Boolean(clean.autoTransition);
      if (clean.excludePreviousWinner !== undefined) serverGameState.excludePreviousWinner = Boolean(clean.excludePreviousWinner);
      if (clean.targetParticipants !== undefined) serverGameState.targetParticipants = clean.targetParticipants;
      if (clean.questionDuration !== undefined) serverGameState.questionDuration = clean.questionDuration;
      const ok = await db.setSettings(clean);
      eventBus.dispatch('SETTINGS_UPDATED', { settings: clean }, 'ADMIN');
      eventBus.dispatch('UPDATE_SETTINGS', clean, 'ADMIN');
      return sendJSON(res, ok ? 200 : 500, { success: ok, settings: clean });
    });
    return;
  }

  // ==========================================
  // 5. GAME CONTROL COMMAND API
  // ==========================================
  if (pathname === '/api/command' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const cmd = safeJSONParse(body, null);
      if (!cmd || !cmd.type) {
        return sendJSON(res, 400, { success: false, error: 'أمر غير صالح' });
      }

      logger.audit(`Game Command: ${cmd.type}`, { cmd });

      switch (cmd.type) {
        case 'START_ROUND':
        case 'NEXT_ROUND': {
          serverGameState.startNewRound(cmd.payload?.roundNumber);
          break;
        }
        case 'START_QUESTION':
        case 'NEXT_QUESTION': {
          serverGameState.startQuestion(cmd.payload?.questionId);
          break;
        }
        case 'END_QUESTION': {
          serverGameState.endQuestion();
          break;
        }
        case 'START_DRAW': {
          serverGameState.startLuckyDraw(cmd.payload?.winnerId);
          break;
        }
        case 'PAUSE_GAME': {
          serverGameState.setState(GAME_STATES.PAUSED);
          break;
        }
        case 'RESUME_GAME': {
          serverGameState.setState(GAME_STATES.LOBBY);
          break;
        }
        case 'STOP_GAME': {
          serverGameState.stopGame();
          break;
        }
        case 'RESET_ROUND': {
          serverGameState.resetRound();
          break;
        }
        case 'RESET_ALL': {
          serverGameState.resetAll();
          break;
        }
        case 'UPDATE_SETTINGS': {
          if (cmd.payload) {
            if (cmd.payload.targetParticipants !== undefined) serverGameState.targetParticipants = parseInt(cmd.payload.targetParticipants, 10);
            if (cmd.payload.questionDuration) serverGameState.questionDuration = parseInt(cmd.payload.questionDuration, 10);
            if (typeof cmd.payload.autoMode === 'boolean') serverGameState.autoMode = cmd.payload.autoMode;
            if (typeof cmd.payload.autoTransition === 'boolean') serverGameState.autoTransition = cmd.payload.autoTransition;
            if (typeof cmd.payload.excludePreviousWinner === 'boolean') serverGameState.excludePreviousWinner = cmd.payload.excludePreviousWinner;
          }
          eventBus.dispatch('UPDATE_SETTINGS', cmd.payload || {}, 'ADMIN');
          break;
        }
        case 'SIMULATE_EVENT': {
          if (!ENABLE_SIMULATOR && process.env.NODE_ENV === 'production') {
            return sendJSON(res, 403, { success: false, error: 'المحاكي معطل في وضع الإنتاج الرسمي (ENABLE_SIMULATOR=false)' });
          }
          if (cmd.payload && cmd.payload.type) {
            eventBus.dispatch(cmd.payload.type, cmd.payload.data || {}, 'SIMULATOR');
          }
          break;
        }
        default: {
          eventBus.dispatch(cmd.type, cmd.payload || {}, 'ADMIN');
          break;
        }
      }

      return sendJSON(res, 200, { success: true, status: 'ok', command: cmd.type });
    });
    return;
  }

  // ==========================================
  // 6. QUESTION MANAGEMENT REST APIS
  // ==========================================
  if (pathname === '/api/questions' && req.method === 'GET') {
    const list = await db.getQuestions();
    const search = (parsedUrl.searchParams.get('search') || '').toLowerCase().trim();
    const category = parsedUrl.searchParams.get('category') || '';
    const difficulty = parsedUrl.searchParams.get('difficulty') || '';
    const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '100', 10);

    let filtered = list;
    if (search) {
      filtered = filtered.filter(q =>
        (q.question && q.question.toLowerCase().includes(search)) ||
        (q.correctAnswer && q.correctAnswer.toLowerCase().includes(search)) ||
        (q.category && q.category.toLowerCase().includes(search))
      );
    }
    if (category) filtered = filtered.filter(q => q.category === category);
    if (difficulty) filtered = filtered.filter(q => q.difficulty === difficulty);

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return sendJSON(res, 200, {
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      questions: paginated
    });
  }

  if (pathname === '/api/questions' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      const newQ = safeJSONParse(body, null);
      if (!newQ || !newQ.question || !newQ.category) {
        return sendJSON(res, 400, { success: false, error: 'نص السؤال والتصنيف حقول إجبارية' });
      }

      const list = await db.getQuestions();
      const id = newQ.id || `q_${Date.now()}_${Math.random().toString(36).substring(4)}`;
      
      const qObj = {
        id: id.toString(),
        category: newQ.category,
        subcategory: newQ.subcategory || '',
        difficulty: newQ.difficulty || 'MEDIUM',
        type: newQ.type || 'MULTIPLE_CHOICE',
        question: newQ.question.trim(),
        options: newQ.options || [],
        answers: newQ.answers || (newQ.correctAnswer ? [newQ.correctAnswer] : []),
        correctAnswer: newQ.correctAnswer || (newQ.answers ? newQ.answers[0] : ''),
        explanation: newQ.explanation || '',
        timeLimit: newQ.timeLimit ? parseInt(newQ.timeLimit, 10) : 15,
        points: newQ.points ? parseInt(newQ.points, 10) : 100,
        image: newQ.image || '',
        audio: newQ.audio || '',
        enabled: newQ.enabled !== undefined ? newQ.enabled : true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      list.push(qObj);
      await db.setQuestions(list);

      eventBus.dispatch('QUESTION_CREATED', qObj, 'ADMIN');
      return sendJSON(res, 201, { success: true, question: qObj });
    });
    return;
  }

  // 6.1 Custom Live Question Endpoint
  if (pathname === '/api/questions/custom' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      const data = safeJSONParse(body, {});
      if (!data.question || !data.correctAnswer) {
        return sendJSON(res, 400, { success: false, error: 'نص السؤال والإجابة الصحيحة حقول إجبارية' });
      }

      const list = await db.getQuestions();
      const id = data.id || `custom_${Date.now()}_${Math.random().toString(36).substring(4)}`;
      const options = Array.isArray(data.options) && data.options.length ? data.options : [
        { key: 'A', text: data.correctAnswer },
        { key: 'B', text: 'خيار آخر' },
        { key: 'C', text: 'خيار بديل' },
        { key: 'D', text: 'خيار إضافي' }
      ];

      const qObj = {
        id: id.toString(),
        category: data.category || 'مباشر',
        subcategory: data.subcategory || 'أسئلة حية',
        difficulty: data.difficulty || 'MEDIUM',
        type: data.type || 'MULTIPLE_CHOICE',
        question: data.question.trim(),
        options: options,
        answers: [data.correctAnswer.trim()],
        correctAnswer: data.correctAnswer.trim(),
        explanation: data.explanation || 'سؤال مخصص مباشر من الإدارة',
        timeLimit: data.timeLimit ? parseInt(data.timeLimit, 10) : 15,
        points: data.points ? parseInt(data.points, 10) : 100,
        image: data.image || '',
        audio: data.audio || '',
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      list.push(qObj);
      await db.setQuestions(list);

      eventBus.dispatch('QUESTION_CREATED', qObj, 'ADMIN');
      logger.info('Custom live question created and added to bank', { id: qObj.id, question: qObj.question });

      return sendJSON(res, 200, { success: true, count: 1, question: qObj });
    });
    return;
  }

  // 6.2 Import Questions (JSON / CSV)
  if (pathname === '/api/questions/import' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      const data = safeJSONParse(body, {});
      const format = (data.format || 'json').toLowerCase();
      const content = (data.content || '').trim();
      const overwrite = Boolean(data.overwrite);

      if (!content) {
        return sendJSON(res, 400, { success: false, error: 'محتوى الاستيراد فارغ' });
      }

      let importedList = [];

      try {
        if (format === 'json' || content.startsWith('[') || content.startsWith('{')) {
          const parsed = JSON.parse(content);
          const rawItems = Array.isArray(parsed) ? parsed : (parsed.questions || []);
          importedList = rawItems.map((item, idx) => ({
            id: item.id ? item.id.toString() : `imp_${Date.now()}_${idx}`,
            category: item.category || 'عام',
            subcategory: item.subcategory || '',
            difficulty: item.difficulty || 'MEDIUM',
            type: item.type || 'MULTIPLE_CHOICE',
            question: (item.question || '').trim(),
            options: Array.isArray(item.options) ? item.options : [],
            answers: Array.isArray(item.answers) ? item.answers : (item.correctAnswer ? [item.correctAnswer] : []),
            correctAnswer: item.correctAnswer || (item.answers ? item.answers[0] : ''),
            explanation: item.explanation || '',
            timeLimit: item.timeLimit ? parseInt(item.timeLimit, 10) : 15,
            points: item.points ? parseInt(item.points, 10) : 100,
            image: item.image || '',
            audio: item.audio || '',
            enabled: item.enabled !== false,
            createdAt: Date.now(),
            updatedAt: Date.now()
          })).filter(q => q.question && (q.correctAnswer || (q.options && q.options.length)));
        } else {
          // CSV Parser
          const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
          const header = lines[0].toLowerCase();
          const startIdx = header.includes('question') || header.includes('سؤال') ? 1 : 0;

          for (let i = startIdx; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
            if (cols.length >= 2 && cols[0]) {
              const qText = cols[0];
              const optA = cols[1] || '';
              const optB = cols[2] || '';
              const optC = cols[3] || '';
              const optD = cols[4] || '';
              const correct = cols[5] || optA;
              const cat = cols[6] || 'عام';
              const diff = cols[7] || 'MEDIUM';

              const options = [];
              if (optA) options.push({ key: 'A', text: optA });
              if (optB) options.push({ key: 'B', text: optB });
              if (optC) options.push({ key: 'C', text: optC });
              if (optD) options.push({ key: 'D', text: optD });

              importedList.push({
                id: `imp_csv_${Date.now()}_${i}`,
                category: cat,
                subcategory: '',
                difficulty: diff,
                type: 'MULTIPLE_CHOICE',
                question: qText,
                options: options,
                answers: [correct],
                correctAnswer: correct,
                explanation: '',
                timeLimit: 15,
                points: 100,
                image: '',
                audio: '',
                enabled: true,
                createdAt: Date.now(),
                updatedAt: Date.now()
              });
            }
          }
        }

        if (!importedList.length) {
          return sendJSON(res, 400, { success: false, error: 'لم يتم العثور على أي أسئلة صالحة للاستيراد' });
        }

        let finalList = [];
        if (overwrite) {
          finalList = importedList;
        } else {
          const currentList = await db.getQuestions();
          const existingIds = new Set(currentList.map(q => q.id.toString()));
          finalList = [...currentList];
          for (const item of importedList) {
            if (!existingIds.has(item.id.toString())) {
              finalList.push(item);
              existingIds.add(item.id.toString());
            } else {
              item.id = `imp_${Date.now()}_${Math.random().toString(36).substring(4)}`;
              finalList.push(item);
            }
          }
        }

        await db.setQuestions(finalList);
        logger.info('Questions imported successfully', { count: importedList.length, total: finalList.length, overwrite });

        return sendJSON(res, 200, {
          success: true,
          count: importedList.length,
          total: finalList.length,
          overwrite
        });
      } catch (err) {
        logger.error('Failed to parse question import payload', { error: err.message });
        return sendJSON(res, 400, { success: false, error: 'فشل تحليل البيانات: ' + err.message });
      }
    });
    return;
  }

  // 6.3 Export Questions
  if (pathname === '/api/questions/export' && req.method === 'GET') {
    const list = await db.getQuestions();
    const format = (parsedUrl.searchParams.get('format') || 'json').toLowerCase();

    if (format === 'csv') {
      let csv = 'Question,OptionA,OptionB,OptionC,OptionD,CorrectAnswer,Category,Difficulty,Points\n';
      for (const q of list) {
        const opts = q.options || [];
        const optA = opts[0] ? (opts[0].text || opts[0]) : '';
        const optB = opts[1] ? (opts[1].text || opts[1]) : '';
        const optC = opts[2] ? (opts[2].text || opts[2]) : '';
        const optD = opts[3] ? (opts[3].text || opts[3]) : '';
        const sanitizeCSV = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
        csv += `${sanitizeCSV(q.question)},${sanitizeCSV(optA)},${sanitizeCSV(optB)},${sanitizeCSV(optC)},${sanitizeCSV(optD)},${sanitizeCSV(q.correctAnswer)},${sanitizeCSV(q.category)},${sanitizeCSV(q.difficulty)},${q.points || 100}\n`;
      }
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="bye_quiz_questions.csv"'
      });
      return res.end(csv);
    }

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="bye_quiz_questions.json"'
    });
    return res.end(JSON.stringify(list, null, 2));
  }

  if (pathname.startsWith('/api/questions/') && req.method === 'PUT') {
    const id = pathname.replace('/api/questions/', '').trim();
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      const updateData = safeJSONParse(body, {});
      const list = await db.getQuestions();
      const idx = list.findIndex(q => q.id.toString() === id.toString());
      if (idx === -1) {
        return sendJSON(res, 404, { success: false, error: 'السؤال غير موجود' });
      }

      const updated = {
        ...list[idx],
        ...updateData,
        id: list[idx].id,
        updatedAt: Date.now()
      };

      list[idx] = updated;
      await db.setQuestions(list);

      eventBus.dispatch('QUESTION_UPDATED', updated, 'ADMIN');
      return sendJSON(res, 200, { success: true, question: updated });
    });
    return;
  }

  if (pathname.startsWith('/api/questions/') && req.method === 'DELETE') {
    const id = pathname.replace('/api/questions/', '').trim();
    const list = await db.getQuestions();
    const idx = list.findIndex(q => q.id.toString() === id.toString());
    if (idx === -1) {
      return sendJSON(res, 404, { success: false, error: 'السؤال غير موجود' });
    }

    const removed = list.splice(idx, 1)[0];
    await db.setQuestions(list);

    eventBus.dispatch('QUESTION_DELETED', { id }, 'ADMIN');
    return sendJSON(res, 200, { success: true, removed });
  }

  if (pathname === '/api/question-sets' && req.method === 'GET') {
    return sendJSON(res, 200, { success: true, sets: await db.getQuestionSets() });
  }

  // ==========================================
  // 7. PARTICIPANTS, BAN & ROLES APIS
  // ==========================================
  if (pathname === '/api/participants' && req.method === 'GET') {
    const all = Array.from(serverGameState.participants.values());
    return sendJSON(res, 200, {
      success: true,
      currentRoundCount: serverGameState.drawPool.length,
      totalParticipants: all.length,
      participants: all,
      banned: db.getBannedUsers()
    });
  }

  if (pathname === '/api/participants/ban' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      const data = safeJSONParse(body, {});
      if (!data.userId) return sendJSON(res, 400, { success: false, error: 'معرف المستخدم مطلوب' });
      const record = await db.banUser(data.userId, data.reason, data.bannedBy || 'admin');
      return sendJSON(res, 200, { success: true, record });
    });
    return;
  }

  if (pathname === '/api/participants/unban' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      const data = safeJSONParse(body, {});
      if (!data.userId) return sendJSON(res, 400, { success: false, error: 'معرف المستخدم مطلوب' });
      await db.unbanUser(data.userId);
      return sendJSON(res, 200, { success: true });
    });
    return;
  }

  // ==========================================
  // 8. COMMANDS, GIFTS & LOGS APIS
  // ==========================================
  if (pathname === '/api/commands' && req.method === 'GET') {
    return sendJSON(res, 200, { success: true, commands: commandParser.getCommandList() });
  }

  if (pathname === '/api/gift-rules' && req.method === 'GET') {
    return sendJSON(res, 200, { success: true, rules: giftEngine.getRules() });
  }

  if (pathname === '/api/logs' && req.method === 'GET') {
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '100', 10);
    const level = parsedUrl.searchParams.get('level') || null;
    return sendJSON(res, 200, { success: true, logs: logger.getRecentLogs(limit, level) });
  }

  // ==========================================
  // 9. STATIC FILE SERVING WITH PATH TRAVERSAL DEFENSE
  // ==========================================
  let reqPath = pathname;
  if (reqPath === '/' || reqPath === '/overlay') {
    reqPath = '/index.html';
  } else if (reqPath === '/broadcast') {
    reqPath = '/broadcast.html';
  } else if (reqPath === '/admin') {
    reqPath = '/admin.html';
  }

  let filePath = path.join(PUBLIC_DIR, reqPath);
  let baseDir = PUBLIC_DIR;

  if (reqPath.startsWith('/data/')) {
    filePath = path.join(__dirname, reqPath);
    baseDir = DATA_DIR;
  }

  // Strictly enforce path boundary check against Path Traversal attacks
  if (!isSafePath(baseDir, filePath)) {
    logger.warn('Blocked path traversal attempt', { ip: clientIp, requestedPath: pathname });
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden - Invalid Path');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

async function initializePersistentGameSettings() {
  try {
    if (db.ready) await db.ready;
    const saved = await db.getSettings();
    if (saved && typeof saved === 'object') {
      if (saved.targetParticipants !== undefined) serverGameState.targetParticipants = parseInt(saved.targetParticipants, 10) || 36;
      if (saved.questionDuration !== undefined) serverGameState.questionDuration = parseInt(saved.questionDuration, 10) || 30;
      if (typeof saved.autoMode === 'boolean') serverGameState.autoMode = saved.autoMode;
      if (typeof saved.autoTransition === 'boolean') serverGameState.autoTransition = saved.autoTransition;
      if (typeof saved.excludePreviousWinner === 'boolean') serverGameState.excludePreviousWinner = saved.excludePreviousWinner;
      logger.info('Persistent game settings loaded', { targetParticipants: serverGameState.targetParticipants });
    }
  } catch (err) {
    logger.warn('Could not load persistent game settings at startup', { error: err.message });
  }
}

const serverInstance = server.listen(PORT, async () => {
  await initializePersistentGameSettings();
  logger.info(`🚀 BYE BYE Production Server running on port ${PORT}`);
  logger.info(`📺 Viewer Overlay:   http://localhost:${PORT}/`);
  logger.info(`📡 Broadcast Screen: http://localhost:${PORT}/broadcast`);
  logger.info(`🎮 Admin Dashboard:  http://localhost:${PORT}/admin`);
});

// Graceful Shutdown
function gracefulShutdown() {
  logger.info('Server shutting down gracefully...');
  clearInterval(heartbeatInterval);
  tiktokConnector.disconnect();
  for (const client of clients) {
    try { client.end(); } catch (e) {}
  }
  serverInstance.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default server;
