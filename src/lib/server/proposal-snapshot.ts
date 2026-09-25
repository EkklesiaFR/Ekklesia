import { createHash } from 'node:crypto';
import type { ProposalSnapshot } from '../vote-projects';

export const MAX_SNAPSHOT_BYTES = 800 * 1024;
export const MAX_MEDIA_BYTES = 512 * 1024;
export const newSnapshotBudget = () => ({ remainingBytes: MAX_SNAPSHOT_BYTES - 2, remainingMedia: 20, expiresAt: Date.now() + 60000 });
const HOSTS = new Set(['images.unsplash.com', 'placehold.co', 'picsum.photos',
  'fastly.picsum.photos', 'firebasestorage.googleapis.com', 'storage.googleapis.com']);
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}
export const contentHash = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export class ProposalError extends Error {}
function fail(message: string): never { throw new ProposalError(message); }

function mediaType(bytes: Buffer): string {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (bytes.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  return fail('Média non pris en charge : utiliser PNG, JPEG, WebP ou PDF (liens). Les pages web et SVG ne peuvent pas être figés.');
}

/** No arbitrary proxy: known HTTPS media hosts, checked again on every redirect. */
export async function archiveMedia(source: string, imageOnly: boolean, request: typeof fetch = fetch, timeoutMs = 15000) {
  let bytes: Buffer;
  if (source.startsWith('data:')) {
    const match = /^data:(image\/(?:png|jpeg|webp)|application\/pdf);base64,([A-Za-z0-9+/]*={0,2})$/.exec(source);
    if (!match || match[2].length > Math.ceil(MAX_MEDIA_BYTES / 3) * 4) fail('Média intégré invalide ou trop volumineux.');
    bytes = Buffer.from(match[2], 'base64');
    if (bytes.toString('base64') !== match[2]) fail('Encodage du média invalide.');
  } else {
    let url: URL;
    try { url = new URL(source); } catch { return fail('URL de média invalide.'); }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      for (let redirects = 0; ; redirects++) {
        if (url.protocol !== 'https:' || url.username || url.password || url.port || !HOSTS.has(url.hostname)) {
          fail('Hôte média non pris en charge. Utiliser une image intégrée ou un hôte média autorisé.');
        }
        const response = await request(url, { redirect: 'manual', cache: 'no-store', signal: controller.signal, credentials: 'omit' });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          await response.body?.cancel();
          if (redirects >= 3 || !response.headers.get('location')) fail('Redirections média invalides.');
          url = new URL(response.headers.get('location')!, url);
          continue;
        }
        if (!response.ok || !response.body) { await response.body?.cancel(); return fail('Média indisponible : ouverture annulée.'); }
        const reader = response.body.getReader();
        const parts: Buffer[] = [];
        let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_MEDIA_BYTES) fail('Média trop volumineux (512 Kio maximum).');
            parts.push(Buffer.from(value));
          }
        } finally { await reader.cancel(); }
        bytes = Buffer.concat(parts);
        break;
      }
    } catch (error) {
      if (error instanceof ProposalError) throw error;
      return fail('Impossible de copier le média : ouverture annulée, réessayez après vérification de la source.');
    } finally { clearTimeout(timer); }
  }
  if (bytes.length > MAX_MEDIA_BYTES) fail('Média trop volumineux (512 Kio maximum).');
  const contentType = mediaType(bytes);
  if (imageOnly && !contentType.startsWith('image/')) fail('Une illustration doit être une image PNG, JPEG ou WebP.');
  return { url: `data:${contentType};base64,${bytes.toString('base64')}`, contentType,
    sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
}

export async function snapshotProject(id: string, data: FirebaseFirestore.DocumentData, request: typeof fetch = fetch,
  budget = newSnapshotBudget()): Promise<ProposalSnapshot> {
  const text = (key: string, required = false) => {
    const value = data[key];
    if (value == null && !required) return '';
    if (typeof value !== 'string' || (required && !value.trim())) fail(`Projet ${id} : champ ${key} invalide.`);
    return value as string;
  };
  const snapshot: ProposalSnapshot = { id, title: text('title', true), summary: text('summary', true),
    budget: text('budget', true), longDescription: text('longDescription'), ownerName: text('ownerName'),
    ownerBio: text('ownerBio'), contentFrozen: true, mediaVersions: [], links: [] };
  let accounted = -1; // Include the separator between projects, conservatively.
  const account = () => {
    const size = Buffer.byteLength(JSON.stringify(snapshot));
    budget.remainingBytes -= size - accounted;
    accounted = size;
    if (budget.remainingBytes < 0) fail('Contenu du scrutin trop volumineux (800 Kio, médias inclus).');
  };
  const copy = async (url: string, imageOnly: boolean) => {
    if (budget.remainingMedia-- <= 0) fail('Trop de médias : 20 maximum par scrutin.');
    const timeout = Math.min(15000, budget.expiresAt - Date.now());
    if (timeout <= 0) fail('Copie des médias trop longue (60 secondes maximum). Réessayer après vérification des sources.');
    return archiveMedia(url, imageOnly, request, timeout);
  };
  account();
  if (data.imageUrl) {
    if (typeof data.imageUrl !== 'string') fail(`Projet ${id} : image invalide.`);
    const media = await copy(data.imageUrl, true);
    snapshot.imageUrl = media.url;
    snapshot.mediaVersions.push({ field: 'imageUrl', sha256: media.sha256, contentType: media.contentType, bytes: media.bytes });
    account();
  }
  if (data.links != null && !Array.isArray(data.links)) fail(`Projet ${id} : liens invalides.`);
  for (const [index, link] of (data.links ?? []).entries()) {
    if (!link || typeof link.label !== 'string' || !link.label.trim() || typeof link.url !== 'string') fail(`Projet ${id} : lien invalide.`);
    const media = await copy(link.url, false);
    const ext = media.contentType === 'application/pdf' ? 'pdf' : media.contentType.split('/')[1];
    snapshot.links!.push({ label: link.label, url: media.url, download: `piece-${index + 1}.${ext}` });
    snapshot.mediaVersions.push({ field: `links.${index}`, sha256: media.sha256, contentType: media.contentType, bytes: media.bytes });
    account();
  }
  return snapshot;
}

export function checkSnapshotSize(snapshots: ProposalSnapshot[]) {
  if (Buffer.byteLength(JSON.stringify(snapshots)) > MAX_SNAPSHOT_BYTES) fail('Contenu du scrutin trop volumineux (800 Kio, médias inclus). Réduire les pièces avant ouverture.');
}

/** Reserve result rows (including copied titles) before freezing a Firestore document.
 * JSON plus per-row padding and 124 KiB headroom conservatively cover Firestore
 * field overhead and publication metadata; a snapshot alone is not the whole document.
 */
export function checkPublishableSize(draft: FirebaseFirestore.DocumentData, snapshots: ProposalSnapshot[]) {
  const estimate = { ...draft, proposalSnapshots: snapshots,
    results: { fullRanking: snapshots.map(p => ({ id: p.id, title: p.title, reserve: ' '.repeat(512) })),
      reserve: ' '.repeat(8192) } };
  if (Buffer.byteLength(JSON.stringify(estimate)) > 900 * 1024) {
    fail('Contenu trop volumineux pour publier le résultat : réduire les textes ou médias avant ouverture.');
  }
}
