/* The one shared requestAnimationFrame loop for the Indigo pages.
 * Tasks run each frame until they return false. The loop only runs while at
 * least one task is registered, so an idle page costs nothing. */

export type Task = (now: number, dt: number) => boolean | void;

const tasks = new Set<Task>();
let raf = 0;
let last = 0;

function frame(now: number) {
  const dt = last ? Math.min(now - last, 64) : 16.7;
  last = now;
  for (const task of tasks) {
    if (task(now, dt) === false) tasks.delete(task);
  }
  if (tasks.size) {
    raf = requestAnimationFrame(frame);
  } else {
    raf = 0;
    last = 0;
  }
}

/** Register a task. Returns a function that removes it. */
export function addTask(task: Task) {
  tasks.add(task);
  if (!raf) raf = requestAnimationFrame(frame);
  return () => {
    tasks.delete(task);
  };
}

/** Ease-out cubic, the count-up curve. */
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
