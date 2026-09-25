import { Application } from 'pixi.js';
import { BattleScene } from './BattleScene';
import type { TileKind } from './types';

export class Game {
  private readonly host: HTMLElement;
  private readonly app = new Application();
  private scene: BattleScene | null = null;
  private started = false;
  private initialized = false;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;
  private resizeFrame = 0;

  constructor(host: HTMLElement) {
    this.host = host;
  }

  async start() {
    if (this.started || this.disposed) return;
    this.started = true;

    try {
      const initialBounds = this.host.getBoundingClientRect();

      await this.app.init({
        preference: 'webgl',
        width: Math.max(1, Math.round(initialBounds.width || window.innerWidth)),
        height: Math.max(1, Math.round(initialBounds.height || window.innerHeight)),
        background: 0x0b1020,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        powerPreference: 'high-performance',
      });

      this.initialized = true;

      // React/HMR can unmount the component while Pixi is still initializing.
      if (this.disposed) {
        this.app.destroy(true, true);
        this.initialized = false;
        return;
      }

      this.app.canvas.setAttribute('aria-label', 'Match Defender game');
      this.host.appendChild(this.app.canvas);

      this.scene = new BattleScene(this.app);
      this.app.stage.addChild(this.scene);

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
        this.resizeObserver.observe(this.host);
      }
      window.addEventListener('resize', this.scheduleResize);
      window.visualViewport?.addEventListener('resize', this.scheduleResize);
      window.addEventListener('orientationchange', this.scheduleResize);
      this.scheduleResize();
    } catch (error) {
      this.started = false;
      if (!this.disposed) throw error;
    }
  }

  cast(kind: TileKind) {
    this.scene?.castSpell(kind);
  }

  handleBoardMatch(kind: TileKind, amount: number) {
    this.scene?.handleBoardMatch(kind, amount);
  }

  notifyAutoShuffle() {
    this.scene?.notifyAutoShuffle();
  }

  continueAfterUpgrade() {
    this.scene?.continueAfterUpgrade();
  }

  refreshUpgradeChoices() {
    this.scene?.refreshUpgradeChoices();
  }

  private readonly scheduleResize = () => {
    if (this.disposed || !this.initialized) return;
    if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);

    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = 0;
      if (this.disposed || !this.initialized) return;

      const bounds = this.host.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));

      if (width !== this.app.screen.width || height !== this.app.screen.height) {
        this.app.renderer.resize(width, height);
      }
      this.scene?.resize();
    });
  };

  destroy() {
    if (this.disposed) return;
    this.disposed = true;

    if (this.resizeFrame) {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = 0;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('resize', this.scheduleResize);
    window.visualViewport?.removeEventListener('resize', this.scheduleResize);
    window.removeEventListener('orientationchange', this.scheduleResize);

    this.scene = null;

    // Let Application destroy the stage and its children exactly once.
    if (this.initialized) {
      this.app.destroy(true, true);
      this.initialized = false;
    }
  }
}
