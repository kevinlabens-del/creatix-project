const DEFAULT_ICON = 'assets/icon.svg';
const MAP_ASSET_BASE = new URL('../', location.href).href;

function safeHttps(value, base = location.href) {
  try {
    const url = new URL(String(value || ''), base);
    return url.protocol === 'https:' || url.origin === location.origin ? url.href : '';
  } catch {
    return '';
  }
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projet';
}

function normalizeCategory(value) {
  const key = String(value || 'PROJET').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleUpperCase('fr').slice(0, 60);
  return ({ JEUX: 'JEU', APPLICATIONS: 'APPLICATION', 'SITES WEB': 'SITE WEB' })[key] || key || 'PROJET';
}

function deriveRepository(url, explicit) {
  const provided = safeHttps(explicit);
  if (provided && new URL(provided).hostname === 'github.com') return provided.replace(/\/$/, '');
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'kevinlabens-del.github.io') return null;
    const repository = parsed.pathname.split('/').filter(Boolean)[0];
    return repository ? `https://github.com/kevinlabens-del/${repository}` : null;
  } catch {
    return null;
  }
}

export function normalizeNode(node, index = 0) {
  const url = safeHttps(node.url, MAP_ASSET_BASE);
  const id = String(node.id || node.source_node_id || slugify(node.title || node.name)).slice(0, 80);
  const name = String(node.title || node.name || id).trim().slice(0, 120);
  const icon = safeHttps(node.icon || node.image, MAP_ASSET_BASE) || DEFAULT_ICON;
  const category = normalizeCategory(node.category || node.type);
  const description = String(node.desc || node.description || 'Un projet de l’écosystème CR3@TIX.').trim().slice(0, 600);
  const repositoryUrl = deriveRepository(url, node.github || node.repository_url || node.repositoryUrl);
  const roadmap = Array.isArray(node.roadmap) ? node.roadmap.map(String).slice(0, 8) : [];
  return {
    id,
    slug: slugify(name),
    name,
    url,
    icon,
    category,
    description,
    repositoryUrl,
    status: String(node.status || 'online').toLowerCase(),
    developmentProgress: Math.max(0, Math.min(100, Number(node.progress) || 0)),
    version: node.version ? String(node.version).slice(0, 30) : null,
    supportPurpose: node.supportPurpose ? String(node.supportPurpose).slice(0, 700) : null,
    roadmap,
    sourceIndex: index,
    addedAt: node.addedAt || node.added_at || null
  };
}

function extractNodes(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.nodes)) return payload.nodes;
  if (Array.isArray(payload?.projects)) return payload.projects;
  if (Array.isArray(payload?.data?.nodes)) return payload.data.nodes;
  return [];
}

async function fetchJson(url, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { cache: 'no-store', credentials: 'omit', signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function loadProjects(config) {
  let source = 'map-api';
  let payload;
  try {
    payload = await fetchJson(config.mapApiUrl);
  } catch (apiError) {
    source = 'map-snapshot';
    try {
      payload = await fetchJson(config.mapFallbackUrl, 5000);
    } catch (snapshotError) {
      throw new AggregateError([apiError, snapshotError], 'Le registre CR3@TIX MAP est indisponible.');
    }
  }
  const nodes = extractNodes(payload);
  const projects = nodes
    .map(normalizeNode)
    .filter(project => project.url && project.id !== 'root' && !['BRANCHE', 'ECOSYSTEME'].includes(project.category));
  const unique = [...new Map(projects.map(project => [project.id, project])).values()];
  if (!unique.length) throw new Error('Le registre MAP ne contient aucun projet publiable.');
  return { projects: unique, source, fetchedAt: new Date().toISOString() };
}

export { normalizeCategory, safeHttps, slugify };
