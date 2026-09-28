export const clamp01 = (value) => Math.max(0, Math.min(1, value));

export const smoothstep = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

export const linear = (value) => clamp01(value);

export const easeValue = (value, ease = "smooth") => {
  if (ease === "linear") return linear(value);
  return smoothstep(value);
};

export const lerp = (a, b, t) => a + (b - a) * t;

export const lerpAngle = (a, b, t) => {
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
};

export const DEFAULT_PRODUCT_STATE = Object.freeze({
  x: 0.75,
  y: 0,
  z: 0,
  rx: -0.06,
  ry: -0.12,
  rz: 0.01,
  scale: 0.9,
  lid: 1,
  keyboardLight: 1,
  explodeEnabled: true,
  explode: 0,
  parts: {},
  screen: 0,
  cool: 2.8,
  warm: 1.1,
  ambient: 1.25,
  shadow: 0.55,
  opacity: 1,
});

export const withProductDefaults = (state = {}) => ({
  ...DEFAULT_PRODUCT_STATE,
  ...state,
  parts: structuredClone(state.parts || {}),
});

export function getSectionRanges(story) {
  let cursor = 0;
  return (story.sections || []).map((section) => {
    const duration = Math.max(1, Number(section.duration) || 1);
    const range = {
      ...section,
      duration,
      start: cursor,
      end: cursor + duration,
    };
    cursor += duration;
    return range;
  });
}

export function getStoryDuration(story) {
  const ranges = getSectionRanges(story);
  return ranges.length ? ranges[ranges.length - 1].end : 1;
}

export function locateStoryTime(story, time) {
  const ranges = getSectionRanges(story);
  if (!ranges.length) {
    return { section: null, progress: 0, time: 0 };
  }

  const duration = getStoryDuration(story);
  const safeTime = Math.max(0, Math.min(duration, Number(time) || 0));
  const range =
    ranges.find(
      (item, index) =>
        safeTime >= item.start &&
        (safeTime < item.end || index === ranges.length - 1)
    ) || ranges[ranges.length - 1];

  return {
    section: range,
    progress: clamp01((safeTime - range.start) / Math.max(1e-6, range.duration)),
    time: safeTime,
  };
}

export function keyframeTime(story, keyframe) {
  const ranges = getSectionRanges(story);
  const section = ranges.find((item) => item.id === keyframe.section);
  if (!section) return 0;
  return section.start + clamp01(keyframe.progress ?? 0) * section.duration;
}

export function sortTrack(story, keyframes = []) {
  return [...keyframes].sort((a, b) => keyframeTime(story, a) - keyframeTime(story, b));
}

const DEFAULT_PART_STATE = Object.freeze({
  visible: true,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
});

const normalizePartState = (state = {}) => ({
  ...DEFAULT_PART_STATE,
  ...state,
  position: [...(state.position || DEFAULT_PART_STATE.position)],
  rotation: [...(state.rotation || DEFAULT_PART_STATE.rotation)],
  scale: [...(state.scale || DEFAULT_PART_STATE.scale)],
});

const interpolatePartStates = (leftParts = {}, rightParts = {}, t) => {
  const ids = new Set([...Object.keys(leftParts), ...Object.keys(rightParts)]);
  const result = {};

  ids.forEach((id) => {
    const left = normalizePartState(leftParts[id]);
    const right = normalizePartState(rightParts[id]);
    result[id] = {
      visible: t < 0.5 ? left.visible : right.visible,
      position: left.position.map((value, index) =>
        lerp(value, right.position[index] ?? value, t)
      ),
      rotation: left.rotation.map((value, index) =>
        lerpAngle(value, right.rotation[index] ?? value, t)
      ),
      scale: left.scale.map((value, index) =>
        lerp(value, right.scale[index] ?? value, t)
      ),
    };
  });

  return result;
};

export function interpolateProductState(a, b, t, ease = "smooth") {
  const left = withProductDefaults(a);
  const right = withProductDefaults(b);
  const e = easeValue(t, ease);

  return {
    x: lerp(left.x, right.x, e),
    y: lerp(left.y, right.y, e),
    z: lerp(left.z, right.z, e),
    rx: lerpAngle(left.rx, right.rx, e),
    ry: lerpAngle(left.ry, right.ry, e),
    rz: lerpAngle(left.rz, right.rz, e),
    scale: lerp(left.scale, right.scale, e),
    lid: lerp(left.lid ?? 1, right.lid ?? 1, e),
    keyboardLight: lerp(left.keyboardLight ?? 1, right.keyboardLight ?? 1, e),
    explodeEnabled: e < 0.5 ? left.explodeEnabled !== false : right.explodeEnabled !== false,
    explode: lerp(left.explode, right.explode, e),
    parts: interpolatePartStates(left.parts, right.parts, e),
    screen: e < 0.5 ? left.screen : right.screen,
    cool: lerp(left.cool, right.cool, e),
    warm: lerp(left.warm, right.warm, e),
    ambient: lerp(left.ambient, right.ambient, e),
    shadow: lerp(left.shadow, right.shadow, e),
    opacity: lerp(left.opacity ?? 1, right.opacity ?? 1, e),
  };
}

export function evaluateProductTrack(story, time) {
  const keyframes = sortTrack(story, story.tracks?.product || []);
  const located = locateStoryTime(story, time);
  const currentSection = located.section;
  const sectionId = currentSection?.id || story.sections?.[0]?.id || "top";

  if (!keyframes.length) {
    return {
      ...withProductDefaults(),
      chapter: "ARRIVAL",
      section: sectionId,
      keyframeId: null,
    };
  }

  const safeTime = located.time;
  const local = keyframes.filter((keyframe) => keyframe.section === sectionId);
  const previous = [...keyframes]
    .filter(
      (keyframe) =>
        keyframe.section !== sectionId &&
        keyframeTime(story, keyframe) <= (currentSection?.start ?? 0)
    )
    .at(-1);

  // A section owns its whole timeline interval. If it has no local keys,
  // hold the last prior state instead of blending toward a future section.
  if (!local.length) {
    const fallback = previous || keyframes[0];
    return {
      ...withProductDefaults(fallback.state),
      chapter: fallback.chapter,
      section: sectionId,
      keyframeId: fallback.id,
    };
  }

  const first = local[0];
  const firstTime = keyframeTime(story, first);

  // Entering a new section may blend from the previous section's final state
  // to this section's first key, but only after the new section has begun.
  if (safeTime <= firstTime) {
    if (
      previous &&
      currentSection &&
      firstTime > currentSection.start + 1e-6
    ) {
      const raw =
        (safeTime - currentSection.start) /
        Math.max(1e-6, firstTime - currentSection.start);
      return {
        ...interpolateProductState(previous.state, first.state, raw, first.ease),
        // Section ownership is immediate: the pose may blend in from the
        // previous section, but copy/labels belong to the new section from
        // its first scroll pixel onward.
        chapter: first.chapter,
        section: sectionId,
        keyframeId: first.id,
      };
    }

    return {
      ...withProductDefaults(first.state),
      chapter: first.chapter,
      section: sectionId,
      keyframeId: first.id,
    };
  }

  for (let index = 0; index < local.length - 1; index += 1) {
    const a = local[index];
    const b = local[index + 1];
    const start = keyframeTime(story, a);
    const end = keyframeTime(story, b);

    if (safeTime >= start && safeTime <= end) {
      const progress = (safeTime - start) / Math.max(1e-6, end - start);
      return {
        ...interpolateProductState(a.state, b.state, progress, a.ease),
        chapter: progress < 0.5 ? a.chapter : b.chapter,
        section: sectionId,
        keyframeId: progress < 0.5 ? a.id : b.id,
      };
    }
  }

  // Do not begin interpolating toward another section early. Once the last
  // key in this section is reached, hold it until this section's pin ends.
  const lastLocal = local[local.length - 1];
  return {
    ...withProductDefaults(lastLocal.state),
    chapter: lastLocal.chapter,
    section: sectionId,
    keyframeId: lastLocal.id,
  };
}

export function storyPointFromSectionProgress(story, sectionId, progress) {
  const section = getSectionRanges(story).find((item) => item.id === sectionId);
  if (!section) return 0;
  return section.start + clamp01(progress) * section.duration;
}

export function storyPointToSectionProgress(story, time) {
  const located = locateStoryTime(story, time);
  return {
    section: located.section?.id || story.sections?.[0]?.id || "top",
    progress: located.progress,
  };
}

export function upsertProductKeyframe(story, keyframe, tolerance = 0.012) {
  const next = structuredClone(story);
  const list = next.tracks?.product || (next.tracks.product = []);
  const existingIndex = list.findIndex(
    (item) =>
      item.id === keyframe.id ||
      (item.section === keyframe.section &&
        Math.abs((item.progress ?? 0) - (keyframe.progress ?? 0)) <= tolerance)
  );

  if (existingIndex >= 0) {
    list[existingIndex] = { ...list[existingIndex], ...keyframe };
  } else {
    list.push(keyframe);
  }

  return next;
}


export const DEFAULT_CAMERA_STATE = Object.freeze({
  position: [0, 1.18, 4.45],
  target: [0, -0.08, 0],
  fov: 36,
});

const interpolateVector = (a, b, t) => [
  lerp(a?.[0] ?? 0, b?.[0] ?? 0, t),
  lerp(a?.[1] ?? 0, b?.[1] ?? 0, t),
  lerp(a?.[2] ?? 0, b?.[2] ?? 0, t),
];

export function evaluateCameraTrack(story, time) {
  const keyframes = sortTrack(story, story.tracks?.camera || []);
  if (!keyframes.length) return null;

  const located = locateStoryTime(story, time);
  const currentSection = located.section;
  const sectionId = currentSection?.id || story.sections?.[0]?.id || "top";
  const safeTime = located.time;
  const local = keyframes.filter((keyframe) => keyframe.section === sectionId);
  const previous = [...keyframes]
    .filter(
      (keyframe) =>
        keyframe.section !== sectionId &&
        keyframeTime(story, keyframe) <= (currentSection?.start ?? 0)
    )
    .at(-1);

  if (!local.length) {
    const fallback = previous || keyframes[0];
    return {
      ...DEFAULT_CAMERA_STATE,
      ...fallback.state,
      keyframeId: fallback.id,
      section: sectionId,
    };
  }

  const first = local[0];
  const firstTime = keyframeTime(story, first);

  if (safeTime <= firstTime) {
    if (
      previous &&
      currentSection &&
      firstTime > currentSection.start + 1e-6
    ) {
      const raw =
        (safeTime - currentSection.start) /
        Math.max(1e-6, firstTime - currentSection.start);
      const t = easeValue(raw, first.ease);
      const left = { ...DEFAULT_CAMERA_STATE, ...previous.state };
      const right = { ...DEFAULT_CAMERA_STATE, ...first.state };

      return {
        position: interpolateVector(left.position, right.position, t),
        target: interpolateVector(left.target, right.target, t),
        fov: lerp(left.fov, right.fov, t),
        keyframeId: raw < 0.5 ? previous.id : first.id,
        section: sectionId,
      };
    }

    return {
      ...DEFAULT_CAMERA_STATE,
      ...first.state,
      keyframeId: first.id,
      section: sectionId,
    };
  }

  for (let index = 0; index < local.length - 1; index += 1) {
    const a = local[index];
    const b = local[index + 1];
    const start = keyframeTime(story, a);
    const end = keyframeTime(story, b);

    if (safeTime >= start && safeTime <= end) {
      const raw = (safeTime - start) / Math.max(1e-6, end - start);
      const t = easeValue(raw, a.ease);
      const left = { ...DEFAULT_CAMERA_STATE, ...a.state };
      const right = { ...DEFAULT_CAMERA_STATE, ...b.state };

      return {
        position: interpolateVector(left.position, right.position, t),
        target: interpolateVector(left.target, right.target, t),
        fov: lerp(left.fov, right.fov, t),
        keyframeId: raw < 0.5 ? a.id : b.id,
        section: sectionId,
      };
    }
  }

  const lastLocal = local[local.length - 1];
  return {
    ...DEFAULT_CAMERA_STATE,
    ...lastLocal.state,
    keyframeId: lastLocal.id,
    section: sectionId,
  };
}

export function upsertCameraKeyframe(story, keyframe, tolerance = 0.012) {
  const next = structuredClone(story);
  const list = next.tracks?.camera || (next.tracks.camera = []);
  const existingIndex = list.findIndex(
    (item) =>
      item.id === keyframe.id ||
      (item.section === keyframe.section &&
        Math.abs((item.progress ?? 0) - (keyframe.progress ?? 0)) <= tolerance)
  );

  if (existingIndex >= 0) {
    list[existingIndex] = { ...list[existingIndex], ...keyframe };
  } else {
    list.push(keyframe);
  }

  return next;
}
