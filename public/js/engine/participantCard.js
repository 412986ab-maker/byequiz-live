function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Participant Card Component
 * Zero Unicode Emojis | Vector Badges | Safe HTML Escaping
 */
class ParticipantCard {
  static getFallbackAvatar(name = 'Player') {
    const safeName = encodeURIComponent((name || 'Player').toString().trim());
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${safeName}`;
  }

  static renderAvatar(user, customClass = '', size = 40) {
    const rawName = user ? (user.nickname || user.displayName || user.username || 'مشارك') : 'مشارك';
    const name = escapeHtml(rawName);
    const avatarUrl = (user && user.avatar) ? user.avatar : ParticipantCard.getFallbackAvatar(name);
    const fallback = ParticipantCard.getFallbackAvatar(name);

    return `
      <img src="${avatarUrl}" 
           class="p-avatar ${customClass}" 
           alt="${name}" 
           loading="lazy"
           onerror="this.onerror=null; this.src='${fallback}';" 
           style="width: ${size}px; height: ${size}px; border-radius: 50%; object-fit: cover;" />
    `;
  }

  static renderSlot(user, index = 0, total = 36) {
    if (!user) {
      return `
        <div class="p-slot empty">
          <span class="slot-num">${index + 1}</span>
        </div>
      `;
    }

    const name = escapeHtml(user.nickname || user.displayName || 'لاعب');
    const avatar = ParticipantCard.renderAvatar(user, 'slot-img', 36);

    return `
      <div class="p-slot occupied animate-pop" id="slot-${user.id}">
        ${avatar}
        <span class="slot-name">${name}</span>
      </div>
    `;
  }

  static renderChip(user, rank = null) {
    if (!user) return '';
    const name = escapeHtml(user.nickname || user.displayName || 'لاعب');
    const score = user.points || user.score || 0;
    const avatar = ParticipantCard.renderAvatar(user, 'chip-img', 30);
    const rankHtml = rank !== null ? `<span class="chip-rank">#${rank}</span>` : '';
    const flameIcon = (typeof IconSystem !== 'undefined') ? IconSystem.get('flame', { size: 12, color: '#f59e0b' }) : '';
    const streakHtml = (user.streak >= 3) ? `<span class="chip-streak">${flameIcon} ${user.streak}</span>` : '';

    return `
      <div class="p-chip">
        ${rankHtml}
        ${avatar}
        <span class="chip-name">${name}</span>
        ${streakHtml}
        <span class="chip-score">${score} نقطة</span>
      </div>
    `;
  }

  static renderSpotlight(user, title = 'أسرع إجابة') {
    if (!user) return '';
    const name = escapeHtml(user.nickname || user.displayName || 'البطل');
    const avatar = ParticipantCard.renderAvatar(user, 'spotlight-img', 56);
    const speed = user.speedSeconds ? `${user.speedSeconds} ثانية` : '';
    const timerIcon = (typeof IconSystem !== 'undefined') ? IconSystem.get('timer', { size: 14, color: '#00f2fe' }) : '';
    const boltIcon = (typeof IconSystem !== 'undefined') ? IconSystem.get('bolt', { size: 16, color: '#ffd700' }) : '';

    return `
      <div class="p-spotlight-card animate-bounce-in">
        <div class="spotlight-title">${boltIcon} ${escapeHtml(title)}</div>
        <div class="spotlight-body">
          ${avatar}
          <div class="spotlight-info">
            <div class="spotlight-name">${name}</div>
            ${speed ? `<div class="spotlight-speed">${timerIcon} في غضون ${speed}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }
}

if (typeof window !== 'undefined') {
  window.ParticipantCard = ParticipantCard;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ParticipantCard = ParticipantCard;
}
