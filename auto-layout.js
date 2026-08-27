/* CR3@TIX MAP v1.16.7 — centered pyramidal auto-layout
   Keeps the existing add/edit/delete flow intact. The tree is recalculated
   before each render so every new project stays grouped under its category
   without overlap while the whole map remains visually centered. */
(() => {
  'use strict';

  const PROJECT_X = 300;
  const BRANCH_X = 850;
  const ROOT_X = 1510;
  const PROJECT_STEP = 280;
  const GROUP_GAP = 90;
  const TOP_PAD = 100;
  const BOTTOM_PAD = 240;
  const MIN_WORLD_HEIGHT = 1400;

  function autoLayoutProjects() {
    if (!Array.isArray(nodes) || !nodes.length) return false;

    const root = nodeById('root');
    if (!root) return false;

    const branches = childrenOf(root.id);
    if (!branches.length) return false;

    // Each branch receives a vertical block sized to its number of projects.
    // Empty branches still keep one card-height of breathing room.
    const groups = branches.map(branch => {
      const projects = childrenOf(branch.id);
      const span = Math.max(PROJECT_STEP, projects.length * PROJECT_STEP);
      return { branch, projects, span };
    });

    const contentHeight = groups.reduce((sum, group) => sum + group.span, 0)
      + Math.max(0, groups.length - 1) * GROUP_GAP;
    const requiredHeight = Math.max(MIN_WORLD_HEIGHT, contentHeight + TOP_PAD + BOTTOM_PAD);
    const startY = Math.max(TOP_PAD, (requiredHeight - contentHeight) / 2);

    let cursorY = startY;
    let changed = false;

    for (const group of groups) {
      const { branch, projects, span } = group;
      const branchY = cursorY + span / 2 - PROJECT_STEP / 2;

      if (branch.x !== BRANCH_X || branch.y !== branchY) {
        branch.x = BRANCH_X;
        branch.y = branchY;
        changed = true;
      }

      if (projects.length) {
        const projectsSpan = projects.length * PROJECT_STEP;
        const projectStartY = cursorY + (span - projectsSpan) / 2;
        projects.forEach((project, index) => {
          const projectY = projectStartY + index * PROJECT_STEP;
          if (project.x !== PROJECT_X || project.y !== projectY) {
            project.x = PROJECT_X;
            project.y = projectY;
            changed = true;
          }
        });
      }

      cursorY += span + GROUP_GAP;
    }

    // Center the ecosystem/root card against all category branches.
    const firstBranch = groups[0].branch;
    const lastBranch = groups[groups.length - 1].branch;
    const rootY = (firstBranch.y + lastBranch.y) / 2;
    if (root.x !== ROOT_X || root.y !== rootY) {
      root.x = ROOT_X;
      root.y = rootY;
      changed = true;
    }

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

// CR3@TIX ANALYTIX — runtime loader. This file is copied into the final
// GitHub Pages artifact by the MAP deployment workflow, so tracking survives
// the ZIP-based build pipeline.
(() => {
  if (document.querySelector('script[data-project-id="0c8c04fe-a4fb-450d-a05f-2abdaf1400be"]')) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://kevinlabens-del.github.io/CR3-TIX-ANALYTIX./analytics.js';
  script.dataset.projectId = '0c8c04fe-a4fb-450d-a05f-2abdaf1400be';
  script.dataset.projectKey = '432b28f8-846b-4b7c-8912-9bc7edd6ccbc';
  document.head.appendChild(script);
})();
