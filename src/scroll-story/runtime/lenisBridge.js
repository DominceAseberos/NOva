let activeLenis = null;

export function setActiveLenis(instance) {
  activeLenis = instance || null;
}

export function getActiveLenis() {
  return activeLenis;
}
