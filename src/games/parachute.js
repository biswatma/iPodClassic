/* ==========================================================================
   Parachute (iPod Retro Helicopter Paratrooper Assault Game)
   ========================================================================== */

export class ParachuteGame {
  constructor(canvas, onScore, onLives, onGameOver) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onScore = onScore;
    this.onLives = onLives;
    this.onGameOver = onGameOver;

    this.active = false;
    this.animationId = null;

    this.score = 0;
    this.lives = 3;

    // Turret (bottom center)
    this.turretX = canvas.width / 2;
    this.turretY = canvas.height - 12;
    this.turretAngle = -Math.PI / 2; // Pointing straight up (-90 degrees)
    this.turretLength = 16;

    // Game objects
    this.bullets = [];
    this.helicopters = [];
    this.troopers = [];
    this.explosions = [];

    // Invaders landed on each side of the turret
    this.troopersLandedLeft = 0;
    this.troopersLandedRight = 0;

    // Spawn rates
    this.heliSpawnChance = 0.012; // probability per frame
    this.bulletSpeed = 4.5;
    this.heliSpeed = 1.2;
    this.trooperFallSpeed = 0.6;
    this.parachuteOpenHeight = 55;
  }

  init() {
    this.score = 0;
    this.lives = 3;
    this.turretAngle = -Math.PI / 2;
    this.bullets = [];
    this.helicopters = [];
    this.troopers = [];
    this.explosions = [];
    this.troopersLandedLeft = 0;
    this.troopersLandedRight = 0;

    this.onScore(this.score);
    this.onLives(this.lives);
  }

  start() {
    this.active = true;
    this.loop();
  }

  stop() {
    this.active = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  // Click wheel rotates the gun turret left/right
  handleScroll(direction) {
    if (!this.active) return;

    // Rotate within bounds [-PI to 0]
    const angleStep = 0.08; // approx 5 degrees per tick
    if (direction === 'next') {
      // Clockwise -> Rotate right
      this.turretAngle = Math.min(-0.1, this.turretAngle + angleStep);
    } else {
      // Counter-clockwise -> Rotate left
      this.turretAngle = Math.max(-Math.PI + 0.1, this.turretAngle - angleStep);
    }
  }

  // Center button shoots a bullet!
  handleSelect() {
    if (!this.active) {
      this.init();
      this.start();
      return;
    }

    // Spawn bullet at the tip of the turret
    const tipX = this.turretX + Math.cos(this.turretAngle) * this.turretLength;
    const tipY = this.turretY + Math.sin(this.turretAngle) * this.turretLength;

    this.bullets.push({
      x: tipX,
      y: tipY,
      dx: Math.cos(this.turretAngle) * this.bulletSpeed,
      dy: Math.sin(this.turretAngle) * this.bulletSpeed
    });
  }

  loop() {
    if (!this.active) return;

    this.update();
    this.draw();

    this.animationId = requestAnimationFrame(() => this.loop());
  }

  update() {
    // 1. Spawn Helicopters
    if (Math.random() < this.heliSpawnChance + (this.score * 0.00002)) {
      const side = Math.random() < 0.5 ? 'left' : 'right';
      this.helicopters.push({
        x: side === 'left' ? -40 : this.canvas.width + 10,
        y: Math.random() * 45 + 18,
        dx: side === 'left' ? this.heliSpeed : -this.heliSpeed,
        dropped: false
      });
    }

    // 2. Update Helicopters
    for (let i = this.helicopters.length - 1; i >= 0; i--) {
      const h = this.helicopters[i];
      h.x += h.dx;

      // Drop trooper near the center
      if (!h.dropped && h.x > 30 && h.x < this.canvas.width - 30 && Math.random() < 0.015) {
        h.dropped = true;
        this.troopers.push({
          x: h.x,
          y: h.y + 8,
          chuteOpen: false,
          hasChute: true,
          status: 'falling'
        });
      }

      // Prune off-screen helicopters
      if (h.dx > 0 && h.x > this.canvas.width + 50) this.helicopters.splice(i, 1);
      else if (h.dx < 0 && h.x < -60) this.helicopters.splice(i, 1);
    }

    // 3. Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.dx;
      b.y += b.dy;

      // Prune off-screen bullets
      if (b.x < 0 || b.x > this.canvas.width || b.y < 0 || b.y > this.canvas.height) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check bullet vs helicopter
      let hit = false;
      for (let j = this.helicopters.length - 1; j >= 0; j--) {
        const h = this.helicopters[j];
        if (Math.abs(b.x - h.x - 10) < 18 && Math.abs(b.y - h.y - 4) < 10) {
          // Explosion!
          this.spawnExplosion(h.x + 10, h.y + 4);
          this.helicopters.splice(j, 1);
          this.score += 20;
          this.onScore(this.score);
          hit = true;
          break;
        }
      }

      if (hit) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check bullet vs paratroopers
      for (let k = this.troopers.length - 1; k >= 0; k--) {
        const t = this.troopers[k];
        if (t.status === 'falling') {
          // Bullet hits paratrooper body
          if (Math.abs(b.x - t.x) < 7 && Math.abs(b.y - t.y) < 10) {
            this.spawnExplosion(t.x, t.y);
            this.troopers.splice(k, 1);
            this.score += 10;
            this.onScore(this.score);
            hit = true;
            break;
          }
          // Bullet hits parachute (makes trooper fall rapidly!)
          else if (t.chuteOpen && Math.abs(b.x - t.x) < 14 && Math.abs(b.y - (t.y - 14)) < 6) {
            t.chuteOpen = false;
            t.hasChute = false;
            this.bullets.splice(i, 1);
            hit = true;
            break;
          }
        }
      }

      if (hit) {
        this.bullets.splice(i, 1);
      }
    }

    // 4. Update Paratroopers
    for (let i = this.troopers.length - 1; i >= 0; i--) {
      const t = this.troopers[i];

      if (t.status === 'falling') {
        // Open chute at specific height
        if (t.hasChute && t.y > this.parachuteOpenHeight) {
          t.chuteOpen = true;
        }

        // Falling speed depends on whether chute is open
        const speed = t.chuteOpen ? this.trooperFallSpeed : this.trooperFallSpeed * 2.8;
        t.y += speed;

        // Ground landing check
        if (t.y >= this.canvas.height - 15) {
          t.y = this.canvas.height - 12;
          
          if (!t.chuteOpen && t.hasChute === false) {
            // Fatal splat! Fall without chute kills them
            this.spawnExplosion(t.x, t.y);
            this.troopers.splice(i, 1);
            continue;
          }

          t.status = 'landed';
          t.chuteOpen = false;

          // Track which side they landed on
          if (t.x < this.turretX) {
            this.troopersLandedLeft++;
          } else {
            this.troopersLandedRight++;
          }

          // Check Win/Loss pyramid trigger (4 invaders on either side)
          if (this.troopersLandedLeft >= 4 || this.troopersLandedRight >= 4) {
            this.active = false;
            this.spawnExplosion(this.turretX, this.turretY);
            this.onGameOver("Base Invaded! Score: " + this.score);
          }
        }
      }
    }

    // 5. Update Explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.radius += 0.8;
      ex.life -= 0.05;
      if (ex.life <= 0) {
        this.explosions.splice(i, 1);
      }
    }
  }

  spawnExplosion(x, y) {
    this.explosions.push({ x, y, radius: 2, life: 1.0 });
  }

  draw() {
    // Space black sky
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Green ground plate
    this.ctx.fillStyle = '#065f46';
    this.ctx.fillRect(0, this.canvas.height - 12, this.canvas.width, 12);

    // Draw Turret Base (classic half-circle dome)
    this.ctx.beginPath();
    this.ctx.arc(this.turretX, this.turretY, 12, Math.PI, 0);
    this.ctx.fillStyle = '#64748b';
    this.ctx.fill();
    this.ctx.strokeStyle = '#94a3b8';
    this.ctx.stroke();

    // Draw Gun Barrel
    const tipX = this.turretX + Math.cos(this.turretAngle) * this.turretLength;
    const tipY = this.turretY + Math.sin(this.turretAngle) * this.turretLength;
    
    this.ctx.beginPath();
    this.ctx.moveTo(this.turretX, this.turretY);
    this.ctx.lineTo(tipX, tipY);
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();
    this.ctx.lineWidth = 1; // restore standard line width

    // Draw Helicopters (detailed 8-bit visual)
    this.ctx.fillStyle = '#f59e0b';
    this.helicopters.forEach(h => {
      // Body
      this.ctx.fillRect(h.x, h.y, 20, 8);
      // Rotor line
      this.ctx.strokeStyle = '#e2e8f0';
      this.ctx.beginPath();
      this.ctx.moveTo(h.x - 3, h.y - 2);
      this.ctx.lineTo(h.x + 23, h.y - 2);
      this.ctx.stroke();
      // Connector
      this.ctx.fillRect(h.x + 8, h.y - 2, 2, 2);
      // Tail boom
      const tailX = h.dx > 0 ? h.x - 6 : h.x + 20;
      this.ctx.fillRect(tailX, h.y + 2, 6, 2);
      this.ctx.fillRect(tailX + (h.dx > 0 ? 0 : 4), h.y - 2, 2, 4);
    });

    // Draw Bullets (glowing orange pulses)
    this.ctx.fillStyle = '#ff781e';
    this.bullets.forEach(b => {
      this.ctx.beginPath();
      this.ctx.arc(b.x, b.y, 2, 0, Math.PI*2);
      this.ctx.fill();
    });

    // Draw Paratroopers
    this.troopers.forEach(t => {
      if (t.status === 'falling') {
        // Drifter body (small stick figure)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(t.x - 2, t.y - 4, 4, 6); // torso
        this.ctx.fillRect(t.x - 1, t.y - 7, 2, 2); // head
        
        // Limbs
        this.ctx.strokeStyle = '#94a3b8';
        this.ctx.beginPath();
        // Arms up
        this.ctx.moveTo(t.x - 4, t.y - 4);
        this.ctx.lineTo(t.x, t.y - 2);
        this.ctx.lineTo(t.x + 4, t.y - 4);
        // Legs dangling
        this.ctx.moveTo(t.x - 2, t.y + 6);
        this.ctx.lineTo(t.x - 2, t.y + 2);
        this.ctx.moveTo(t.x + 2, t.y + 6);
        this.ctx.lineTo(t.x + 2, t.y + 2);
        this.ctx.stroke();

        // Parachute (domed arcs)
        if (t.chuteOpen) {
          // Lines connecting body to chute
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          this.ctx.beginPath();
          this.ctx.moveTo(t.x - 8, t.y - 14);
          this.ctx.lineTo(t.x, t.y - 6);
          this.ctx.moveTo(t.x + 8, t.y - 14);
          this.ctx.lineTo(t.x, t.y - 6);
          this.ctx.stroke();

          // Chute canopy
          this.ctx.fillStyle = '#ef4444'; // Red parachute
          this.ctx.beginPath();
          this.ctx.arc(t.x, t.y - 14, 8, Math.PI, 0);
          this.ctx.fill();
        }
      }
    });

    // Draw Landed Piles (stack paratroopers at the base corners)
    this.ctx.fillStyle = '#ffffff';
    
    // Draw left army stacked
    for (let i = 0; i < this.troopersLandedLeft; i++) {
      const x = 20 + i * 15;
      this.ctx.fillRect(x - 2, this.turretY - 4, 4, 6);
      this.ctx.fillRect(x - 1, this.turretY - 7, 2, 2);
    }

    // Draw right army stacked
    for (let i = 0; i < this.troopersLandedRight; i++) {
      const x = this.canvas.width - 20 - i * 15;
      this.ctx.fillRect(x - 2, this.turretY - 4, 4, 6);
      this.ctx.fillRect(x - 1, this.turretY - 7, 2, 2);
    }

    // Draw Explosions
    this.explosions.forEach(ex => {
      this.ctx.strokeStyle = `rgba(239, 68, 68, ${ex.life})`;
      this.ctx.fillStyle = `rgba(245, 158, 11, ${ex.life * 0.5})`;
      
      this.ctx.beginPath();
      this.ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI*2);
      this.ctx.fill();
      this.ctx.stroke();
    });

    // Alert danger if landed paratroopers is high
    if (this.troopersLandedLeft >= 3 || this.troopersLandedRight >= 3) {
      this.ctx.font = '700 9px Inter';
      this.ctx.fillStyle = '#ef4444';
      this.ctx.textAlign = 'center';
      this.ctx.fillText("⚠️ CRITICAL BASE WARNING ⚠️", this.canvas.width / 2, 12);
    }
  }
}
