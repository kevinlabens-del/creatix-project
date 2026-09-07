import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const [appPath, outputPath] = process.argv.slice(2);
const endpoint = 'https://gwqojqwcbwoulxrctaqz.supabase.co/functions/v1/cr3atix-admin';
const SYSTEM_NODES = [
  {
    id: 'soutien',
    parent: 'apps',
    title: 'CR3@TIX SOUTIEN',
    type: 'APPLICATION',
    desc: 'Soutenir volontairement les projets CR3@TIX, sans contrepartie',
    url: 'https://kevinlabens-del.github.io/creatix-project/soutien/',
    icon: 'https://kevinlabens-del.github.io/creatix-project/soutien/assets/icon.svg',
    status: 'online',
    progress: 100
  },
  {
    id: 'ai-live',
    parent: 'apps',
    title: 'CR3@TIX AI LIVE',
    type: 'APPLICATION',
    desc: 'Conférences sur l’intelligence artificielle en direct, à venir et en replay dans un lecteur intégré',
    url: 'https://creatix-ai-live.netlify.app/',
    icon: 'https://creatix-ai-live.netlify.app/icons/icon.svg',
    github: 'https://github.com/kevinlabens-del/creatix-ai-live',
    status: 'online',
    progress: 100,
    version: '3.2.1',
    addedAt: '2026-09-07'
  }
];
if (!appPath || !outputPath) throw new Error('Usage: node build-project-manifest.mjs <app.js> <projects.json>');

function extractNodes(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.nodes)) return payload.nodes;
  if (Array.isArray(payload?.data?.nodes)) return payload.data.nodes;
  if (Array.isArray(payload?.projects)) return payload.projects;
  return [];
}

function defaultNodesExpression(source) {
  const marker = 'const DEFAULT_NODES=';
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error('DEFAULT_NODES introuvable dans app.js');
  const start = source.indexOf('[', markerIndex + marker.length);
  if (start < 0) throw new Error('Tableau DEFAULT_NODES introuvable');
  let depth = 0, quote = '', escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') { quote = character; continue; }
    if (character === '[') depth += 1;
    if (character === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error('Tableau DEFAULT_NODES incomplet');
}

async function remoteNodes() {
  if (process.env.MAP_MANIFEST_OFFLINE === '1') throw new Error('mode hors ligne demandé');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(endpoint, { headers: { accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error(`MAP API HTTP ${response.status}`);
    const nodes = extractNodes(await response.json());
    if (!nodes.length) throw new Error('MAP API sans projet');
    return nodes;
  } finally {
    clearTimeout(timeout);
  }
}

function cleanText(value, maximum) { return typeof value === 'string' ? value.trim().slice(0, maximum) : ''; }
function ensureSystemNodes(nodes) {
  const next = Array.isArray(nodes) ? [...nodes] : [];
  const ids = new Set(next.map(node => node?.id));
  for (const node of SYSTEM_NODES) if (!ids.has(node.id)) next.push(node);
  return next;
}
function normalize(nodes) {
  return nodes.flatMap(node => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return [];
    const id = cleanText(node.id || node.source_node_id, 80);
    const title = cleanText(node.title || node.name, 120);
    if (!id || !title) return [];
    return [{
      id,
      parent: cleanText(node.parent, 80) || null,
      title,
      type: cleanText(node.type || node.category, 60),
      desc: cleanText(node.desc || node.description, 600),
      url: cleanText(node.url, 2048),
      icon: cleanText(node.icon || node.image, 2048),
      github: cleanText(node.github || node.repository_url, 2048),
      status: cleanText(node.status, 30),
      progress: Math.max(0, Math.min(100, Number(node.progress) || 0)),
      version: cleanText(node.version, 30),
      addedAt: cleanText(node.addedAt || node.added_at, 40)
    }];
  });
}

let nodes, source;
try {
  nodes = await remoteNodes();
  source = 'cr3atix-map-supabase';
} catch (error) {
  console.warn(`MAP API indisponible pendant le build (${error instanceof Error ? error.message : 'erreur'}), utilisation de DEFAULT_NODES.`);
  const appSource = await readFile(appPath, 'utf8');
  nodes = vm.runInNewContext(defaultNodesExpression(appSource), Object.create(null), { timeout: 500 });
  source = 'cr3atix-map-default-nodes';
}
nodes = ensureSystemNodes(nodes);

const manifest = {
  schema_version: 1,
  source,
  generated_at: new Date().toISOString(),
  nodes: normalize(nodes)
};
if (!manifest.nodes.length) throw new Error('Le manifeste généré serait vide');
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Manifeste MAP généré : ${manifest.nodes.length} nœuds (${source}).`);
