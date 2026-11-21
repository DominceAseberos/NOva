import { useEffect } from "react";
import { getSectionRanges, evaluateProductTrack } from "../core/storyMath.js";
import { getActiveLenis } from "./lenisBridge.js";

function getStoryTimeFromScroll(story) {
  const ranges = getSectionRanges(story);
  if (!ranges.length) return 0;
  const cursor = window.scrollY;

  const domRanges = ranges
    .map((range) => {
      const element = document.querySelector(range.selector || "#" + range.id);
      if (!element) return null;
      const top = element.offsetTop;
      const height = Math.max(1, element.offsetHeight);
      const travel = range.pin?.enabled
        ? Math.max(1, height - window.innerHeight)
        : height;
      return {
        range,
        element,
        top,
        bottom: top + height,
        height,
        travel,
      };
    })
    .filter(Boolean);

  if (!domRanges.length) return 0;
  if (cursor <= domRanges[0].top) return domRanges[0].range.start;

  const PIN_PORTION = 0.90;

  for (let index = 0; index < domRanges.length; index += 1) {
    const current = domRanges[index];
    const next = domRanges[index + 1];

    if (!next || cursor < next.top) {
      const offset = Math.max(0, cursor - current.top);
      let progress;
      if (!current.range.pin?.enabled || !next || offset <= current.travel) {
        const pinnedRatio = Math.min(1, Math.max(0, offset / Math.max(1, current.travel)));
        progress = next && current.range.pin?.enabled
          ? pinnedRatio * PIN_PORTION
          : pinnedRatio;
      } else {
        const unpinSpan = Math.max(1, next.top - (current.top + current.travel));
        const unpinRatio = Math.min(1, Math.max(0, (offset - current.travel) / unpinSpan));
        progress = PIN_PORTION + unpinRatio * (1 - PIN_PORTION);
      }
      return current.range.start + progress * current.range.duration;
    }
  }

  return ranges[ranges.length - 1].end;
}

export default function StoryLayoutController({ store }) {
  useEffect(() => {
    const apply = (story) => {
      (story.sections || []).forEach((section) => {
        const root = document.querySelector(section.selector || "#" + section.id);
        if (!root) return;

        const duration = Math.max(1, Number(section.duration) || 1);
        const pinned = Boolean(section.pin?.enabled);

        root.dataset.storySection = section.id;
        root.style.setProperty("--story-duration", String(duration));
        root.style.marginTop = "0px";

        if (pinned) {
          root.style.minHeight = "calc(100svh + " + duration + "svh)";
        } else {
          root.style.minHeight = duration + "svh";
        }

        const stage = section.stageSelector
          ? root.querySelector(section.stageSelector)
          : null;

        if (stage) {
          stage.dataset.storyPinned = pinned ? "true" : "false";
          stage.style.position = pinned ? "sticky" : "relative";

          if (pinned) {
            stage.style.top = "0";
            stage.style.height = "100svh";
            stage.style.minHeight = "100svh";
          } else {
            stage.style.top = "auto";
            stage.style.removeProperty("height");
            stage.style.removeProperty("min-height");
          }
        }
      });
    };

    const syncChapter = () => {
      const story = store.get();
      const time = getStoryTimeFromScroll(story);
      const evalState = evaluateProductTrack(story, time);
      if (evalState?.chapter && document.body.dataset.storyChapter !== evalState.chapter) {
        document.body.dataset.storyChapter = evalState.chapter;
      }
    };

    const currentStory = store.get();
    apply(currentStory);
    syncChapter();

    window.addEventListener("scroll", syncChapter, { passive: true });
    window.addEventListener("resize", syncChapter, { passive: true });

    let lenisUnsub = null;
    const lenis = getActiveLenis();
    if (lenis) {
      lenis.on("scroll", syncChapter);
      lenisUnsub = () => lenis.off("scroll", syncChapter);
    }

    const unsubStore = store.subscribe((story) => {
      apply(story);
      syncChapter();
    });

    return () => {
      window.removeEventListener("scroll", syncChapter);
      window.removeEventListener("resize", syncChapter);
      lenisUnsub?.();
      unsubStore();
    };
  }, [store]);

  return null;
}
