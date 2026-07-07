export function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickRandomElement(array) {
  if (!Array.isArray(array) || array.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
}


export function generateGuestId() {
  return 'guest_' + Math.random().toString(36).substring(2, 11);
}