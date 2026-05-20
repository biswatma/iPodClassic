/* ==========================================================================
   Music Quiz (iPod Retro Interactive Music Trivia)
   ========================================================================== */

import { audioEngine } from '../audio.js';

export class MusicQuizGame {
  constructor(canvas, onScore, onLives, onGameOver) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onScore = onScore;
    this.onLives = onLives;
    this.onGameOver = onGameOver;

    this.active = false;
    this.timerId = null;

    this.score = 0;
    this.lives = 3;

    this.currentTrack = null;
    this.options = [];
    this.selectedIndex = 0;

    // Timer settings (12 seconds per question)
    this.duration = 12000; // ms
    this.timeLeft = 12000;
    this.lastTime = 0;

    // Set of fallback nostalgic titles if library is small
    this.nostalgiaSongPool = [
      { title: "Toxic", artist: "Britney Spears" },
      { title: "Hey Ya!", artist: "Outkast" },
      { title: "Lose Yourself", artist: "Eminem" },
      { title: "Mr. Brightside", artist: "The Killers" },
      { title: "Clint Eastwood", artist: "Gorillaz" },
      { title: "Yeah!", artist: "Usher" },
      { title: "Seven Nation Army", artist: "The White Stripes" },
      { title: "Poker Face", artist: "Lady Gaga" }
    ];
  }

  init() {
    this.score = 0;
    this.lives = 3;
    this.selectedIndex = 0;
    this.onScore(this.score);
    this.onLives(this.lives);
    this.nextQuestion();
  }

  start() {
    this.active = true;
    this.lastTime = Date.now();
    this.loop();
  }

  stop() {
    this.active = false;
    audioEngine.stop(); // Stop the quiz track
    if (this.timerId) {
      cancelAnimationFrame(this.timerId);
      this.timerId = null;
    }
  }

  nextQuestion() {
    this.selectedIndex = 0;
    this.timeLeft = this.duration;

    const tracks = audioEngine.getTracks();
    if (tracks.length === 0) return;

    // Pick a random track from active library
    this.currentTrack = tracks[Math.floor(Math.random() * tracks.length)];

    // Play the song!
    audioEngine.loadTrack(this.currentTrack);
    audioEngine.play();

    // Prepare 4 choices: correct option + 3 distractors
    const choices = [this.currentTrack];
    const distPool = [...tracks.filter(t => t.id !== this.currentTrack.id), ...this.nostalgiaSongPool];

    // Shuffle and pick 3 unique distractors
    const shuffledDist = distPool.sort(() => 0.5 - Math.random());
    let addedCount = 0;
    for (let i = 0; i < shuffledDist.length && addedCount < 3; i++) {
      const dist = shuffledDist[i];
      // ensure we don't duplicate title
      if (!choices.some(c => c.title === dist.title)) {
        choices.push(dist);
        addedCount++;
      }
    }

    // Shuffle final choices
    this.options = choices.sort(() => 0.5 - Math.random());
  }

  // Click wheel scrolling moves selection up/down
  handleScroll(direction) {
    if (!this.active) return;
    if (direction === 'next') {
      this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
    } else {
      this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
    }
  }

  // Center Select confirms choice
  handleSelect() {
    if (!this.active) {
      this.init();
      this.start();
      return;
    }

    const selected = this.options[this.selectedIndex];
    if (selected && selected.title === this.currentTrack.title) {
      // Correct!
      this.score += 10;
      this.onScore(this.score);
      
      // Brief visual flash and skip to next
      this.flashGreen();
      setTimeout(() => {
        if (this.active) {
          this.nextQuestion();
        }
      }, 500);
    } else {
      // Incorrect!
      this.lives--;
      this.onLives(this.lives);
      this.flashRed();

      if (this.lives <= 0) {
        this.active = false;
        this.onGameOver("Quiz Complete! Score: " + this.score);
      } else {
        setTimeout(() => {
          if (this.active) {
            this.nextQuestion();
          }
        }, 500);
      }
    }
  }

  flashGreen() {
    this.drawBg = '#047857'; // emerald-green flash
  }

  flashRed() {
    this.drawBg = '#b91c1c'; // rose-red flash
  }

  loop() {
    if (!this.active) return;

    const now = Date.now();
    const dt = now - this.lastTime;
    this.lastTime = now;

    // Time decay check
    if (this.drawBg) {
      // let color flash decay back to dark blue
      this.drawBg = null;
    }

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      // Time ran out!
      this.lives--;
      this.onLives(this.lives);
      this.flashRed();
      
      if (this.lives <= 0) {
        this.active = false;
        this.onGameOver("Time Out! Score: " + this.score);
      } else {
        this.nextQuestion();
      }
    }

    this.draw();
    this.timerId = requestAnimationFrame(() => this.loop());
  }

  draw() {
    // Clear canvas with flash feedback color or standard deep slate
    this.ctx.fillStyle = this.drawBg || '#0f172a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Header Question
    this.ctx.font = '700 13px Inter';
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.textAlign = 'center';
    this.ctx.fillText("Name the Playing Song:", this.canvas.width / 2, 25);

    // Draw choices list
    const startY = 55;
    const spacing = 32;

    this.options.forEach((opt, index) => {
      const isSelected = index === this.selectedIndex;
      const y = startY + index * spacing;

      if (isSelected) {
        // Draw selected highlight bar
        this.ctx.fillStyle = '#3b82f6';
        this.ctx.fillRect(15, y - 18, this.canvas.width - 30, 24);
        this.ctx.fillStyle = '#ffffff';
      } else {
        this.ctx.fillStyle = '#94a3b8';
      }

      this.ctx.font = isSelected ? '700 11px Inter' : '500 11px Inter';
      this.ctx.textAlign = 'left';
      // Truncate text if needed
      let label = `${opt.title} - ${opt.artist}`;
      if (label.length > 38) label = label.slice(0, 35) + "...";
      
      this.ctx.fillText(label, 25, y - 2);
    });

    // Draw countdown timer bar
    const barWidth = this.canvas.width - 30;
    const barHeight = 8;
    const barX = 15;
    const barY = this.canvas.height - 20;

    // BG bar
    this.ctx.fillStyle = '#334155';
    this.ctx.fillRect(barX, barY, barWidth, barHeight);

    // Fill bar proportional to remaining time
    const ratio = Math.max(0, this.timeLeft / this.duration);
    // Green -> Yellow -> Red gradient bar
    this.ctx.fillStyle = ratio > 0.5 ? '#10b981' : (ratio > 0.25 ? '#eab308' : '#ef4444');
    this.ctx.fillRect(barX, barY, barWidth * ratio, barHeight);
  }
}
