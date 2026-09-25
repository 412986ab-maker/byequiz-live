/**
 * Participant Manager
 * Handles user identity, real TikTok nicknames & avatars, deduplication,
 * target thresholds, and full CRUD participant lifecycle.
 */
class ParticipantManager {
  constructor(eventManager, gameState) {
    this.events = eventManager;
    this.state = gameState;
    this.participants = new Map(); // id -> user object
    this.drawPool = []; // array of user IDs registered in current round
  }

  registerParticipant(data) {
    return this.addParticipant(data);
  }

  addParticipant(data) {
    const id = (data.id || data.uniqueId || data.userId || 'guest_' + Math.random().toString(36).substring(7)).toString();
    const username = (data.username || data.uniqueId || id).toString();
    const nickname = (data.nickname || data.displayName || data.user || username).toString();
    const displayName = nickname;
    const avatar = data.avatar || data.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;
    const comment = data.comment || data.originalComment || 'تم';
    const joinedAt = Date.now();

    // Prevent duplicate registration in the same round
    if (this.isRegistered(id)) {
      return { success: false, reason: 'ALREADY_REGISTERED', user: this.get(id) };
    }

    let user = this.participants.get(id);
    if (!user) {
      user = {
        id,
        username,
        displayName,
        nickname,
        avatar,
        comment,
        joinedAt,
        answers: [],
        correctAnswers: 0,
        wrongAnswers: 0,
        score: 0,
        points: 0,
        gifts: 0,
        eligibleForDraw: true,
        streak: 0,
        level: 1,
        correctCount: 0,
        lastActive: joinedAt
      };
      this.participants.set(id, user);
    } else {
      user.username = username;
      user.displayName = displayName;
      user.nickname = nickname;
      if (avatar) user.avatar = avatar;
      user.comment = comment;
      user.lastActive = joinedAt;
    }

    this.drawPool.push(id);

    const round = this.state.get('round');
    const settings = this.state.get('settings');
    const target = settings.targetParticipants || 36;
    const count = this.drawPool.length;

    // Emit official PARTICIPANT_JOINED event
    this.events.emit('PARTICIPANT_JOINED', {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      nickname: user.nickname,
      avatar: user.avatar,
      comment: user.comment,
      joinedAt: user.joinedAt,
      roundNumber: round.roundNumber,
      totalCount: count,
      targetCount: target
    });

    this.events.emit('PARTICIPANTS_UPDATED', {
      count,
      target,
      participants: this.getDrawPoolUsers()
    });

    this.events.emit('participant:joined', user);
    this.events.emit('drawPool:updated', {
      count,
      target,
      pool: this.drawPool,
      lastJoined: user
    });

    // Check if target participants reached
    if (count >= target) {
      this.events.emit('participants:target_reached', {
        count,
        target,
        participants: this.getDrawPoolUsers()
      });
    }

    return { success: true, user };
  }

  isRegistered(id) {
    if (!id) return false;
    const strId = id.toString();
    return this.drawPool.includes(strId);
  }

  getParticipant(id) {
    if (!id) return null;
    return this.participants.get(id.toString()) || null;
  }

  get(id) {
    return this.getParticipant(id);
  }

  getOrCreate(data) {
    const id = (data.id || data.uniqueId || data.userId || '').toString();
    if (this.participants.has(id)) {
      return this.participants.get(id);
    }
    const res = this.addParticipant(data);
    return res.user;
  }

  getAllParticipants() {
    return Array.from(this.participants.values());
  }

  getEligibleParticipants(excludeId = null) {
    return this.drawPool
      .map(id => this.get(id))
      .filter(u => u && u.eligibleForDraw !== false && (!excludeId || u.id !== excludeId.toString()));
  }

  getDrawPoolUsers() {
    return this.drawPool
      .map(id => this.get(id))
      .filter(Boolean);
  }

  removeParticipant(id) {
    if (!id) return false;
    const strId = id.toString();
    const index = this.drawPool.indexOf(strId);
    if (index !== -1) {
      this.drawPool.splice(index, 1);
      this.events.emit('drawPool:updated', {
        count: this.drawPool.length,
        pool: this.drawPool
      });
      return true;
    }
    return false;
  }

  updateParticipant(id, patch = {}) {
    const user = this.get(id);
    if (!user) return null;
    Object.assign(user, patch);
    this.events.emit('participant:updated', user);
    return user;
  }

  addPoints(id, points = 100) {
    const user = this.get(id);
    if (!user) return 0;
    user.points = (user.points || 0) + points;
    user.score = user.points;
    user.level = Math.floor(user.points / 500) + 1;
    this.events.emit('participant:scored', { user, points, total: user.points });
    return user.points;
  }

  incrementStreak(id) {
    const user = this.get(id);
    if (!user) return 0;
    user.streak = (user.streak || 0) + 1;
    user.correctAnswers = (user.correctAnswers || 0) + 1;
    user.correctCount = user.correctAnswers;
    this.events.emit('participant:streak', { user, streak: user.streak });
    return user.streak;
  }

  recordWrongAnswer(id) {
    const user = this.get(id);
    if (!user) return;
    user.streak = 0;
    user.wrongAnswers = (user.wrongAnswers || 0) + 1;
  }

  resetStreak(id) {
    const user = this.get(id);
    if (user) user.streak = 0;
  }

  getTopParticipants(limit = 5) {
    return this.getLeaderboard(limit);
  }

  getLeaderboard(limit = 5) {
    return Array.from(this.participants.values())
      .sort((a, b) => (b.points || 0) - (a.points || 0) || (b.correctAnswers || 0) - (a.correctAnswers || 0))
      .slice(0, limit);
  }

  getCount() {
    return this.count();
  }

  count() {
    return this.drawPool.length;
  }

  totalKnownCount() {
    return this.participants.size;
  }

  clearParticipants() {
    this.drawPool = [];
    this.events.emit('participant:cleared');
    this.events.emit('drawPool:updated', { count: 0, pool: [] });
  }
}

if (typeof window !== 'undefined') {
  window.ParticipantManager = ParticipantManager;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ParticipantManager = ParticipantManager;
}
