export function validateStory(story) {
  const errors = [];

  if (!story || typeof story !== "object") {
    return ["Story must be an object."];
  }

  if (!story.schemaVersion) {
    errors.push("schemaVersion is required.");
  }

  if (!Array.isArray(story.sections) || story.sections.length === 0) {
    errors.push("At least one section is required.");
    return errors;
  }

  const sectionIds = new Set();
  for (const section of story.sections) {
    if (!section?.id) {
      errors.push("Every section requires an id.");
      continue;
    }
    if (sectionIds.has(section.id)) {
      errors.push("Duplicate section id: " + section.id);
    }
    sectionIds.add(section.id);

    if (!(Number(section.duration) > 0)) {
      errors.push("Section " + section.id + " requires duration > 0.");
    }
  }

  for (const [trackName, keyframes] of Object.entries(story.tracks || {})) {
    if (!Array.isArray(keyframes)) {
      errors.push("Track " + trackName + " must be an array.");
      continue;
    }

    const ids = new Set();
    keyframes.forEach((keyframe, index) => {
      const prefix = trackName + "[" + index + "]";

      if (!keyframe?.id) errors.push(prefix + " requires an id.");
      else if (ids.has(keyframe.id)) {
        errors.push("Duplicate keyframe id in " + trackName + ": " + keyframe.id);
      } else {
        ids.add(keyframe.id);
      }

      if (!sectionIds.has(keyframe?.section)) {
        errors.push(prefix + " references unknown section " + keyframe?.section);
      }

      const progress = Number(keyframe?.progress);
      if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
        errors.push(prefix + " progress must be between 0 and 1.");
      }

      if (!keyframe?.state || typeof keyframe.state !== "object") {
        errors.push(prefix + " requires a state object.");
      }
    });
  }

  return errors;
}

export function assertValidStory(story) {
  const errors = validateStory(story);
  if (errors.length) {
    throw new Error("Invalid scroll story:\n- " + errors.join("\n- "));
  }
  return story;
}
