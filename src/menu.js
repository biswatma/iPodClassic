/* ==========================================================================
   iPod OS Menu Tree Engine & Interactive Extras (Clock, Calendar, Stopwatch)
   ========================================================================== */

import { audioEngine } from './audio.js';

class IpodMenuEngine {
  constructor() {
    this.historyStack = []; // stores { menuNode, selectedIndex }
    this.currentMenu = null;
    this.selectedIndex = 0;

    // Running clocks/timers
    this.clockInterval = null;
    this.stopwatchTimer = null;

    // Stopwatch State
    this.swIsRunning = false;
    this.swStartTime = 0;
    this.swElapsed = 0;
    this.swLaps = [];

    // Built-in Easter-Egg Contacts
    this.contacts = [
      { name: "Steve Jobs", title: "Apple Co-Founder", phone: "1-800-MY-APPLE", email: "steve@apple.com", quote: "Here's to the crazy ones. Stay hungry, stay foolish." },
      { name: "Tony Fadell", title: "iPod Creator", phone: "555-IPOD-GUY", email: "tony@nest.com", quote: "1,000 songs in your pocket was just the start." },
      { name: "Jony Ive", title: "Chief Design Officer", phone: "00-ALUMINUM", email: "jony@lovefrom.com", quote: "It's extremely thin, machined from a solid block of aluminum." },
      { name: "Steve Wozniak", title: "Apple Co-Founder", phone: "1337-WOZ", email: "woz@woz.org", quote: "Never trust a computer you can't throw out a window." },
      { name: "Phil Schiller", title: "Marketing VP", phone: "555-WHEEL", email: "phil@apple.com", quote: "The scroll wheel is the ideal interface for navigating thousands of items." }
    ];

    // Menu Structure Definition
    this.menuRoot = {
      id: 'main',
      title: 'iPod',
      type: 'list',
      getItems: () => [
        { label: 'Music', target: 'music', type: 'submenu' },
        { label: 'Games', target: 'games', type: 'submenu' },
        { label: 'Extras', target: 'extras', type: 'submenu' },
        { label: 'Settings', target: 'settings', type: 'submenu' }
      ]
    };

    this.submenus = {
      music: {
        id: 'music',
        title: 'Music',
        type: 'list',
        getItems: () => {
          const items = [
            { label: 'Playlists', target: 'playlists', type: 'submenu' },
            { label: 'Artists', target: 'artists', type: 'submenu' },
            { label: 'Albums', target: 'albums', type: 'submenu' },
            { label: 'Songs', target: 'songs', type: 'submenu' }
          ];
          // If a track is active, show the "Now Playing" option
          if (audioEngine.currentTrack) {
            items.push({ label: 'Now Playing', target: 'now-playing', type: 'player' });
          }
          return items;
        }
      },
      playlists: {
        id: 'playlists',
        title: 'Playlists',
        type: 'list',
        getItems: () => [
          { label: 'All Synced Tracks', target: 'songs', type: 'submenu' },
          { label: 'Built-in Synth Covers', target: 'playlist-synth', type: 'submenu' },
          { label: '2000s Nostalgia Hits', target: 'playlist-nostalgia', type: 'submenu' }
        ]
      },
      'playlist-synth': {
        id: 'playlist-synth',
        title: 'Synth Playlist',
        type: 'list',
        getItems: () => {
          return audioEngine.getTracks()
            .filter(t => t.isSynth)
            .map(t => ({ label: t.title, track: t, type: 'song' }));
        }
      },
      'playlist-nostalgia': {
        id: 'playlist-nostalgia',
        title: 'Nostalgia Hits',
        type: 'list',
        getItems: () => {
          return audioEngine.getTracks()
            .filter(t => t.id.includes('daft') || t.id.includes('clocks'))
            .map(t => ({ label: t.title, track: t, type: 'song' }));
        }
      },
      artists: {
        id: 'artists',
        title: 'Artists',
        type: 'list',
        getItems: () => {
          const artists = [...new Set(audioEngine.getTracks().map(t => t.artist))];
          return artists.map(a => ({ label: a, artistName: a, target: `artist-${a}`, type: 'artist' }));
        }
      },
      albums: {
        id: 'albums',
        title: 'Albums',
        type: 'list',
        getItems: () => {
          const albums = [...new Set(audioEngine.getTracks().map(t => t.album))];
          return albums.map(al => ({ label: al, albumName: al, target: `album-${al}`, type: 'album' }));
        }
      },
      songs: {
        id: 'songs',
        title: 'Songs',
        type: 'list',
        getItems: () => {
          return audioEngine.getTracks().map(t => ({
            label: t.title,
            track: t,
            type: 'song'
          }));
        }
      },
      games: {
        id: 'games',
        title: 'Games',
        type: 'list',
        getItems: () => [
          { label: 'Brick (Breakout)', target: 'game-brick', type: 'game' },
          { label: 'Music Quiz', target: 'game-quiz', type: 'game' },
          { label: 'Parachute', target: 'game-parachute', type: 'game' }
        ]
      },
      extras: {
        id: 'extras',
        title: 'Extras',
        type: 'list',
        getItems: () => [
          { label: 'Clock', target: 'clock', type: 'custom' },
          { label: 'Calendar', target: 'calendar', type: 'custom' },
          { label: 'Contacts', target: 'contacts', type: 'custom' },
          { label: 'Stopwatch', target: 'stopwatch', type: 'custom' }
        ]
      },
      contacts: {
        id: 'contacts',
        title: 'Contacts',
        type: 'list',
        getItems: () => {
          return this.contacts.map(c => ({
            label: c.name,
            target: `contact-detail-${c.name.replace(/\s+/g, '')}`,
            contact: c,
            type: 'contact'
          }));
        }
      },
      settings: {
        id: 'settings',
        title: 'Settings',
        type: 'list',
        getItems: () => [
          { label: 'Wheel Sound: ' + (audioEngine.clickerSoundEnabled ? 'On' : 'Off'), action: 'toggle-sound', type: 'action' },
          { label: 'Theme: ' + this.getThemeName(), target: 'theme-settings', type: 'submenu' },
          { label: 'LCD Light: Blue', action: 'toggle-backlight', type: 'action' },
          { label: 'About', target: 'about', type: 'submenu' }
        ]
      },
      'theme-settings': {
        id: 'theme-settings',
        title: 'Themes',
        type: 'list',
        getItems: () => [
          { label: 'Classic Silver', action: 'theme-silver', type: 'action' },
          { label: 'Stealth Black', action: 'theme-black', type: 'action' },
          { label: 'U2 Special Edition', action: 'theme-u2', type: 'action' }
        ]
      },
      about: {
        id: 'about',
        title: 'About',
        type: 'custom',
        render: (container) => {
          container.innerHTML = `
            <div class="retro-title-header">iPod Classic</div>
            <div style="font-size: 11px; line-height: 1.6; padding: 10px; color: #111827;">
              <strong>Model:</strong> MC297LL/A<br>
              <strong>Capacity:</strong> 160 GB<br>
              <strong>Format:</strong> Windows (FAT32)<br>
              <strong>Version:</strong> 1.0.3 Web Retro<br>
              <strong>Songs:</strong> ${audioEngine.getTracks().length}<br>
              <strong>Serial No:</strong> 8U6041H9Z2U<br><br>
              <div style="text-align: center; color: #ef4444; font-weight: 700;">🍎 Designed by Apple in California</div>
            </div>
          `;
        }
      }
    };
  }

  // Visual Theme mappings
  getThemeName() {
    const chassis = document.getElementById('ipod');
    if (!chassis) return 'Silver';
    if (chassis.classList.contains('theme-black')) return 'Stealth Black';
    if (chassis.classList.contains('theme-u2')) return 'U2 Edition';
    return 'Classic Silver';
  }

  init() {
    this.currentMenu = this.menuRoot;
    this.selectedIndex = 0;
    this.renderCurrentMenu();
    this.startGlobalClock();
  }

  // Scroll wheel events
  scrollNext() {
    const items = this.currentMenu.getItems ? this.currentMenu.getItems() : [];
    if (items.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % items.length;
    this.renderCurrentMenu();
  }

  scrollPrev() {
    const items = this.currentMenu.getItems ? this.currentMenu.getItems() : [];
    if (items.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + items.length) % items.length;
    this.renderCurrentMenu();
  }

  // Handle selection (Middle button press)
  select() {
    const items = this.currentMenu.getItems ? this.currentMenu.getItems() : [];
    if (items.length === 0) return null;

    const selectedItem = items[this.selectedIndex];
    if (!selectedItem) return null;

    // Handle standard navigation
    if (selectedItem.type === 'submenu') {
      this.drillDown(this.submenus[selectedItem.target]);
    } 
    else if (selectedItem.type === 'song') {
      // Return details to app.js to trigger audio play
      return { action: 'play-song', track: selectedItem.track };
    } 
    else if (selectedItem.type === 'player') {
      return { action: 'open-player' };
    }
    else if (selectedItem.type === 'game') {
      return { action: 'start-game', gameId: selectedItem.target };
    } 
    else if (selectedItem.type === 'custom') {
      this.drillDown(this.submenus[selectedItem.target] || this.createCustomPage(selectedItem.target));
    }
    else if (selectedItem.type === 'contact') {
      this.drillDown(this.createContactDetailPage(selectedItem.contact));
    }
    else if (selectedItem.type === 'action') {
      this.executeMenuAction(selectedItem.action);
    }
    else if (selectedItem.type === 'artist') {
      this.drillDown(this.createArtistPlaylistPage(selectedItem.artistName));
    }
    else if (selectedItem.type === 'album') {
      this.drillDown(this.createAlbumPlaylistPage(selectedItem.albumName));
    }

    return null;
  }

  // Back menu traversal
  goBack() {
    this.stopStopwatch(); // clean up if leaving stopwatch
    if (this.historyStack.length > 0) {
      const prev = this.historyStack.pop();
      this.currentMenu = prev.menuNode;
      this.selectedIndex = prev.selectedIndex;
      this.renderCurrentMenu();
      return true;
    }
    return false; // already at root
  }

  drillDown(targetNode) {
    if (!targetNode) return;
    this.historyStack.push({
      menuNode: this.currentMenu,
      selectedIndex: this.selectedIndex
    });
    this.currentMenu = targetNode;
    this.selectedIndex = 0;
    this.renderCurrentMenu();
  }

  // Dynamic content builders
  createArtistPlaylistPage(artistName) {
    return {
      id: `artist-${artistName}`,
      title: artistName,
      type: 'list',
      getItems: () => {
        return audioEngine.getTracks()
          .filter(t => t.artist === artistName)
          .map(t => ({ label: t.title, track: t, type: 'song' }));
      }
    };
  }

  createAlbumPlaylistPage(albumName) {
    return {
      id: `album-${albumName}`,
      title: albumName,
      type: 'list',
      getItems: () => {
        return audioEngine.getTracks()
          .filter(t => t.album === albumName)
          .map(t => ({ label: t.title, track: t, type: 'song' }));
      }
    };
  }

  createContactDetailPage(contact) {
    return {
      id: `contact-detail-${contact.name.replace(/\s+/g, '')}`,
      title: 'Contact',
      type: 'custom',
      render: (container) => {
        container.innerHTML = `
          <div class="retro-title-header">${contact.name}</div>
          <div style="font-size: 11px; padding: 10px; line-height: 1.5; color: #111827;">
            <strong>Title:</strong> ${contact.title}<br>
            <strong>Phone:</strong> ${contact.phone}<br>
            <strong>Email:</strong> ${contact.email}<br><br>
            <div style="font-style: italic; border-left: 2px solid #ef4444; padding-left: 8px; color: #4b5563;">
              "${contact.quote}"
            </div>
          </div>
        `;
      }
    };
  }

  createCustomPage(targetId) {
    if (targetId === 'clock') {
      return {
        id: 'clock',
        title: 'Clock',
        type: 'custom',
        render: (container) => {
          container.innerHTML = `
            <div class="retro-title-header">Clock</div>
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; padding-bottom:10px;">
              <div class="analog-clock" style="width:105px; height:105px; border-width:4px;">
                <div class="clock-hand hour-hand" id="inner-hand-hour" style="height:28px;"></div>
                <div class="clock-hand minute-hand" id="inner-hand-minute" style="height:42px;"></div>
                <div class="clock-hand second-hand" id="inner-hand-second" style="height:46px;"></div>
                <div class="clock-center"></div>
              </div>
              <div id="inner-digital-time" style="font-size: 16px; font-weight:700; margin-top:8px; font-family:'Share Tech Mono';">12:00:00 PM</div>
            </div>
          `;
          this.updateInteractiveClocks();
        }
      };
    }
    else if (targetId === 'calendar') {
      return {
        id: 'calendar',
        title: 'Calendar',
        type: 'custom',
        render: (container) => {
          const date = new Date();
          const year = date.getFullYear();
          const month = date.getMonth();
          const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          
          const firstDay = new Date(year, month, 1).getDay();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          
          let gridItems = '';
          // Blank padding days
          for (let i = 0; i < firstDay; i++) {
            gridItems += `<div class="calendar-day"></div>`;
          }
          // Dynamic numeric dates
          for (let day = 1; day <= daysInMonth; day++) {
            const isToday = day === date.getDate() ? 'today' : '';
            gridItems += `<div class="calendar-day ${isToday}">${day}</div>`;
          }

          container.innerHTML = `
            <div class="retro-title-header">${monthNames[month]} ${year}</div>
            <div class="calendar-grid" style="padding: 0 10px;">
              <div class="calendar-day-name">S</div>
              <div class="calendar-day-name">M</div>
              <div class="calendar-day-name">T</div>
              <div class="calendar-day-name">W</div>
              <div class="calendar-day-name">T</div>
              <div class="calendar-day-name">F</div>
              <div class="calendar-day-name">S</div>
              ${gridItems}
            </div>
          `;
        }
      };
    }
    else if (targetId === 'stopwatch') {
      return {
        id: 'stopwatch',
        title: 'Stopwatch',
        type: 'custom',
        render: (container) => {
          container.innerHTML = `
            <div class="retro-title-header">Stopwatch</div>
            <div class="stopwatch-layout">
              <div class="stopwatch-time" id="sw-time-display">00:00.00</div>
              <div class="stopwatch-controls">
                <strong>Play/Pause</strong>: Start / Stop<br>
                <strong>⏮ Button</strong>: Reset Time<br>
                <strong>Center Button</strong>: Lap Split
              </div>
              <div id="sw-laps-box" style="width: 90%; max-height: 52px; overflow-y: auto; font-size: 9px; line-height:1.3; border-top:1px solid #d1d5db; padding-top:4px;">
                <!-- Lap rows here -->
              </div>
            </div>
          `;
          this.initStopwatchUI();
        }
      };
    }
    return null;
  }

  // Custom setting triggers
  executeMenuAction(action) {
    if (action === 'toggle-sound') {
      audioEngine.toggleClicker(!audioEngine.clickerSoundEnabled);
    } 
    else if (action === 'toggle-backlight') {
      const screen = document.getElementById('ipod-screen');
      if (screen) {
        if (screen.style.background.includes('blue')) {
          screen.style.background = 'var(--lcd-bg-green)';
          document.getElementById('ambient-glow').style.background = 'radial-gradient(circle, rgba(52, 211, 153, 0.15) 0%, rgba(52, 211, 153, 0.03) 50%, transparent 100%)';
        } else {
          screen.style.background = 'var(--lcd-bg-blue)';
          document.getElementById('ambient-glow').style.background = 'radial-gradient(circle, rgba(96, 165, 250, 0.15) 0%, rgba(96, 165, 250, 0.03) 50%, transparent 100%)';
        }
      }
    }
    else {
      // Theme switching
      const chassis = document.getElementById('ipod');
      if (chassis) {
        chassis.className = 'ipod-chassis'; // reset
        if (action === 'theme-silver') chassis.classList.add('theme-silver');
        if (action === 'theme-black') chassis.classList.add('theme-black');
        if (action === 'theme-u2') chassis.classList.add('theme-u2');
      }
    }
    this.renderCurrentMenu();
  }

  // Core Render
  renderCurrentMenu() {
    const listPanel = document.getElementById('menu-list-panel');
    const previewPanel = document.getElementById('preview-panel');
    const customView = document.getElementById('custom-screen-view');
    const customContent = document.getElementById('custom-screen-content');
    
    // Set Status bar title
    document.getElementById('status-title').textContent = this.currentMenu.title;

    if (this.currentMenu.type === 'list') {
      // Standard List/Split Screen layout
      listPanel.style.display = 'flex';
      previewPanel.style.display = 'block';
      customView.classList.remove('active');

      const listContainer = document.getElementById('menu-list');
      listContainer.innerHTML = '';

      const items = this.currentMenu.getItems ? this.currentMenu.getItems() : [];
      
      items.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'menu-item';
        if (index === this.selectedIndex) {
          li.classList.add('selected');
        }
        
        // Show chevrons if navigational
        const isNav = item.type === 'submenu' || item.type === 'custom' || item.type === 'contact' || item.type === 'artist' || item.type === 'album';
        li.innerHTML = `
          <span>${item.label}</span>
          ${isNav ? '<span class="chevron">▶</span>' : ''}
        `;
        listContainer.appendChild(li);
      });

      // Synchronize Right Panel previews
      this.updatePreviewPanel(items[this.selectedIndex]);

    } else if (this.currentMenu.type === 'custom') {
      // Full screen text templates
      listPanel.style.display = 'none';
      previewPanel.style.display = 'none';
      customView.classList.add('active');

      if (this.currentMenu.render && customContent) {
        this.currentMenu.render(customContent);
      }
    }
  }

  updatePreviewPanel(selectedItem) {
    // Deactivate all first
    const contents = document.querySelectorAll('.preview-content');
    contents.forEach(el => el.classList.remove('active'));

    const defPreview = document.getElementById('preview-default');
    const coverPreview = document.getElementById('preview-cover-art');
    const batteryPreview = document.getElementById('preview-battery');
    const clockPreview = document.getElementById('preview-clock');

    if (!selectedItem) {
      defPreview.classList.add('active');
      return;
    }

    if (selectedItem.type === 'song') {
      // Show cover art matching playing track details
      coverPreview.classList.add('active');
      document.getElementById('preview-art-box').style.background = this.getRandomGradient(selectedItem.label);
      document.getElementById('preview-art-label').textContent = selectedItem.track.artLabel || 'iPod Classic';
    } 
    else if (selectedItem.target === 'extras') {
      clockPreview.classList.add('active');
    }
    else if (selectedItem.target === 'settings') {
      batteryPreview.classList.add('active');
    }
    else {
      defPreview.classList.add('active');
    }
  }

  getRandomGradient(seed) {
    const hue = Math.abs(seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360);
    return `linear-gradient(135deg, hsl(${hue}, 80%, 50%) 0%, hsl(${(hue + 60) % 360}, 90%, 35%) 100%)`;
  }

  // Interactive clocks in background status bar or clock page
  startGlobalClock() {
    const update = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      
      // Update clocks shown inside preview
      const hrHand = document.getElementById('hand-hour');
      const minHand = document.getElementById('hand-minute');
      const secHand = document.getElementById('hand-second');
      if (hrHand && minHand && secHand) {
        const s = now.getSeconds();
        const m = now.getMinutes();
        const h = now.getHours();
        secHand.style.transform = `rotate(${s * 6}deg)`;
        minHand.style.transform = `rotate(${m * 6 + s * 0.1}deg)`;
        hrHand.style.transform = `rotate(${h * 30 + m * 0.5}deg)`;
      }

      // Update inner clock page if active
      this.updateInteractiveClocks(now);
    };

    update();
    this.clockInterval = setInterval(update, 1000);
  }

  updateInteractiveClocks(optDate) {
    const now = optDate || new Date();
    const innerHr = document.getElementById('inner-hand-hour');
    const innerMin = document.getElementById('inner-hand-minute');
    const innerSec = document.getElementById('inner-hand-second');
    const innerDigital = document.getElementById('inner-digital-time');

    if (innerHr && innerMin && innerSec && innerDigital) {
      const s = now.getSeconds();
      const m = now.getMinutes();
      const h = now.getHours();
      
      innerSec.style.transform = `rotate(${s * 6}deg)`;
      innerMin.style.transform = `rotate(${m * 6 + s * 0.1}deg)`;
      innerHr.style.transform = `rotate(${h * 30 + m * 0.5}deg)`;

      let hDigital = h % 12;
      hDigital = hDigital ? hDigital : 12;
      const mDigital = String(m).padStart(2, '0');
      const sDigital = String(s).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      innerDigital.textContent = `${hDigital}:${mDigital}:${sDigital} ${ampm}`;
    }
  }

  // ==========================================================================
  // Stopwatch logic bindings (Wheel buttons act as stopwatch hardware triggers)
  // ==========================================================================
  
  initStopwatchUI() {
    this.swIsRunning = false;
    this.swElapsed = 0;
    this.swLaps = [];
    this.updateStopwatchDisplay();
  }

  triggerStopwatchPlay() {
    if (this.swIsRunning) {
      this.stopStopwatch();
    } else {
      this.startStopwatch();
    }
  }

  startStopwatch() {
    if (this.swIsRunning) return;
    this.swIsRunning = true;
    this.swStartTime = Date.now() - this.swElapsed;
    
    const tick = () => {
      this.swElapsed = Date.now() - this.swStartTime;
      this.updateStopwatchDisplay();
      this.stopwatchTimer = setTimeout(tick, 30);
    };
    tick();
  }

  stopStopwatch() {
    this.swIsRunning = false;
    if (this.stopwatchTimer) {
      clearTimeout(this.stopwatchTimer);
      this.stopwatchTimer = null;
    }
  }

  resetStopwatch() {
    this.stopStopwatch();
    this.swElapsed = 0;
    this.swLaps = [];
    this.updateStopwatchDisplay();
    const box = document.getElementById('sw-laps-box');
    if (box) box.innerHTML = '';
  }

  recordStopwatchLap() {
    if (!this.swIsRunning && this.swElapsed === 0) return;
    const lapTime = this.formatTime(this.swElapsed);
    this.swLaps.unshift(lapTime); // Add to start

    const box = document.getElementById('sw-laps-box');
    if (box) {
      box.innerHTML = this.swLaps.map((lap, i) => `
        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
          <span>Lap ${this.swLaps.length - i}</span>
          <strong>${lap}</strong>
        </div>
      `).join('');
    }
  }

  updateStopwatchDisplay() {
    const el = document.getElementById('sw-time-display');
    if (el) {
      el.textContent = this.formatTime(this.swElapsed);
    }
  }

  formatTime(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const minutes = String(Math.floor(totalSecs / 60)).padStart(2, '0');
    const seconds = String(totalSecs % 60).padStart(2, '0');
    const milliseconds = String(Math.floor((ms % 1000) / 10)).padStart(2, '0');
    return `${minutes}:${seconds}.${milliseconds}`;
  }
}

export const menuEngine = new IpodMenuEngine();
export default menuEngine;
