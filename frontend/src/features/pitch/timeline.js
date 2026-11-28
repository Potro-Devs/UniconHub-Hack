export const clampTime = (value, duration) => Math.max(0, Math.min(duration, Number.isFinite(Number(value)) ? Number(value) : 0));

export function getSceneAt(scenes, time) {
  let start = 0;
  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    if (time < start + scene.seconds || index === scenes.length - 1) {
      return { scene, index, start, elapsed: Math.max(0, Math.min(scene.seconds, time - start)) };
    }
    start += scene.seconds;
  }
  return null;
}

export const formatPitchTime = (seconds) => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0')}`;

export function sceneStart(scenes, index) {
  return scenes.slice(0, Math.max(0, index)).reduce((sum, scene) => sum + scene.seconds, 0);
}
