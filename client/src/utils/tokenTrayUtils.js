export function getUnplacedNpcTokenIds(tokens = []) {
  return tokens
    .filter((token) => !token.isPlaced && token.type === 'npc')
    .map((token) => token.id);
}
