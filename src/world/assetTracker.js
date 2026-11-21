import * as THREE from "three";

class AssetTracker {
  constructor() {
    this.listeners = new Set();
    this.total = 0;
    this.loaded = 0;
    this.rawProgress = 0;
    this.displayProgress = 0;
    this.statusText = "INITIALIZING ARCHITECTURE...";
    this.isComplete = false;
    this.hasStarted = false;

    this.setupLoadingManager();
  }

  setupLoadingManager() {
    const manager = THREE.DefaultLoadingManager;

    manager.onStart = (url, itemsLoaded, itemsTotal) => {
      this.hasStarted = true;
      this.loaded = itemsLoaded;
      this.total = itemsTotal;
      this.updateProgress(url);
    };

    manager.onProgress = (url, itemsLoaded, itemsTotal) => {
      this.loaded = itemsLoaded;
      this.total = Math.max(itemsTotal, this.total);
      this.updateProgress(url);
    };

    manager.onLoad = () => {
      this.rawProgress = 100;
      this.statusText = "SYSTEM ARCHITECTURE READY";
      this.notify();
    };

    manager.onError = (url) => {
      console.warn(`[AssetTracker] Warning loading: ${url}`);
      // Still allow progression
      this.loaded += 1;
      this.updateProgress(url);
    };
  }

  updateProgress(url = "") {
    const fileName = url.split("/").pop()?.split("?")[0] || "";
    
    if (this.total > 0) {
      this.rawProgress = Math.min(99, Math.round((this.loaded / this.total) * 100));
    }

    if (fileName.endsWith(".glb")) {
      this.statusText = "STREAMING 3D CANONICAL CHASSIS...";
    } else if (fileName.includes("background") || fileName.includes("foreground")) {
      this.statusText = "CALIBRATING OPTICAL DEPTH PLANES...";
    } else if (fileName.includes("screen")) {
      this.statusText = "SYNTHESIZING OLED DISPLAY SHADERS...";
    } else if (this.rawProgress < 30) {
      this.statusText = "INITIALIZING COMPUTING SUBSYSTEMS...";
    } else if (this.rawProgress < 75) {
      this.statusText = "LOADING HIGH-RES PBR TEXTURE HARNESS...";
    } else {
      this.statusText = "FINALIZING OPTICAL ALIGNMENT...";
    }

    this.notify();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.getState());
    return () => this.listeners.delete(fn);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (err) {
        console.error("[AssetTracker] Listener error:", err);
      }
    });
  }

  getState() {
    return {
      rawProgress: this.rawProgress,
      displayProgress: Math.round(this.displayProgress),
      statusText: this.statusText,
      isComplete: this.isComplete,
      loaded: this.loaded,
      total: this.total,
    };
  }

  markComplete() {
    this.rawProgress = 100;
    this.displayProgress = 100;
    this.isComplete = true;
    this.statusText = "SYSTEM ARCHITECTURE READY";
    this.notify();
  }
}

export const assetTracker = new AssetTracker();
