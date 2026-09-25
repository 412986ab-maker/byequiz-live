/**
 * BYE QUIZ LIVE - Professional Unified SVG Icon System
 * 100% Vector-based, Zero Unicode Emojis.
 * Provides custom, scalable, GPU-friendly cyber luxury icons and event artifacts.
 */
class IconSystem {
  static get(name, options = {}) {
    const size = options.size || 20;
    const className = options.className || '';
    const color = options.color || 'currentColor';
    const animated = options.animated ? 'icon-animated' : '';

    const icons = {
      // 1. LIVE indicator
      live: `
        <svg class="icon-svg icon-live ${className} ${animated}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="2" fill="${color}" />
          <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
        </svg>
      `,

      // 2. Participants / Users
      participants: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      `,

      // 3. Question
      question: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" stroke-width="3" />
        </svg>
      `,

      // 4. Timer
      timer: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      `,

      // 5. Answer / Target
      answer: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      `,

      // 6. Correct / Success
      correct: `
        <svg class="icon-svg icon-success ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      `,

      // 7. Wrong / Error
      wrong: `
        <svg class="icon-svg icon-danger ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      `,

      // 8. Lock
      lock: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      `,

      // 9. Unlock
      unlock: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        </svg>
      `,

      // 10. Draw / Roulette Wheel
      draw: `
        <svg class="icon-svg icon-spin ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="12 2 15 8 9 8" fill="${color}" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <circle cx="12" cy="12" r="2" fill="${color}" />
        </svg>
      `,

      // 11. Winner / Star
      winner: `
        <svg class="icon-svg icon-gold ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" fill-opacity="0.25" />
        </svg>
      `,

      // 12. Trophy (Metallic Cyber Trophy)
      trophy: `
        <svg class="icon-svg icon-gold ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <defs>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ffe259" />
              <stop offset="100%" stop-color="#ffa751" />
            </linearGradient>
          </defs>
          <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" stroke="url(#goldGrad)" />
          <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" stroke="url(#goldGrad)" />
          <path d="M4 3h16v6a8 8 0 0 1-16 0V3z" fill="url(#goldGrad)" fill-opacity="0.2" stroke="url(#goldGrad)" />
          <path d="M12 17v4" stroke="url(#goldGrad)" />
          <path d="M8 21h8" stroke="url(#goldGrad)" />
          <polygon points="12 6 13.5 9 10.5 9" fill="#ffe259" />
        </svg>
      `,

      // 13. Crown (Sovereign Apex)
      crown: `
        <svg class="icon-svg icon-gold ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 18h20v2H2z" fill="${color}" fill-opacity="0.3" />
          <path d="M3 18L5 7l4.5 5.5L12 4l2.5 8.5L19 7l2 11H3z" fill="${color}" fill-opacity="0.2" />
          <circle cx="12" cy="4" r="1.5" fill="${color}" />
          <circle cx="5" cy="7" r="1.2" fill="${color}" />
          <circle cx="19" cy="7" r="1.2" fill="${color}" />
        </svg>
      `,

      // 14. Flame / Streak (Energy Plasma Flame)
      flame: `
        <svg class="icon-svg icon-flame ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8.5 14.5A4.5 4.5 0 0 0 13 19c2.48 0 4.5-2.02 4.5-4.5 0-3-2.5-5.5-3.5-7.5-1 2-2 3-3.5 3-1.5 0-2.5-1-2.5-2.5C6 10 5.5 13 8.5 14.5z" fill="${color}" fill-opacity="0.35" />
          <path d="M12 2C8.5 6 6 10 6 14.5a6 6 0 0 0 12 0c0-4-3-8-6-12.5z" />
        </svg>
      `,

      // 15. Bolt / Energy Spark
      bolt: `
        <svg class="icon-svg icon-bolt ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="${color}" fill-opacity="0.3" />
        </svg>
      `,

      // 16. Star / Sparkle
      star: `
        <svg class="icon-svg icon-gold ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 14.8 8.6 22 9.3 16.5 14.1 18.2 21.2 12 17.5 5.8 21.2 7.5 14.1 2 9.3 9.2 8.6 12 2" fill="${color}" fill-opacity="0.3" />
        </svg>
      `,

      // 17. Diamond / Gem
      diamond: `
        <svg class="icon-svg icon-cyan ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 3h12l4 6-10 12L2 9z" fill="${color}" fill-opacity="0.2" />
          <path d="M11 3L8 9l4 12 4-12-3-6" />
          <path d="M2 9h20" />
        </svg>
      `,

      // 18. Gift Box (Cyber Relic)
      gift: `
        <svg class="icon-svg icon-gift ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 12 20 22 4 22 4 12" />
          <rect x="2" y="7" width="20" height="5" rx="1" fill="${color}" fill-opacity="0.15" />
          <line x1="12" y1="22" x2="12" y2="7" />
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
        </svg>
      `,

      // 19. Rocket / Boost (Propulsion Shard)
      rocket: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
          <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" fill="${color}" fill-opacity="0.2" />
          <path d="M9 12l2 2" />
        </svg>
      `,

      // 20. Ranking / Podium
      ranking: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" stroke-width="3" />
          <line x1="12" y1="20" x2="12" y2="4" stroke-width="3" />
          <line x1="6" y1="20" x2="6" y2="14" stroke-width="3" />
        </svg>
      `,

      // 21. Comments / Chat
      comments: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      `,

      // 22. Settings
      settings: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      `,

      // 23. Play
      play: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      `,

      // 24. Pause
      pause: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
      `,

      // 25. Next / Forward
      next: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 4 15 12 5 20 5 4" fill="${color}" />
          <line x1="19" y1="5" x2="19" y2="19" stroke-width="2.5" />
        </svg>
      `,

      // 26. Back
      back: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      `,

      // 27. Close
      close: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      `,

      // 28. Refresh
      refresh: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      `,

      // 29. Share
      share: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      `,

      // 30. Sound On
      sound: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="${color}" fill-opacity="0.3" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      `,

      // 31. Mute
      mute: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="${color}" fill-opacity="0.3" />
          <line x1="23" y1="9" x2="17" y2="15" stroke-width="2.5" />
          <line x1="17" y1="9" x2="23" y2="15" stroke-width="2.5" />
        </svg>
      `,

      // 32. Heart / Cyber Like
      heart: `
        <svg class="icon-svg icon-heart ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="currentColor" fill-opacity="0.25" />
        </svg>
      `,

      // 33. Eye / Viewers
      eye: `
        <svg class="icon-svg ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      `
    };

    return icons[name.toLowerCase()] || `<!-- Icon ${name} not found -->`;
  }
}

if (typeof window !== 'undefined') {
  window.IconSystem = IconSystem;
}
if (typeof globalThis !== 'undefined') {
  globalThis.IconSystem = IconSystem;
}
