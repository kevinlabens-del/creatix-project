import type { AppEnv } from './env';
import { HttpError, readBytesLimited } from './http';

export type RegistryProject = { id: string; name: string; url: string; category: string; description: string; icon: string | null; repository_url: string | null };
type UnknownRecord = Record<string, unknown>;

function text(value: unknown, maximum: number): string { return typeof value === 'string' ? value.trim().slice(0, maximum) : ''; }
function httpsUrl(value: unknown): string | null { try { const parsed = new URL(String(value || '')); return parsed.protocol === 'https:' ? parsed.href : null; } catch { return null; } }
function deriveRepository(url: string, explicit: unknown): string | null {
  const supplied = httpsUrl(explicit); if (supplied && new URL(supplied).hostname === 'github.com') return supplied.replace(/\/$/, '');
  const parsed = new URL(url); if (parsed.hostname !== 'kevinlabens-del.github.io') return null;
  const repository = parsed.pathname.split('/').filter(Boolean)[0]; return repository ? `https://github.com/kevinlabens-del/${repository}` : null;
}
function nodesFromPayload(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter((item): item is UnknownRecord => !!item && typeof item === 'object' && !Array.isArray(item));
  if (!value || typeof value !== 'object') return [];
  const record = value as UnknownRecord;
  return nodesFromPayload(record.nodes || (record.data as UnknownRecord | undefined)?.nodes || record.projects);
}

export async function fetchRegistry(env: AppEnv): Promise<RegistryProject[]> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(env.MAP_API_URL, { headers: { accept: 'application/json' }, signal: controller.signal, cf: { cacheTtl: 30, cacheEverything: true } });
    if (!response.ok) throw new HttpError(503, 'map_registry_unavailable');
    const declared = Number(response.headers.get('content-length') || 0); if (declared > 1_000_000) throw new HttpError(503, 'map_registry_too_large');
    const bytes = await readBytesLimited(response.body, 1_000_000);
    let payload: unknown; try { payload = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new HttpError(503, 'map_registry_invalid'); }
    return nodesFromPayload(payload).flatMap(node => {
      const id = text(node.id || node.source_node_id, 80), name = text(node.title || node.name, 120), url = httpsUrl(node.url);
      const category = text(node.category || node.type || 'PROJET', 60).toUpperCase();
      if (!id || !name || !url || id === 'root' || category === 'BRANCHE' || category === 'ÉCOSYSTÈME') return [];
      return [{ id, name, url, category, description: text(node.desc || node.description, 600), icon: httpsUrl(node.icon || node.image), repository_url: deriveRepository(url, node.github || node.repository_url) }];
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'map_registry_unavailable');
  } finally { clearTimeout(timeout); }
}

export async function resolveProject(env: AppEnv, projectId: string): Promise<RegistryProject> {
  if (projectId === 'global') return { id: 'global', name: 'CR3@TIX — Soutien global', url: env.FRONTEND_BASE_URL, category: 'ÉCOSYSTÈME', description: 'Soutien volontaire à l’ensemble des projets CR3@TIX.', icon: null, repository_url: null };
  const projects = await fetchRegistry(env); const project = projects.find(item => item.id === projectId);
  if (!project) throw new HttpError(404, 'unknown_project');
  return project;
}
