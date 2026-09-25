import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import server
import server from './server.js';
import eventBus from './lib/eventBus.js';
import commandParser from './lib/commandParser.js';
import tiktokConnector, { CONNECTION_STATES } from './lib/tiktokConnector.js';
import serverGameState, { GAME_STATES } from './lib/serverGameState.js';
import authManager, { ROLES } from './lib/auth.js';

console.log('================================================================');
console.log('🚀 BYE BYE GAME SHOW - FULL PRODUCTION VERIFICATION TEST SUITE');
console.log('================================================================');

const BASE_URL = 'http://localhost:3000';

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  try {
    return { status: res.status, headers: res.headers, data: JSON.parse(text) };
  } catch (e) {
    return { status: res.status, headers: res.headers, text };
  }
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(name, condition, extra = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name} ${extra}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name} ${extra}`);
      failed++;
    }
  }

  console.log('\n--- 1. HTTP Server & Endpoints Verification ---');
  
  // 1.1 Root Overlay
  const rootRes = await fetch(`${BASE_URL}/`);
  assert('GET / (Root Overlay)', rootRes.status === 200 && rootRes.headers.get('content-type').includes('text/html'));

  // 1.2 Broadcast Screen
  const broadcastRes = await fetch(`${BASE_URL}/broadcast`);
  assert('GET /broadcast (Clean Broadcast Screen)', broadcastRes.status === 200 && broadcastRes.headers.get('content-type').includes('text/html'));

  // 1.3 Admin Panel
  const adminRes = await fetch(`${BASE_URL}/admin`);
  assert('GET /admin (Admin Panel)', adminRes.status === 200 && adminRes.headers.get('content-type').includes('text/html'));

  // 1.4 Health API
  const healthRes = await fetchJSON(`${BASE_URL}/api/health`);
  assert('GET /api/health (Health Check)', healthRes.status === 200 && healthRes.data.status === 'healthy' && healthRes.data.memory?.rssMB > 0);

  // 1.5 System Status
  const statusRes = await fetchJSON(`${BASE_URL}/api/status`);
  assert('GET /api/status (System Status)', statusRes.status === 200 && statusRes.data.success === true);

  console.log('\n--- 2. Authentication & RBAC Verification ---');
  
  // 2.1 Login
  const loginRes = await fetchJSON(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin1234' })
  });
  assert('POST /api/auth/login (Super Admin Auth)', loginRes.status === 200 && loginRes.data.success === true && loginRes.data.token);
  const token = loginRes.data.token;

  // 2.2 Verify Session
  const meRes = await fetchJSON(`${BASE_URL}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert('GET /api/auth/me (Session Verification)', meRes.status === 200 && meRes.data.user?.username === 'admin');

  // 2.3 User Management
  const newOpUsername = `op_${Date.now()}`;
  const createUserRes = await fetchJSON(`${BASE_URL}/api/auth/users`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: newOpUsername,
      password: 'operator1234',
      role: 'OPERATOR',
      displayName: 'مشغل تجريبي'
    })
  });
  assert('POST /api/auth/users (Create User by Super Admin)', createUserRes.status === 201 && createUserRes.data.success === true);

  // 2.4 Delete User
  const deleteUserRes = await fetchJSON(`${BASE_URL}/api/auth/users/${newOpUsername}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert('DELETE /api/auth/users/:username (Delete User)', deleteUserRes.status === 200 && deleteUserRes.data.success === true);

  console.log('\n--- 3. Question Bank & Management APIs ---');
  
  // 3.1 List questions
  const qListRes = await fetchJSON(`${BASE_URL}/api/questions`);
  assert('GET /api/questions', qListRes.status === 200 && Array.isArray(qListRes.data.questions));

  // 3.2 Create question
  const testQId = `q_prod_test_${Date.now()}`;
  const createQRes = await fetchJSON(`${BASE_URL}/api/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: testQId,
      category: 'إنتاج تجريبي',
      question: 'ما هو الهدف الأسمى لمنظومة Bye Bye؟',
      options: ['أعلى جودة', 'سرعة البث', 'التفاعل المباشر', 'جميع ما سبق'],
      correctAnswer: 'جميع ما سبق',
      difficulty: 'HARD',
      timeLimit: 15,
      points: 200
    })
  });
  assert('POST /api/questions (Create)', createQRes.status === 201 && createQRes.data.success === true);

  // 3.3 Update question
  const updateQRes = await fetchJSON(`${BASE_URL}/api/questions/${testQId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points: 250 })
  });
  assert('PUT /api/questions/:id (Update)', updateQRes.status === 200 && updateQRes.data.question.points === 250);

  // 3.4 Delete question
  const deleteQRes = await fetchJSON(`${BASE_URL}/api/questions/${testQId}`, { method: 'DELETE' });
  assert('DELETE /api/questions/:id (Delete)', deleteQRes.status === 200 && deleteQRes.data.success === true);

  console.log('\n--- 4. Commands, Gifts & Participant Management ---');
  
  // 4.1 Commands List
  const cmdListRes = await fetchJSON(`${BASE_URL}/api/commands`);
  assert('GET /api/commands', cmdListRes.status === 200 && Array.isArray(cmdListRes.data.commands) && cmdListRes.data.commands.some(c => c.name === 'join'));

  // 4.2 Gift Rules List
  const giftsRes = await fetchJSON(`${BASE_URL}/api/gift-rules`);
  assert('GET /api/gift-rules', giftsRes.status === 200 && Array.isArray(giftsRes.data.rules) && giftsRes.data.rules.length > 0);

  // 4.3 Participant Banning
  const banRes = await fetchJSON(`${BASE_URL}/api/participants/ban`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'spammer_123', reason: 'سلوك غير لائق', bannedBy: 'admin' })
  });
  assert('POST /api/participants/ban', banRes.status === 200 && banRes.data.success === true);

  const unbanRes = await fetchJSON(`${BASE_URL}/api/participants/unban`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'spammer_123' })
  });
  assert('POST /api/participants/unban', unbanRes.status === 200 && unbanRes.data.success === true);

  // 4.4 Structured Logs
  const logsRes = await fetchJSON(`${BASE_URL}/api/logs?limit=10`);
  assert('GET /api/logs', logsRes.status === 200 && Array.isArray(logsRes.data.logs));

  console.log('\n--- 5. Central Command Parser & Normalizer ---');
  
  // Test !join
  const parsedJoin = commandParser.parse('!join', { id: 'u_1', nickname: 'أحمد' });
  assert('CommandParser (!join)', parsedJoin.isCommand === true && parsedJoin.action === 'JOIN');

  // Test Arabic join shorthand "تم"
  const parsedTam = commandParser.parse('تم', { id: 'u_2', nickname: 'سارة' });
  assert('CommandParser (تم)', parsedTam.isCommand === true && parsedTam.action === 'JOIN');

  // Test !answer A
  const parsedAns = commandParser.parse('!answer A', { id: 'u_1', nickname: 'أحمد' });
  assert('CommandParser (!answer A)', parsedAns.isCommand === true && parsedAns.action === 'ANSWER' && parsedAns.value === 'A');

  // Test standalone "ب"
  const parsedB = commandParser.parse('ب', { id: 'u_1', nickname: 'أحمد' });
  assert('CommandParser (ب -> B)', parsedB.isCommand === true && parsedB.action === 'ANSWER');

  console.log('\n--- 6. SSE Stream & Real-Time Broadcast ---');
  let sseEventCount = 0;
  const sseReq = http.request(`${BASE_URL}/api/events`, (res) => {
    res.on('data', (chunk) => {
      const text = chunk.toString();
      if (text.includes('data:')) {
        sseEventCount++;
      }
    });
  });
  sseReq.end();

  // Trigger command to verify broadcast
  await fetchJSON(`${BASE_URL}/api/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'UPDATE_SETTINGS', payload: { autoMode: true } })
  });

  await new Promise(r => setTimeout(r, 600));
  assert('SSE Stream reception & event delivery', sseEventCount > 0);
  sseReq.destroy();

  console.log('\n--- 7. Full 50-Round Headless Game Cycle Simulation ---');
  serverGameState.resetAll();
  serverGameState.autoTransition = false; // manual test stepping

  const mockParticipants = [];
  for (let i = 1; i <= 100; i++) {
    mockParticipants.push({
      id: `user_${i}`,
      uniqueId: `tiktok_user_${i}`,
      nickname: `بطل التيك توك ${i}`,
      displayName: `بطل التيك توك ${i}`,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=user_${i}`
    });
  }

  const winners = [];

  for (let r = 1; r <= 50; r++) {
    serverGameState.startNewRound(r);

    // Register 36 participants
    for (let p = 0; p < 36; p++) {
      const user = mockParticipants[(r * 7 + p) % mockParticipants.length];
      serverGameState.registerParticipant(user, 'تم');
    }
    assert(`Round ${r}: 36 Participants Registered`, serverGameState.drawPool.length === 36);

    // Start question
    serverGameState.startQuestion();
    assert(`Round ${r}: Question active`, serverGameState.state === GAME_STATES.QUESTION && serverGameState.currentQuestion !== null);

    // Process 15 answers
    const q = serverGameState.currentQuestion;
    for (let a = 0; a < 15; a++) {
      const user = mockParticipants[(r * 7 + a) % mockParticipants.length];
      const answerChoice = a % 2 === 0 ? q.correctAnswer : 'إجابة خاطئة';
      serverGameState.processAnswer(user, answerChoice);
    }

    // End question
    serverGameState.endQuestion();
    assert(`Round ${r}: Result Phase`, serverGameState.state === GAME_STATES.RESULT);

    // Lucky draw
    const winner = serverGameState.startLuckyDraw();
    assert(`Round ${r}: Winner Selected`, winner !== null && winner.id !== undefined);
    winners.push(winner.id);
  }

  assert('50 Complete Game Rounds Executed Successfully', winners.length === 50);

  console.log('\n--- 8. TikTok LIVE Connection Status Audit ---');
  const tiktokStatus = tiktokConnector.getStatus();
  console.log(`  ℹ️ TikTok Username: ${tiktokStatus.username}`);
  console.log(`  ℹ️ Current Status: ${tiktokStatus.status}`);
  console.log(`  ℹ️ Max Reconnect Attempts: ${tiktokStatus.maxReconnectAttempts}`);
  console.log(`  ℹ️ Reconnection Policy: Exponential Backoff (2s -> 30s)`);

  if (tiktokStatus.status === CONNECTION_STATES.CONNECTED) {
    console.log('  🟢 Real TikTok LIVE Connection: CONNECTED');
  } else {
    console.log('  ⚠️ REAL LIVE TEST NOT PERFORMED (Sandboxed Container Egress Restrictions)');
  }

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
