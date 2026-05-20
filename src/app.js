/* ==========================================================================
   iPod Coordinator & Global App Controller (Drag-Drop, Playback, Visuals)
   ========================================================================== */

import { audioEngine } from './audio.js';
import { clickWheel } from './clickwheel.js';
import { menuEngine } from './menu.js';

// Games modules
import { BrickGame } from './games/brick.js';
import { MusicQuizGame } from './games/musicquiz.js';
import { ParachuteGame } from './games/parachute.js';

class IpodAppController {
  constructor() {
    this.activeScreen = 'menu'; // 'menu', 'player', 'game'
    this.activeGameId = null;
    this.activeGame = null;

    // UI elements
    this.menuView = document.getElementById('menu-list-panel');
    this.previewPanel = document.getElementById('preview-panel');
    
    this.playerView = document.getElementById('now-playing-view');
    this.gameView = document.getElementById('game-view');
    this.customView = document.getElementById('custom-screen-view');

    // Volume overlay timer
    this.volumeTimer = null;

    // Backlight timer
    this.backlightTimer = null;
    this.backlightTimeoutDuration = 20000; // 20 seconds
  }

  init() {
    // 1. Initialize modular sub-elements
    audioEngine.initContext();
    clickWheel.init();
    menuEngine.init();

    // 2. Bind wheel inputs
    this.bindClickWheelInputs();

    // 3. Bind playback updates
    this.bindAudioPlaybackUpdates();

    // 4. Setup drag and drop sync
    this.setupDragAndDrop();

    // 5. Initialize backlight
    this.resetBacklightTimer();

    // 6. Setup instruction panel toggle
    this.setupInstructionToggle();

    console.log("iPod Classic app successfully initialized.");
  }

  // ==========================================================================
  // Click Wheel bindings
  // ==========================================================================
  bindClickWheelInputs() {
    // Scroll Events (Clockwise / Counter-clockwise)
    clickWheel.onScrollDown = () => {
      this.wakeBacklight();
      if (this.activeScreen === 'game' && this.activeGame) {
        this.activeGame.handleScroll('next');
      } 
      else if (this.activeScreen === 'player') {
        this.adjustVolume(0.04);
      } 
      else {
        menuEngine.scrollNext();
      }
    };

    clickWheel.onScrollUp = () => {
      this.wakeBacklight();
      if (this.activeScreen === 'game' && this.activeGame) {
        this.activeGame.handleScroll('prev');
      } 
      else if (this.activeScreen === 'player') {
        this.adjustVolume(-0.04);
      } 
      else {
        menuEngine.scrollPrev();
      }
    };

    // MENU Button (Top of Wheel) -> Back navigation
    clickWheel.onMenuClick = () => {
      this.wakeBacklight();
      
      if (this.activeScreen === 'game') {
        this.exitGame();
      } 
      else if (this.activeScreen === 'player') {
        this.exitPlayer();
      } 
      else {
        menuEngine.goBack();
      }
    };

    // SELECT Button (Center Button) -> Confirm actions
    clickWheel.onSelectClick = () => {
      this.wakeBacklight();
      
      if (this.activeScreen === 'game' && this.activeGame) {
        this.activeGame.handleSelect();
      } 
      else if (this.activeScreen === 'menu') {
        const result = menuEngine.select();
        if (result) {
          if (result.action === 'play-song') {
            this.launchSong(result.track);
          } 
          else if (result.action === 'open-player') {
            this.switchToScreen('player');
          } 
          else if (result.action === 'start-game') {
            this.launchGame(result.gameId);
          }
        }
      }
    };

    // PLAY/PAUSE Button (Bottom of Wheel)
    clickWheel.onPlayClick = () => {
      this.wakeBacklight();
      
      // Stopwatch exception: play acts as start/stop trigger
      if (menuEngine.currentMenu.id === 'stopwatch' && this.activeScreen === 'menu') {
        menuEngine.triggerStopwatchPlay();
        return;
      }

      if (this.activeScreen === 'game') return; // ignored in games

      if (audioEngine.currentTrack) {
        if (audioEngine.isPlaying) {
          audioEngine.pause();
          document.getElementById('play-status-icon').textContent = '⏸';
          document.getElementById('player-art-box').querySelector('.vinyl-disc')?.classList.add('paused');
        } else {
          audioEngine.play();
          document.getElementById('play-status-icon').textContent = '▶';
          document.getElementById('player-art-box').querySelector('.vinyl-disc')?.classList.remove('paused');
        }
      }
    };

    // PREV Button (Left of Wheel) -> Skip Back / Reset
    clickWheel.onPrevClick = () => {
      this.wakeBacklight();
      
      // Stopwatch exception: reset stopwatch
      if (menuEngine.currentMenu.id === 'stopwatch' && this.activeScreen === 'menu') {
        menuEngine.resetStopwatch();
        return;
      }

      if (this.activeScreen === 'player') {
        // Skip backward or restart track
        const tracks = audioEngine.getTracks();
        const idx = tracks.findIndex(t => t.id === audioEngine.currentTrack.id);
        if (idx > 0) {
          this.launchSong(tracks[idx - 1]);
        } else {
          audioEngine.loadTrack(audioEngine.currentTrack);
          audioEngine.play();
        }
      }
    };

    // NEXT Button (Right of Wheel) -> Skip Forward / Lap Split
    clickWheel.onNextClick = () => {
      this.wakeBacklight();
      
      // Stopwatch exception: trigger lap split
      if (menuEngine.currentMenu.id === 'stopwatch' && this.activeScreen === 'menu') {
        menuEngine.recordStopwatchLap();
        return;
      }

      if (this.activeScreen === 'player') {
        // Skip forward
        const tracks = audioEngine.getTracks();
        const idx = tracks.findIndex(t => t.id === audioEngine.currentTrack.id);
        if (idx !== -1 && idx < tracks.length - 1) {
          this.launchSong(tracks[idx + 1]);
        }
      }
    };
  }

  // ==========================================================================
  // Audio playback bindings & Volume HUD
  // ==========================================================================
  bindAudioPlaybackUpdates() {
    const timeElapsedEl = document.getElementById('player-time-elapsed');
    const timeRemainingEl = document.getElementById('player-time-remaining');
    const progressFillEl = document.getElementById('player-progress-fill');

    // Progress ticking bar
    audioEngine.onProgressCallback = (elapsed, duration) => {
      if (this.activeScreen !== 'player') return;

      const format = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = String(Math.floor(seconds % 60)).padStart(2, '0');
        return `${m}:${s}`;
      };

      timeElapsedEl.textContent = format(elapsed);
      timeRemainingEl.textContent = '-' + format(Math.max(0, duration - elapsed));

      const percentage = duration > 0 ? (elapsed / duration) * 100 : 0;
      progressFillEl.style.width = percentage + '%';
    };

    // Dynamic track completion -> Auto advance playlist
    audioEngine.onTrackEndedCallback = () => {
      const tracks = audioEngine.getTracks();
      const idx = tracks.findIndex(t => t.id === audioEngine.currentTrack.id);
      if (idx !== -1 && idx < tracks.length - 1) {
        this.launchSong(tracks[idx + 1]);
      } else {
        // Loop back to start
        document.getElementById('play-status-icon').textContent = '⏸';
        document.getElementById('player-art-box').querySelector('.vinyl-disc')?.classList.add('paused');
      }
    };
  }

  adjustVolume(delta) {
    const newVol = Math.max(0, Math.min(1, audioEngine.getVolume() + delta));
    audioEngine.setVolume(newVol);

    // Update Volume progress UI
    const bar = document.getElementById('volume-bar-fill');
    const overlay = document.getElementById('volume-overlay');
    if (bar && overlay) {
      bar.style.width = (newVol * 100) + '%';
      overlay.classList.add('active');

      // Dismiss volume HUD after brief timeout
      if (this.volumeTimer) clearTimeout(this.volumeTimer);
      this.volumeTimer = setTimeout(() => {
        overlay.classList.remove('active');
      }, 1500);
    }
  }

  // ==========================================================================
  // Screen transitions
  // ==========================================================================
  switchToScreen(screen) {
    this.activeScreen = screen;

    // Deactivate everything
    this.menuView.style.display = 'none';
    this.previewPanel.style.display = 'none';
    this.playerView.classList.remove('active');
    this.gameView.classList.remove('active');
    this.customView.classList.remove('active');

    // Stop active chiptune sequencer or canvas loops if switching away
    if (screen !== 'game') {
      if (this.activeGame) {
        this.activeGame.stop();
        this.activeGame = null;
      }
    }

    if (screen === 'menu') {
      menuEngine.renderCurrentMenu(); // Restore dual panels
    } 
    else if (screen === 'player') {
      this.playerView.classList.add('active');
      this.updatePlayerScreenUI();
    } 
    else if (screen === 'game') {
      this.gameView.classList.add('active');
    }
  }

  launchSong(track) {
    audioEngine.loadTrack(track);
    audioEngine.play();

    this.switchToScreen('player');
    
    // Status Bar indicator
    document.getElementById('play-status-icon').textContent = '▶';
  }

  updatePlayerScreenUI() {
    const track = audioEngine.currentTrack;
    if (!track) return;

    document.getElementById('status-title').textContent = "Now Playing";
    document.getElementById('player-song-title').textContent = track.title;
    document.getElementById('player-song-artist').textContent = track.artist;
    document.getElementById('player-song-album').textContent = track.album;

    // Track index number
    const tracks = audioEngine.getTracks();
    const idx = tracks.findIndex(t => t.id === track.id) + 1;
    document.getElementById('player-track-count').textContent = `${idx} of ${tracks.length}`;

    // Setup custom album art background
    const artBox = document.getElementById('player-art-box');
    const artLabel = document.getElementById('player-art-label');
    
    artBox.style.background = menuEngine.getRandomGradient(track.title);
    artLabel.textContent = track.artLabel || '🎵';

    const disc = artBox.querySelector('.vinyl-disc');
    if (disc) {
      disc.className = 'vinyl-disc animate-spin';
      if (!audioEngine.isPlaying) disc.classList.add('paused');
    }
  }

  exitPlayer() {
    this.switchToScreen('menu');
  }

  // ==========================================================================
  // Canvas games orchestrator
  // ==========================================================================
  launchGame(gameId) {
    this.switchToScreen('game');
    this.activeGameId = gameId;

    const canvas = document.getElementById('game-canvas');
    const scoreVal = document.getElementById('game-score');
    const livesVal = document.getElementById('game-lives');
    const hudMsg = document.getElementById('game-message');

    // UI HUD callback binders
    const onScoreChange = (score) => { scoreVal.textContent = "Score: " + score; };
    const onLivesChange = (lives) => { livesVal.textContent = "Lives: " + lives; };
    const onGameOver = (msg) => { hudMsg.textContent = msg; };

    hudMsg.textContent = "Press Center to Start";

    if (gameId === 'game-brick') {
      document.getElementById('status-title').textContent = "Brick Breaker";
      this.activeGame = new BrickGame(canvas, onScoreChange, onLivesChange, onGameOver);
    } 
    else if (gameId === 'game-quiz') {
      document.getElementById('status-title').textContent = "Music Quiz";
      this.activeGame = new MusicQuizGame(canvas, onScoreChange, onLivesChange, onGameOver);
    }
    else if (gameId === 'game-parachute') {
      document.getElementById('status-title').textContent = "Parachute";
      this.activeGame = new ParachuteGame(canvas, onScoreChange, onLivesChange, onGameOver);
    }

    if (this.activeGame) {
      this.activeGame.init();
    }
  }

  exitGame() {
    this.switchToScreen('menu');
  }

  // ==========================================================================
  // Drag & Drop Music Uploader
  // ==========================================================================
  setupDragAndDrop() {
    const overlay = document.getElementById('drag-overlay');
    const dropZone = document.getElementById('drop-zone-instruction');

    const handleDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      overlay.classList.add('active');
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      overlay.classList.add('active');
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      overlay.classList.remove('active');
    };

    const handleDrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      overlay.classList.remove('active');

      const files = Array.from(e.dataTransfer.files);
      const audioFiles = files.filter(f => f.type.startsWith('audio/') || f.name.endsWith('.mp3'));

      if (audioFiles.length === 0) {
        alert("Please drop valid audio files (.mp3, .ogg, .wav).");
        return;
      }

      // Read files one by one and sync them into Library
      for (const file of audioFiles) {
        try {
          const track = await audioEngine.addCustomTrack(file);
          console.log(`Synced track: ${track.title}`);
        } catch (err) {
          console.warn("Failed to parse file metadata", err);
        }
      }

      // Reset list panels so that new tracks display immediately
      menuEngine.renderCurrentMenu();
      alert(`Successfully synced ${audioFiles.length} nostalgic tracks! Browse them under Music -> Songs.`);
    };

    // Register listeners globally so user can drop anywhere on viewport!
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
  }

  // ==========================================================================
  // Backlight dimmer rules
  // ==========================================================================
  resetBacklightTimer() {
    if (this.backlightTimer) clearTimeout(this.backlightTimer);
    
    this.backlightTimer = setTimeout(() => {
      const screen = document.getElementById('ipod-screen');
      if (screen) {
        screen.classList.add('backlight-off');
      }
    }, this.backlightTimeoutDuration);
  }

  wakeBacklight() {
    const screen = document.getElementById('ipod-screen');
    if (screen && screen.classList.contains('backlight-off')) {
      screen.classList.remove('backlight-off');
    }
    this.resetBacklightTimer();
  }

  // Bind instruction modal handlers
  setupInstructionToggle() {
    const infoToggle = document.getElementById('info-toggle');
    const instructionClose = document.getElementById('instruction-close');
    const instructionPanel = document.getElementById('instruction-panel');
    const backdrop = document.getElementById('modal-backdrop');

    if (!infoToggle || !instructionPanel || !backdrop) return;

    const show = () => {
      instructionPanel.classList.add('active');
      backdrop.classList.add('active');
    };

    const hide = () => {
      instructionPanel.classList.remove('active');
      backdrop.classList.remove('active');
    };

    infoToggle.addEventListener('click', show);
    if (instructionClose) instructionClose.addEventListener('click', hide);
    backdrop.addEventListener('click', hide);
  }
}

// Instantiate and start app on page load
window.addEventListener('DOMContentLoaded', () => {
  const app = new IpodAppController();
  app.init();
});
