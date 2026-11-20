import { useEffect, useState, useCallback } from "react";
import { getActiveLenis } from "./lenisBridge.js";

const listeners = new Set();
let globalIsAutoScrolling = false;
let globalRafId = 0;

function setGlobalAutoScrolling(val) {
  globalIsAutoScrolling = val;
  listeners.forEach((fn) => fn(val));
}

export function stopAutoScroll() {
  if (globalRafId) {
    cancelAnimationFrame(globalRafId);
    globalRafId = 0;
  }
  setGlobalAutoScrolling(false);
}

export function startAutoScroll() {
  stopAutoScroll();

  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  // If user is already near the bottom of the page, restart from top
  if (window.scrollY >= maxScroll - 60) {
    const lenis = getActiveLenis();
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
  }

  setGlobalAutoScrolling(true);

  // Cinematic scroll speed: ~220px per second, frame-rate independent
  const speedPxPerSec = 220;
  let virtualScroll = window.scrollY;
  let lastTimestamp = performance.now();

  function step(currentTimestamp) {
    if (!globalIsAutoScrolling) return;

    const deltaSec = Math.min((currentTimestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = currentTimestamp;

    const currentMax = document.documentElement.scrollHeight - window.innerHeight;

    if (virtualScroll >= currentMax - 6) {
      stopAutoScroll();
      return;
    }

    virtualScroll = Math.min(virtualScroll + speedPxPerSec * deltaSec, currentMax);
    const lenis = getActiveLenis();
    if (lenis) {
      lenis.scrollTo(virtualScroll, { immediate: true });
    } else {
      window.scrollTo(0, virtualScroll);
    }

    globalRafId = requestAnimationFrame(step);
  }

  globalRafId = requestAnimationFrame(step);
}

export function toggleAutoScroll() {
  if (globalIsAutoScrolling) {
    stopAutoScroll();
  } else {
    startAutoScroll();
  }
}

export function useAutoScroll() {
  const [isAutoScrolling, setIsAutoScrolling] = useState(globalIsAutoScrolling);

  useEffect(() => {
    listeners.add(setIsAutoScrolling);
    return () => listeners.delete(setIsAutoScrolling);
  }, []);

  return {
    isAutoScrolling,
    toggleAutoScroll,
    startAutoScroll,
    stopAutoScroll,
  };
}

// User interruption: stop auto-scroll on manual wheel or touch interaction
if (typeof window !== "undefined") {
  const onUserInterrupt = () => {
    if (globalIsAutoScrolling) {
      stopAutoScroll();
    }
  };
  window.addEventListener("wheel", onUserInterrupt, { passive: true });
  window.addEventListener("touchmove", onUserInterrupt, { passive: true });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && globalIsAutoScrolling) {
      stopAutoScroll();
    }
  });
}
