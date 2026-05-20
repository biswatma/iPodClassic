/* ==========================================================================
   iPod Click Wheel Rotational Gesture Tracking & Button Handlers
   ========================================================================== */

import { audioEngine } from './audio.js';

class IpodClickWheel {
  constructor() {
    this.wheel = null;
    this.centerButton = null;

    // Rotational tracking state
    this.isDragging = false;
    this.centerX = 0;
    this.centerY = 0;
    this.lastAngle = 0;
    this.accumulatedAngle = 0;

    // Threshold in radians (approx 15 degrees)
    this.scrollThreshold = 0.26;

    // Callbacks for events
    this.onScrollDown = null; // clockwise
    this.onScrollUp = null;   // counter-clockwise
    this.onMenuClick = null;
    this.onSelectClick = null;
    this.onPrevClick = null;
    this.onNextClick = null;
    this.onPlayClick = null;
  }

  init() {
    this.wheel = document.getElementById('click-wheel');
    this.centerButton = document.getElementById('btn-select');

    if (!this.wheel) return;

    this.setupRotationTracking();
    this.setupButtonEvents();
  }

  // Mathematics of circular tracking
  setupRotationTracking() {
    const handlePointerDown = (e) => {
      // If user clicked the select button, ignore rotation drag
      if (e.target === this.centerButton) return;

      this.isDragging = true;
      this.wheel.setPointerCapture(e.pointerId);

      const rect = this.wheel.getBoundingClientRect();
      this.centerX = rect.left + rect.width / 2;
      this.centerY = rect.top + rect.height / 2;

      const dx = e.clientX - this.centerX;
      const dy = e.clientY - this.centerY;
      this.lastAngle = Math.atan2(dy, dx);
      this.accumulatedAngle = 0;
    };

    const handlePointerMove = (e) => {
      if (!this.isDragging) return;

      const dx = e.clientX - this.centerX;
      const dy = e.clientY - this.centerY;
      
      // Prevent scrolling if user drifts too close to the dead center select button (approx 30px radius)
      const distance = Math.sqrt(dx*dx + dy*dy);
      if (distance < 33) return;

      const currentAngle = Math.atan2(dy, dx);
      let deltaAngle = currentAngle - this.lastAngle;

      // Handle the trigonometric wrap-around (+PI to -PI crossing)
      if (deltaAngle > Math.PI) {
        deltaAngle -= 2 * Math.PI;
      } else if (deltaAngle < -Math.PI) {
        deltaAngle += 2 * Math.PI;
      }

      this.accumulatedAngle += deltaAngle;
      this.lastAngle = currentAngle;

      // Scroll Down (Clockwise)
      if (this.accumulatedAngle >= this.scrollThreshold) {
        audioEngine.playTick();
        if (this.onScrollDown) this.onScrollDown();
        this.accumulatedAngle -= this.scrollThreshold;
      }
      // Scroll Up (Counter-Clockwise)
      else if (this.accumulatedAngle <= -this.scrollThreshold) {
        audioEngine.playTick();
        if (this.onScrollUp) this.onScrollUp();
        this.accumulatedAngle += this.scrollThreshold;
      }
    };

    const handlePointerUp = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      try {
        this.wheel.releasePointerCapture(e.pointerId);
      } catch (err) {}
    };

    this.wheel.addEventListener('pointerdown', handlePointerDown);
    this.wheel.addEventListener('pointermove', handlePointerMove);
    this.wheel.addEventListener('pointerup', handlePointerUp);
    this.wheel.addEventListener('pointercancel', handlePointerUp);
  }

  setupButtonEvents() {
    // Map button actions with click animations
    const menuBtn = document.getElementById('btn-menu');
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');
    const playBtn = document.getElementById('btn-play');

    const animateClick = (className) => {
      this.wheel.classList.add(className);
      setTimeout(() => this.wheel.classList.remove(className), 120);
    };

    // Central Select Button
    this.centerButton.addEventListener('click', (e) => {
      e.stopPropagation();
      audioEngine.playBtnClick();
      if (this.onSelectClick) this.onSelectClick();
    });

    // 4 Directional regions on click wheel
    this.wheel.addEventListener('click', (e) => {
      // Stop clicks if select button was targeted (handled above)
      if (e.target === this.centerButton) return;

      const rect = this.wheel.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;

      const distance = Math.sqrt(dx*dx + dy*dy);
      // Ensure the click was actually on the wheel body, not dead space
      if (distance < 33 || distance > 105) return;

      const angle = Math.atan2(dy, dx); // -PI to +PI

      // Determine which quadrant was clicked:
      // Top (MENU): -3/4 PI to -1/4 PI
      // Right (Next): -1/4 PI to +1/4 PI
      // Bottom (Play): +1/4 PI to +3/4 PI
      // Left (Prev): +3/4 PI to +PI or -PI to -3/4 PI

      const pi = Math.PI;

      if (angle >= -0.75 * pi && angle < -0.25 * pi) {
        animateClick('press-top');
        audioEngine.playBtnClick();
        if (this.onMenuClick) this.onMenuClick();
      } else if (angle >= -0.25 * pi && angle < 0.25 * pi) {
        animateClick('press-right');
        audioEngine.playBtnClick();
        if (this.onNextClick) this.onNextClick();
      } else if (angle >= 0.25 * pi && angle < 0.75 * pi) {
        animateClick('press-bottom');
        audioEngine.playBtnClick();
        if (this.onPlayClick) this.onPlayClick();
      } else {
        animateClick('press-left');
        audioEngine.playBtnClick();
        if (this.onPrevClick) this.onPrevClick();
      }
    });
  }
}

export const clickWheel = new IpodClickWheel();
export default clickWheel;
