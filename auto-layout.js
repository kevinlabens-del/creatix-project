/* CR3@TIX MAP v1.16.6 — automatic project-card layout
   Keeps the existing add/edit/delete flow intact and only recalculates
   direct project children of the main category branches before rendering. */
(() => {
  'use strict';

  const PROJECT_X = 300;
  const FIRST_Y = 20;
  const CARD_STEP = 280;
  const MIN_WORLD_HEIGHT = 1400;
  const BOTTOM_PAD = 320;

  function autoLayoutProjects() {
    if (!Array.isArray(nodes) || !nodes.length) return false;

    const root = nodeById('root');
    if (!root) return false;

    const branches = childrenOf(root.id);
    let y = FIRST_Y;
    let changed = false;

    for (const branch of branches) {
      const projects = childrenOf(branch.id);
      for (const project of projects) {
        if (project.x !== PROJECT_X || project.y !== y) {
          project.x = PROJECT_X;
          project.y = y;
          changed = true;
        }
        y += CARD_STEP;
      }
    }

    const requiredHeight = Math.max(MIN_WORLD_HEIGHT, y + BOTTOM_PAD);
    if (WORLD.height !== requiredHeight) {
      WORLD.height = requiredHeight;
      changed = true;
    }
    world.style.height = `${WORLD.height}px`;

    if (changed) saveNodes();
    return changed;
  }

  const originalRender = render;
  render = function cr3atixAutoLayoutRender() {
    autoLayoutProjects();
    return originalRender();
  };

  autoLayoutProjects();
  render();

  window.addEventListener('resize', () => {
    world.style.height = `${WORLD.height}px`;
  }, { passive: true });
})();
