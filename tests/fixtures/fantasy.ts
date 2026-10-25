import fantasy from '../../data/demo-fantasy-v06.json';
/** Production source is complete; no substitute footballer in tests. */
export function completedTestFantasy() {
  return structuredClone(fantasy);
}
