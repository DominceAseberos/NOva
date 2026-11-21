import React, { useEffect, useState, useRef } from "react";
import { assetTracker } from "../world/assetTracker.js";
import { NovaLogo } from "../brand/NovaLogo.jsx";

export default function NovaPreloader({ onReady }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("INITIALIZING NOVA ARCHITECTURE...");
  const [isDone, setIsDone] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  const targetProgressRef = useRef(0);
  const currentProgressRef = useRef(0);
  const doneTriggeredRef = useRef(false);

  useEffect(() => {
    // Lock scroll during initialization
    document.body.classList.add("nova-loading");
    document.body.style.overflow = "hidden";

    // Track real assets
    const unsubscribe = assetTracker.subscribe((state) => {
      targetProgressRef.current = Math.max(targetProgressRef.current, state.rawProgress);
      setStatus(state.statusText);
    });

    // Font readiness check
    if (document.fonts) {
      document.fonts.ready.then(() => {
        targetProgressRef.current = Math.max(targetProgressRef.current, 25);
      });
    }

    // Safety fallback: ensure loading completes within 4.2s even on slow connections
    const safetyTimer = setTimeout(() => {
      targetProgressRef.current = 100;
      assetTracker.markComplete();
    }, 4200);

    // Smooth animation ticker
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      // Organic crawl even while waiting for discrete asset events
      if (targetProgressRef.current < 90) {
        targetProgressRef.current = Math.min(92, targetProgressRef.current + dt * 8.5);
      }

      // Smooth interpolation toward target
      const lerpSpeed = targetProgressRef.current >= 100 ? 14 : 6.5;
      currentProgressRef.current += (targetProgressRef.current - currentProgressRef.current) * (1 - Math.exp(-lerpSpeed * dt));

      if (targetProgressRef.current >= 100 && 100 - currentProgressRef.current < 1.0) {
        currentProgressRef.current = 100;
      }

      const rounded = Math.min(100, Math.round(currentProgressRef.current));
      setProgress(rounded);

      if (rounded >= 100 && !doneTriggeredRef.current) {
        doneTriggeredRef.current = true;
        setStatus("SYSTEM ARCHITECTURE READY");
        setProgress(100);

        setTimeout(() => {
          setIsDone(true);
          document.body.classList.remove("nova-loading");
          document.body.classList.add("nova-loaded");
          document.body.style.removeProperty("overflow");
          onReady?.();

          setTimeout(() => {
            setIsHidden(true);
          }, 850);
        }, 280);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(safetyTimer);
      unsubscribe();
      document.body.classList.remove("nova-loading");
      document.body.style.removeProperty("overflow");
    };
  }, [onReady]);

  if (isHidden) return null;

  return (
    <div
      className={`nova-preloader ${isDone ? "nova-preloader--done" : ""}`}
      aria-hidden="true"
      role="status"
    >
      <div className="nova-preloader__backdrop" />
      <div className="nova-preloader__glow" />

      <div className="nova-preloader__content">
        <div className="nova-preloader__brand">
          <div className="nova-preloader__logo-wrap">
            <NovaLogo className="nova-preloader__logo" />
            <div className="nova-preloader__ring" />
          </div>
          <span className="nova-preloader__brand-name">NOVA</span>
        </div>

        <div className="nova-preloader__telemetry">
          <span className="nova-preloader__label">CANONICAL WORKSTATION / 2026</span>
          <span className="nova-preloader__status">{status}</span>
        </div>

        <div className="nova-preloader__bar-container">
          <div
            className="nova-preloader__bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="nova-preloader__footer">
          <span className="nova-preloader__pct">
            [{String(progress).padStart(3, " ")}%]
          </span>
          <span className="nova-preloader__hud">
            OPTICAL ENGINE // 5-PLANE DEPTH STAGE
          </span>
        </div>
      </div>
    </div>
  );
}
