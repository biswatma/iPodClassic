/* ==========================================================================
   Brick Breaker (iPod Breakout Retro Edition)
   ========================================================================== */

export class BrickGame {
  constructor(canvas, onScore, onLives, onGameOver) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onScore = onScore;
    this.onLives = onLives;
    this.onGameOver = onGameOver;

    this.active = false;
    this.animationId = null;

    // Game stats
    this.score = 0;
    this.lives = 3;
    this.level = 1;

    // Paddle settings
    this.paddleHeight = 10;
    this.paddleWidth = 60;
    this.paddleX = (canvas.width - this.paddleWidth) / 2;

    // Ball settings
    this.ballRadius = 5;
    this.ballX = canvas.width / 2;
    this.ballY = canvas.height - 30;
    this.ballDx = 2.5;
    this.ballDy = -2.5;

    // Brick settings
    this.brickRowCount = 4;
    this.brickColumnCount = 6;
    this.brickWidth = 43;
    this.brickHeight = 12;
    this.brickPadding = 6;
    this.brickOffsetTop = 25;
    this.brickOffsetLeft = 15;
    this.bricks = [];
  }

  init() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.paddleX = (this.canvas.width - this.paddleWidth) / 2;
    this.resetBall();
    this.initBricks();
    this.onScore(this.score);
    this.onLives(this.lives);
  }

  initBricks() {
    this.bricks = [];
    for (let c = 0; c < this.brickColumnCount; c++) {
      this.bricks[c] = [];
      for (let r = 0; r < this.brickRowCount; r++) {
        this.bricks[c][r] = { x: 0, y: 0, status: 1 };
      }
    }
  }

  resetBall() {
    this.ballX = this.canvas.width / 2;
    this.ballY = this.canvas.height - 25;
    // Set slightly variable launching angles
    this.ballDx = (Math.random() * 2 - 1) * 1.5 + 1.8;
    this.ballDy = -2.5 - (this.level * 0.2);
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

  // Handle click wheel scrolls (moves the paddle)
  handleScroll(direction) {
    if (!this.active) return;
    
    // Direction: 'next' = clockwise (right), 'prev' = counter-clockwise (left)
    const moveStep = 20;
    if (direction === 'next') {
      this.paddleX = Math.min(this.canvas.width - this.paddleWidth, this.paddleX + moveStep);
    } else {
      this.paddleX = Math.max(0, this.paddleX - moveStep);
    }
  }

  handleSelect() {
    // If game ended, restart it
    if (!this.active) {
      this.init();
      this.start();
    }
  }

  // Main Loop
  loop() {
    if (!this.active) return;

    this.update();
    this.draw();

    this.animationId = requestAnimationFrame(() => this.loop());
  }

  update() {
    // Ball wall reflections
    if (this.ballX + this.ballDx > this.canvas.width - this.ballRadius || this.ballX + this.ballDx < this.ballRadius) {
      this.ballDx = -this.ballDx;
    }
    if (this.ballY + this.ballDy < this.ballRadius) {
      this.ballDy = -this.ballDy;
    } 
    // Paddle bounce / Pit failure
    else if (this.ballY + this.ballDy > this.canvas.height - this.ballRadius - this.paddleHeight) {
      if (this.ballX > this.paddleX && this.ballX < this.paddleX + this.paddleWidth) {
        // Bounce and modify angle depending on where the ball lands on paddle
        const hitPoint = (this.ballX - (this.paddleX + this.paddleWidth / 2)) / (this.paddleWidth / 2);
        this.ballDx = hitPoint * 3.5;
        this.ballDy = -Math.max(1.8, Math.abs(this.ballDy)); // guarantee up velocity
      } else {
        // Life lost
        this.lives--;
        this.onLives(this.lives);
        if (this.lives <= 0) {
          this.active = false;
          this.onGameOver("Game Over! Score: " + this.score);
        } else {
          this.resetBall();
        }
      }
    }

    // Brick collisions
    for (let c = 0; c < this.brickColumnCount; c++) {
      for (let r = 0; r < this.brickRowCount; r++) {
        const b = this.bricks[c][r];
        if (b.status === 1) {
          if (this.ballX > b.x && this.ballX < b.x + this.brickWidth && this.ballY > b.y && this.ballY < b.y + this.brickHeight) {
            this.ballDy = -this.ballDy;
            b.status = 0;
            this.score += 10;
            this.onScore(this.score);

            // Level Complete check
            if (this.isLevelCleared()) {
              this.level++;
              this.initBricks();
              this.resetBall();
            }
          }
        }
      }
    }

    // Move ball
    this.ballX += this.ballDx;
    this.ballY += this.ballDy;
  }

  isLevelCleared() {
    for (let c = 0; c < this.brickColumnCount; c++) {
      for (let r = 0; r < this.brickRowCount; r++) {
        if (this.bricks[c][r].status === 1) return false;
      }
    }
    return true;
  }

  draw() {
    // Clear screen
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw Bricks
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6'];
    for (let c = 0; c < this.brickColumnCount; c++) {
      for (let r = 0; r < this.brickRowCount; r++) {
        if (this.bricks[c][r].status === 1) {
          const brickX = c * (this.brickWidth + this.brickPadding) + this.brickOffsetLeft;
          const brickY = r * (this.brickHeight + this.brickPadding) + this.brickOffsetTop;
          this.bricks[c][r].x = brickX;
          this.bricks[c][r].y = brickY;
          
          this.ctx.fillStyle = colors[r % colors.length];
          this.ctx.fillRect(brickX, brickY, this.brickWidth, this.brickHeight);
          
          // Brick border sheen
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(brickX, brickY, this.brickWidth, this.brickHeight);
        }
      }
    }

    // Draw Ball
    this.ctx.beginPath();
    this.ctx.arc(this.ballX, this.ballY, this.ballRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fill();
    this.ctx.closePath();

    // Draw Paddle
    this.ctx.fillStyle = '#60a5fa';
    this.ctx.fillRect(this.paddleX, this.canvas.height - this.paddleHeight, this.paddleWidth, this.paddleHeight);
    
    // Paddle reflection line
    this.ctx.fillStyle = '#93c5fd';
    this.ctx.fillRect(this.paddleX, this.canvas.height - this.paddleHeight, this.paddleWidth, 2);

    // Level Indicator Text
    this.ctx.font = '10px Share Tech Mono';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillText("Level: " + this.level, 15, 15);
  }
}
