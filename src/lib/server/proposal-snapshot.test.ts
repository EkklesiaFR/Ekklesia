import { describe, it, expect, vi } from 'vitest';
import { archiveMedia, snapshotProject, checkPublishableSize, checkSnapshotSize, contentHash, MAX_MEDIA_BYTES, newSnapshotBudget } from './proposal-snapshot';
import { projectsForVote } from '../vote-projects';
import type { Project } from '../../types';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6xC0AAAAASUVORK5CYII=', 'base64');
const dataUrl = `data:image/png;base64,${png.toString('base64')}`;

describe('immutable proposal content', () => {
  it('copies public fields and actual image bytes, without identity/private metadata', async () => {
    const s = await snapshotProject('A', { title: 'A', summary: 'S', budget: '100', imageUrl: dataUrl, ownerEmail: 'private', ownerUid: 'private', longDescription: 'Full', ownerBio: 'Bio' });
    expect(s).toMatchObject({ imageUrl: dataUrl, longDescription: 'Full', ownerBio: 'Bio' });
    expect(s).not.toHaveProperty('ownerUid'); expect(s).not.toHaveProperty('ownerEmail');
    expect(s.mediaVersions[0]).toMatchObject({ contentType: 'image/png', bytes: png.length });
    expect(contentHash(s)).toBe(contentHash(Object.fromEntries(Object.entries(s).reverse())));
  });
  it('freezes downloadable attachment bytes instead of retaining a mutable link', async () => {
    const fetcher = vi.fn(async () => new Response('%PDF-1.7\nexample'));
    const s = await snapshotProject('A', { title: 'A', summary: 'S', budget: '100', links: [{ label: 'Budget', url: 'https://storage.googleapis.com/bucket/budget.pdf' }] }, fetcher);
    expect(s.links![0]).toMatchObject({ download: 'piece-1.pdf', url: 'data:application/pdf;base64,JVBERi0xLjcKZXhhbXBsZQ==' });
  });
  it.each(['http://images.unsplash.com/x', 'https://127.0.0.1/x', 'https://images.unsplash.com.evil.test/x', 'https://u:p@images.unsplash.com/x', 'https://images.unsplash.com:444/x', 'file:///etc/passwd'])('rejects unsafe source %s before fetching', async url => {
    const fetcher = vi.fn();
    await expect(archiveMedia(url, true, fetcher)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('checks every redirect before any request to its destination', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/computeMetadata/v1/' } }));
    await expect(archiveMedia('https://picsum.photos/x', true, fetcher)).rejects.toThrow('Hôte');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('archives permitted redirects, but rejects missing, oversized and non-image responses', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://fastly.picsum.photos/id/x' } })).mockResolvedValueOnce(new Response(png));
    expect((await archiveMedia('https://picsum.photos/x', true, fetcher)).url).toBe(dataUrl);
    for (const response of [new Response(null, { status: 404 }), new Response('<svg><image href="https://evil.test"/></svg>'), new Response(Buffer.alloc(MAX_MEDIA_BYTES + 1))]) {
      await expect(archiveMedia('https://placehold.co/x', true, async () => response)).rejects.toThrow();
    }
    await expect(archiveMedia('data:application/pdf;base64,JVBERi0=', true)).rejects.toThrow();
  });
  it('refuses oversized snapshots and never falls back to live content for a missing version', () => {
    expect(() => checkSnapshotSize([{ longDescription: 'x'.repeat(820000) } as never])).toThrow('volumineux');
    const live = [{ id: 'A', title: 'Changed' }] as Project[];
    expect(projectsForVote({ projectIds: ['A'], proposalSnapshotVersion: 1 }, live)).toEqual([]);
    expect(projectsForVote({ projectIds: ['A'] }, live)).toEqual(live);
  });
  it('reserves room for duplicated result titles and existing draft fields before freezing', async () => {
    const snapshot = await snapshotProject('A', { title: 'x'.repeat(600000), summary: 'S', budget: '100' });
    expect(() => checkSnapshotSize([snapshot])).not.toThrow();
    expect(() => checkPublishableSize({}, [snapshot])).toThrow('publier');
    const small = { ...snapshot, title: 'A' };
    expect(() => checkPublishableSize({}, [small])).not.toThrow();
    expect(() => checkPublishableSize({ question: 'x'.repeat(930000) }, [small])).toThrow('publier');
  });
  it('bounds cumulative downloads within and across projects, plus total media count and time', async () => {
    const pdf = Buffer.alloc(MAX_MEDIA_BYTES, 32); pdf.write('%PDF-1.7');
    const request = vi.fn(async () => new Response(pdf));
    const link = { label: 'Piece', url: 'https://storage.googleapis.com/bucket/piece.pdf' };
    const project = { title: 'A', summary: 'S', budget: '100', links: [link, link, link] };
    await expect(snapshotProject('A', project, request)).rejects.toThrow('volumineux');
    expect(request).toHaveBeenCalledTimes(2); // Never fetch the third piece after budget exhaustion.
    request.mockClear();
    const shared = newSnapshotBudget();
    await snapshotProject('A', { ...project, links: [link] }, request, shared);
    await expect(snapshotProject('B', project, request, shared)).rejects.toThrow('volumineux');
    expect(request).toHaveBeenCalledTimes(2);
    request.mockClear();
    await expect(snapshotProject('A', project, request, { ...newSnapshotBudget(), expiresAt: 0 })).rejects.toThrow('longue');
    await expect(snapshotProject('A', project, request, { ...newSnapshotBudget(), remainingMedia: 0 })).rejects.toThrow('médias');
    expect(request).not.toHaveBeenCalled();
  });
});
