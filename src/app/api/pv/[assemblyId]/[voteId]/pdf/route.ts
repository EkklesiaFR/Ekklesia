/// <reference types="node" />

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { getAdminDb } from '@/lib/firebase/admin';
import { computeFinalSeal, type RankingRow } from '@/lib/pv/seal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { assemblyId: string; voteId: string };

function bufferFromStream(doc: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: any) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatDateFR(d: Date) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts?.toDate) return ts.toDate();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sanitizeFilename(input: string) {
  return (input || 'pv')
    .replace(/[^\w\d\-_. ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function loadFileBuffer(relPathFromRepoRoot: string): Buffer {
  const abs = path.join(process.cwd(), relPathFromRepoRoot);
  return fs.readFileSync(abs);
}

function drawHr(doc: any, y: number, color = '#E5E7EB') {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  doc.save();
  doc.strokeColor(color).lineWidth(1);
  doc.moveTo(left, y).lineTo(right, y).stroke();
  doc.restore();
}

function drawSectionTitle(doc: any, title: string) {
  doc.moveDown(0.6);
  doc.font('FigtreeBold').fontSize(12).fillColor('#111827').text(title.toUpperCase(), {
    characterSpacing: 1.2,
  });
  doc.moveDown(0.4);
}

function badge(doc: any, text: string, x: number, y: number, opts?: { bg?: string; fg?: string }) {
  const bg = opts?.bg ?? '#111827';
  const fg = opts?.fg ?? '#FFFFFF';
  doc.save();
  doc.font('FigtreeBold').fontSize(9);
  const padX = 8;
  const w = doc.widthOfString(text) + padX * 2;
  const h = 20;
  doc.roundedRect(x, y, w, h, 2).fill(bg);
  doc.fillColor(fg).text(text, x + padX, y + 5);
  doc.restore();
}

/**
 * Table helper: row with wrapping + pagination.
 */
function drawRankingTable(doc: any, rows: Array<{ rank: number; title: string; id: string; score: string }>) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const tableWidth = right - left;

  const colRank = 36;
  const colScore = 64;
  const colId = 150;
  const colTitle = tableWidth - colRank - colScore - colId;

  const headerYStart = doc.y;

  doc.save();
  doc.font('FigtreeBold').fontSize(10).fillColor('#111827');
  doc.text('#', left, doc.y, { width: colRank });
  doc.text('Projet', left + colRank, headerYStart, { width: colTitle });
  doc.text('ID', left + colRank + colTitle, headerYStart, { width: colId });
  doc.text('Score', left + colRank + colTitle + colId, headerYStart, { width: colScore, align: 'right' });
  doc.restore();

  doc.moveDown(0.6);
  drawHr(doc, doc.y, '#E5E7EB');
  doc.moveDown(0.6);

  const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 40;

  for (const r of rows) {
    const y0 = doc.y;

    doc.save();
    doc.font('Figtree').fontSize(10).fillColor('#111827');

    const titleHeight = doc.heightOfString(r.title, { width: colTitle });
    const idHeight = doc.heightOfString(r.id, { width: colId });
    const rowH = Math.max(16, titleHeight, idHeight) + 8;

    if (y0 + rowH > bottomLimit()) {
      doc.addPage();
      doc.font('FigtreeBold').fontSize(16).fillColor('#111827').text('Classement complet');
      doc.moveDown(0.6);
      drawHr(doc, doc.y);
      doc.moveDown(0.6);

      const hy = doc.y;
      doc.font('FigtreeBold').fontSize(10).fillColor('#111827');
      doc.text('#', left, hy, { width: colRank });
      doc.text('Projet', left + colRank, hy, { width: colTitle });
      doc.text('ID', left + colRank + colTitle, hy, { width: colId });
      doc.text('Score', left + colRank + colTitle + colId, hy, { width: colScore, align: 'right' });
      doc.moveDown(0.6);
      drawHr(doc, doc.y, '#E5E7EB');
      doc.moveDown(0.6);
    }

    const y = doc.y;

    doc.save();
    if (r.rank % 2 === 0) {
      doc.fillColor('#F9FAFB');
      doc.rect(left, y - 2, tableWidth, rowH).fill();
    }
    doc.restore();

    doc.save();
    doc.font('FigtreeBold').fontSize(10).fillColor('#111827');
    doc.text(String(r.rank), left, y, { width: colRank });

    doc.font('Figtree').fontSize(10).fillColor('#111827');
    doc.text(r.title, left + colRank, y, { width: colTitle });

    doc.font('Figtree').fontSize(9).fillColor('#6B7280');
    doc.text(r.id, left + colRank + colTitle, y, { width: colId });

    doc.font('FigtreeBold').fontSize(10).fillColor('#111827');
    doc.text(r.score, left + colRank + colTitle + colId, y, { width: colScore, align: 'right' });
    doc.restore();

    doc.y = y + rowH;
    drawHr(doc, doc.y, '#F1F5F9');
    doc.moveDown(0.2);
  }
}

function normalizeMethod(input: any) {
  const s = String(input ?? '').trim();
  return s ? s.toLowerCase() : 'schulze';
}

function pickLockedAtISO(voteData: any): string {
  const lockedAt = tsToDate(voteData?.lockedAt);
  const computedAt = tsToDate(voteData?.results?.computedAt);
  const d = lockedAt ?? computedAt ?? new Date();
  return d.toISOString();
}

/**
 * ✅ Canonical payload: THIS MUST MATCH api/verify.
 */
function buildSealPayload(voteId: string, voteData: any) {
  const results = voteData?.results ?? {};
  const method = normalizeMethod(results?.method ?? voteData?.method ?? 'schulze');

  const lockedAtISO = pickLockedAtISO(voteData);

  const ballotsCount =
    Number(results?.totalBallots ?? results?.total ?? results?.totalVotes ?? voteData?.ballotsCount ?? 0) || 0;

  const eligible = Number(voteData?.eligibleCountAtOpen ?? voteData?.eligibleCount ?? 0) || 0;
  const participationPct = eligible > 0 ? Math.round((100 * ballotsCount) / eligible) : null;

  const winnerId = results?.winnerId ? String(results.winnerId) : null;

  const fullRanking = Array.isArray(results?.fullRanking) ? results.fullRanking : [];
  const ranking: RankingRow[] = fullRanking.map((r: any) => {
    const projectId = String(r?.id ?? r?.projectId ?? '').trim();
    const titleRaw = String(r?.title ?? r?.name ?? '').trim();
    return {
      projectId,
      title: titleRaw || projectId,
      score: Number(r?.score ?? r?.rank ?? 0) || 0,
    };
  });

  return { method, lockedAtISO, ballotsCount, participationPct, winnerId, ranking, eligible };
}

function extractPVMeta(voteId: string, voteData: any) {
  const title = voteData?.question ?? voteData?.title ?? voteData?.name ?? `Vote ${voteId}`;
  const state = (voteData?.state ?? voteData?.status ?? '—').toString();

  const createdAt = tsToDate(voteData?.createdAt);
  const openedAt = tsToDate(voteData?.openedAt ?? voteData?.openAt ?? voteData?.stateOpenedAt ?? voteData?.startedAt);
  const lockedAt = tsToDate(voteData?.lockedAt);
  const computedAt = tsToDate(voteData?.results?.computedAt);

  const computedBy = (voteData?.results?.computedBy ?? '—').toString();
  const resultsHash = (voteData?.results?.resultsHash ?? voteData?.resultsHash ?? null) as string | null;

  const quorumPct = Number(voteData?.quorumPct ?? 0) || 0;

  return { title, state, createdAt, openedAt, lockedAt, computedAt, computedBy, resultsHash, quorumPct };
}

/**
 * Annexe pseudo : HMAC (stable pour le vote, non corrélable entre scrutins si on inclut voteId).
 * NB: pas besoin d’être réversible.
 */
function pseudonymize(uid: string, voteId: string) {
  const salt = process.env.PV_SALT; // local .env.local ou secret App Hosting
  if (!salt) return 'UNKNOWN';
  return crypto.createHmac('sha256', salt).update(`pseudo:${uid}:${voteId}`).digest('hex').slice(0, 10).toUpperCase();
}

async function fetchBallotsForPseudolist(db: any, assemblyId: string, voteId: string) {
  try {
    const ref = db.collection(`assemblies/${assemblyId}/votes/${voteId}/ballots`);
    const snap = await ref.get();
    const res: Array<{ uid: string; createdAt?: Date | null }> = [];
    snap.forEach((docSnap: any) => {
      const d = docSnap.data() || {};
      const uid = String(d?.memberId ?? d?.voterId ?? d?.uid ?? d?.createdBy ?? d?.userId ?? docSnap.id ?? '').trim();
      if (!uid) return;
      const createdAt = tsToDate(d?.createdAt ?? d?.submittedAt ?? d?.castAt ?? d?.timestamp) ?? null;
      res.push({ uid, createdAt });
    });
    res.sort((a, b) => (a.createdAt?.getTime?.() ?? 0) - (b.createdAt?.getTime?.() ?? 0));
    return res;
  } catch {
    return [];
  }
}

export async function GET(_req: Request, { params }: { params: RouteParams }) {
  try {
    const { assemblyId, voteId } = params;

    let db;
    try {
      db = getAdminDb();
    } catch (e: any) {
      return NextResponse.json(
        {
          error: 'Firebase Admin init failed',
          message: e?.message ?? String(e),
          hint:
            'Sur App Hosting, utilisez ADC (pas besoin de FIREBASE_PRIVATE_KEY). Si permission-denied => IAM Firestore.',
        },
        { status: 500 }
      );
    }

    const snap = await db.doc(`assemblies/${assemblyId}/votes/${voteId}`).get();
    if (!snap.exists) return NextResponse.json({ error: 'Vote not found', assemblyId, voteId }, { status: 404 });

    const voteData = snap.data();
    if (!voteData) return NextResponse.json({ error: 'Vote data empty', assemblyId, voteId }, { status: 404 });

    const meta = extractPVMeta(voteId, voteData);
    const sealPayload = buildSealPayload(voteId, voteData);

    if (!sealPayload.winnerId || sealPayload.ranking.length === 0) {
      return NextResponse.json(
        {
          error: 'Vote has no finalized results for PDF',
          winnerId: sealPayload.winnerId,
          rankingLength: sealPayload.ranking.length,
          hint: 'Vérifie vote.results.winnerId et vote.results.fullRanking',
        },
        { status: 400 }
      );
    }

    const finalSeal = computeFinalSeal({
      voteId,
      method: sealPayload.method,
      lockedAtISO: sealPayload.lockedAtISO,
      ballotsCount: sealPayload.ballotsCount,
      participationPct: sealPayload.participationPct,
      winnerId: sealPayload.winnerId,
      ranking: sealPayload.ranking,
    });

    const [{ default: PDFDocument }, qrcodeMod] = await Promise.all([import('pdfkit'), import('qrcode')]);
    const QRCode: any = (qrcodeMod as any).default ?? qrcodeMod;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
    const verifyUrl =
      `${appUrl}/verify` +
      `?voteId=${encodeURIComponent(voteId)}` +
      `&assemblyId=${encodeURIComponent(assemblyId)}` +
      `&seal=${encodeURIComponent(finalSeal)}`;

    const qrBuffer: Buffer = await QRCode.toBuffer(verifyUrl, { type: 'png', margin: 1, scale: 5 });

    // Fonts
    let figtreeRegular: Buffer;
    let figtreeBold: Buffer;
    try {
      figtreeRegular = loadFileBuffer('src/assets/fonts/Figtree-Regular.ttf');
      figtreeBold = loadFileBuffer('src/assets/fonts/Figtree-Bold.ttf');
    } catch (e: any) {
      return NextResponse.json(
        {
          error: 'Missing PDF fonts',
          message:
            "Impossible de charger les polices. Ajoute ces fichiers : src/assets/fonts/Figtree-Regular.ttf et src/assets/fonts/Figtree-Bold.ttf",
          detail: e?.message ?? String(e),
        },
        { status: 500 }
      );
    }

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, left: 56, right: 56, bottom: 56 },
      info: { Title: `PV - ${meta.title}`, Author: 'Ekklesia', Subject: 'Procès-verbal scellé' },
    });

    doc.registerFont('Figtree', figtreeRegular);
    doc.registerFont('FigtreeBold', figtreeBold);

    // --- Page 1
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;

    doc.font('FigtreeBold').fontSize(10).fillColor('#111827').text('EKKLESIA', left, doc.y, { characterSpacing: 2 });
    doc.font('Figtree').fontSize(9).fillColor('#6B7280').text('Procès-verbal de scrutin • Document scellé', left);

    doc.moveDown(0.8);
    drawHr(doc, doc.y);
    doc.moveDown(0.8);

    doc.font('FigtreeBold').fontSize(20).fillColor('#111827').text(meta.title);
    doc.moveDown(0.4);

    const badgeY = doc.y;
    badge(doc, String(meta.state || '—').toUpperCase(), left, badgeY, { bg: '#111827', fg: '#FFFFFF' });
    badge(doc, String(sealPayload.method || '—').toUpperCase(), left + 110, badgeY, { bg: '#F3F4F6', fg: '#111827' });
    doc.moveDown(1.3);

    drawSectionTitle(doc, 'Identification du scrutin');
    doc.font('Figtree').fontSize(10).fillColor('#111827');
    doc.text(`Assemblée : ${assemblyId}`);
    doc.text(`Vote ID : ${voteId}`);
    if (meta.createdAt) doc.text(`Création : ${formatDateFR(meta.createdAt)}`);
    if (meta.openedAt) doc.text(`Ouverture : ${formatDateFR(meta.openedAt)}`);
    doc.text(`Clôture : ${meta.lockedAt ? formatDateFR(meta.lockedAt) : '—'}`);
    doc.text(`Calcul : ${meta.computedAt ? formatDateFR(meta.computedAt) : '—'}`);
    doc.text(`computedBy : ${meta.computedBy || '—'}`);

    drawSectionTitle(doc, 'Participation & validité');

    const eligibleTxt = sealPayload.eligible ? String(sealPayload.eligible) : '—';
    const participationTxt = sealPayload.participationPct != null ? `${sealPayload.participationPct}%` : '—';
    const quorumTxt = `${meta.quorumPct}%`;

    const isValid =
      sealPayload.participationPct != null ? sealPayload.participationPct >= meta.quorumPct : null;

    const validity = isValid == null ? '—' : isValid ? 'VALIDE (quorum atteint)' : 'INVALIDE (quorum non atteint)';

    const boxY = doc.y;
    const boxH = 92;
    doc.save();
    doc.roundedRect(left, boxY, right - left, boxH, 6).fill('#F9FAFB');
    doc.restore();

    const pX = left + 14;
    const pY = boxY + 12;

    doc.font('FigtreeBold').fontSize(10).fillColor('#111827');
    doc.text('Éligibles (snapshot à l’ouverture)', pX, pY);
    doc.text('Bulletins exprimés', pX, pY + 22);
    doc.text('Participation', pX, pY + 44);
    doc.text('Quorum requis', pX, pY + 66);

    doc.font('Figtree').fontSize(10).fillColor('#111827');
    doc.text(eligibleTxt, pX + 220, pY);
    doc.text(String(sealPayload.ballotsCount), pX + 220, pY + 22);
    doc.text(participationTxt, pX + 220, pY + 44);
    doc.text(quorumTxt, pX + 220, pY + 66);

    const vBg = isValid == null ? '#F3F4F6' : isValid ? '#DCFCE7' : '#FEE2E2';
    const vFg = isValid == null ? '#111827' : isValid ? '#166534' : '#991B1B';
    doc.save();
    doc.roundedRect(right - 210, boxY + 14, 196, 28, 6).fill(vBg);
    doc.restore();
    doc.font('FigtreeBold').fontSize(10).fillColor(vFg).text(validity, right - 200, boxY + 22, {
      width: 176,
      align: 'center',
    });

    doc.y = boxY + boxH + 6;

    drawSectionTitle(doc, 'Résultat');
    doc.font('FigtreeBold').fontSize(14).fillColor('#111827').text('Projet vainqueur');
    doc.moveDown(0.3);
    doc.font('Figtree').fontSize(10).fillColor('#111827');
    doc.text(`${sealPayload.winnerId}`);
    doc.moveDown(0.6);

    drawSectionTitle(doc, 'Intégrité & vérification');
    doc.font('Figtree').fontSize(9).fillColor('#6B7280').text(
      'Ce document est scellé cryptographiquement. Toute modification invalide le scellé.'
    );
    doc.moveDown(0.6);

    const integrityTop = doc.y;
    const integrityHeight = 110;

    doc.save();
    doc.roundedRect(left, integrityTop, right - left, integrityHeight, 6).strokeColor('#E5E7EB').lineWidth(1).stroke();
    doc.restore();

    doc.font('FigtreeBold').fontSize(9).fillColor('#111827');
    doc.text('Final seal (HMAC-SHA256)', left + 12, integrityTop + 12);
    doc.font('Figtree').fontSize(9).fillColor('#111827');
    doc.text(finalSeal, left + 12, integrityTop + 26, { width: right - left - 160 });

    doc.font('FigtreeBold').fontSize(9).fillColor('#111827');
    doc.text('lockedAt (ISO)', left + 12, integrityTop + 56);
    doc.font('Figtree').fontSize(9).fillColor('#111827');
    doc.text(sealPayload.lockedAtISO, left + 12, integrityTop + 70);

    if (meta.resultsHash) {
      doc.font('FigtreeBold').fontSize(9).fillColor('#111827');
      doc.text('resultsHash', left + 12, integrityTop + 88);
      doc.font('Figtree').fontSize(9).fillColor('#111827');
      doc.text(String(meta.resultsHash), left + 80, integrityTop + 88, { width: right - left - 228 });
    }

    const qrSize = 92;
    const qrX = right - 12 - qrSize;
    const qrY = integrityTop + 12;
    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
    doc.font('Figtree').fontSize(8).fillColor('#6B7280').text('Vérifier ce PV', qrX - 4, qrY + qrSize + 4, {
      width: qrSize + 8,
      align: 'center',
    });

    doc.y = integrityTop + integrityHeight + 10;

    doc.font('Figtree').fontSize(8).fillColor('#6B7280').text(
      `Généré par Ekklesia • ${formatDateFR(new Date())} • Référence : ${voteId}`,
      left,
      doc.page.height - doc.page.margins.bottom - 12,
      { width: right - left, align: 'left' }
    );

    // --- Page 2
    doc.addPage();
    doc.font('FigtreeBold').fontSize(16).fillColor('#111827').text('Classement complet');
    doc.moveDown(0.6);
    drawHr(doc, doc.y);
    doc.moveDown(0.8);

    const rankingRows = sealPayload.ranking.map((r, idx) => ({
      rank: idx + 1,
      title: (r.title || r.projectId || '').trim() || '(Sans titre)',
      id: r.projectId,
      score: String(r.score),
    }));
    drawRankingTable(doc, rankingRows);

    // --- Page 3 option: émargement pseudonymisé
    const includePseudolist = process.env.PV_INCLUDE_PSEUDOLIST === '1';
    if (includePseudolist) {
      const ballots = await fetchBallotsForPseudolist(db, assemblyId, voteId);

      doc.addPage();
      doc.font('FigtreeBold').fontSize(16).fillColor('#111827').text('Annexe — Émargement (pseudonymisé)');
      doc.moveDown(0.6);
      drawHr(doc, doc.y);
      doc.moveDown(0.8);

      doc.font('Figtree').fontSize(9).fillColor('#6B7280').text(
        'Les identifiants des votants sont pseudonymisés. Le pseudonyme est stable pour ce scrutin, et non corrélable entre scrutins.'
      );
      doc.moveDown(0.8);

      const left3 = doc.page.margins.left;
      const right3 = doc.page.width - doc.page.margins.right;
      const w3 = right3 - left3;

      const colN = 40;
      const colPseudo = 140;
      const colWhen = w3 - colN - colPseudo;

      doc.font('FigtreeBold').fontSize(10).fillColor('#111827');
      doc.text('#', left3, doc.y, { width: colN });
      doc.text('Pseudonyme', left3 + colN, doc.y, { width: colPseudo });
      doc.text('Vote enregistré', left3 + colN + colPseudo, doc.y, { width: colWhen });
      doc.moveDown(0.6);
      drawHr(doc, doc.y, '#E5E7EB');
      doc.moveDown(0.6);

      const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 40;

      const items = ballots.map((b) => ({
        pseudo: pseudonymize(b.uid, voteId),
        when: b.createdAt ? formatDateFR(b.createdAt) : '—',
      }));

      for (let i = 0; i < items.length; i++) {
        if (doc.y > bottomLimit()) {
          doc.addPage();
          doc.font('FigtreeBold').fontSize(16).fillColor('#111827').text('Annexe — Émargement (pseudonymisé)');
          doc.moveDown(0.6);
          drawHr(doc, doc.y);
          doc.moveDown(0.8);

          doc.font('FigtreeBold').fontSize(10).fillColor('#111827');
          doc.text('#', left3, doc.y, { width: colN });
          doc.text('Pseudonyme', left3 + colN, doc.y, { width: colPseudo });
          doc.text('Vote enregistré', left3 + colN + colPseudo, doc.y, { width: colWhen });
          doc.moveDown(0.6);
          drawHr(doc, doc.y, '#E5E7EB');
          doc.moveDown(0.6);
        }

        doc.font('Figtree').fontSize(10).fillColor('#111827');
        doc.text(String(i + 1), left3, doc.y, { width: colN });
        doc.text(items[i].pseudo, left3 + colN, doc.y, { width: colPseudo });
        doc.text(items[i].when, left3 + colN + colPseudo, doc.y, { width: colWhen });
        doc.moveDown(0.4);
        drawHr(doc, doc.y, '#F1F5F9');
        doc.moveDown(0.2);
      }

      if (!items.length) {
        doc.font('Figtree').fontSize(10).fillColor('#6B7280').text(
          'Aucun bulletin trouvé dans la collection ballots (ou schéma différent).'
        );
      }
    }

    const pdfBuffer = await bufferFromStream(doc);

    const filenameSafe = sanitizeFilename(meta.title);
    const filename = `PV_${filenameSafe}_${voteId}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'PV PDF generation failed', message: e?.message ?? String(e), name: e?.name, stack: e?.stack },
      { status: 500 }
    );
  }
}