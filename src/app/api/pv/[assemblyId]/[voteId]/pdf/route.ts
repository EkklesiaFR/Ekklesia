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
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
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

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Pseudonymisation forte (non réversible si PV_SALT est secret) :
 * pseudo = sha256(uid + voteId + PV_SALT).slice(0, 10).toUpperCase()
 */
function pseudonymize(uid: string, voteId: string) {
  const salt = process.env.PV_SALT || 'dev-salt-change-me';
  return sha256Hex(`${uid}:${voteId}:${salt}`).slice(0, 10).toUpperCase();
}

function extractPVFromVote(voteId: string, voteData: any) {
  const title = voteData?.question ?? voteData?.title ?? voteData?.name ?? `Vote ${voteId}`;
  const state = (voteData?.state ?? voteData?.status ?? '—').toString();

  const lockedAt = tsToDate(voteData?.lockedAt);
  const computedAt = tsToDate(voteData?.results?.computedAt);

  // Optionnel (selon ton modèle)
  const openedAt = tsToDate(voteData?.openedAt ?? voteData?.openAt ?? voteData?.stateOpenedAt ?? voteData?.startedAt);
  const createdAt = tsToDate(voteData?.createdAt);

  const method = (voteData?.results?.method ?? voteData?.method ?? '—').toString();
  const computedBy = (voteData?.results?.computedBy ?? '—').toString();

  const resultsHash = (voteData?.results?.resultsHash ?? voteData?.resultsHash ?? null) as string | null;
  const winnerId = (voteData?.results?.winnerId ?? null) as string | null;

  const totalBallots =
    Number(voteData?.results?.total ?? voteData?.results?.totalBallots ?? voteData?.ballotsCount ?? 0) || 0;

  const eligible = Number(voteData?.eligibleCountAtOpen ?? voteData?.eligibleCount ?? 0) || 0;
  const participationPct = eligible > 0 ? Math.round((100 * totalBallots) / eligible) : null;

  // ✅ quorum (compat : absent => 0)
  const quorumPct = Number(voteData?.quorumPct ?? 0) || 0;
  const isValid = participationPct != null ? participationPct >= quorumPct : null;

  const fullRanking = Array.isArray(voteData?.results?.fullRanking) ? voteData.results.fullRanking : [];
  const ranking: RankingRow[] = fullRanking.map((r: any) => ({
    projectId: String(r.id ?? r.projectId ?? ''),
    title: String(r.title ?? ''),
    score: Number(r.score ?? r.rank ?? 0),
  }));

  return {
    title,
    state,
    createdAt,
    openedAt,
    lockedAt,
    computedAt,
    method,
    computedBy,
    resultsHash,
    winnerId,
    totalBallots,
    eligible: eligible || null,
    participationPct,
    quorumPct,
    isValid,
    ranking,
  };
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
  const padY = 4;
  const w = doc.widthOfString(text) + padX * 2;
  const h = 16 + padY;
  doc.roundedRect(x, y, w, h, 2).fill(bg);
  doc.fillColor(fg).text(text, x + padX, y + 4);
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

  // Header
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

    // Measure title height (wrapping)
    doc.save();
    doc.font('Figtree').fontSize(10).fillColor('#111827');

    const titleHeight = doc.heightOfString(r.title, { width: colTitle });
    const idHeight = doc.heightOfString(r.id, { width: colId });
    const rowH = Math.max(16, titleHeight, idHeight) + 8;

    // Pagination
    if (y0 + rowH > bottomLimit()) {
      doc.addPage();
      doc.font('FigtreeBold').fontSize(16).fillColor('#111827').text('Classement complet');
      doc.moveDown(0.6);
      drawHr(doc, doc.y);
      doc.moveDown(0.6);

      // re-draw header
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

    // zebra
    const idx = r.rank;
    doc.save();
    if (idx % 2 === 0) {
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

async function fetchBallotsForPseudolist(db: any, assemblyId: string, voteId: string) {
  // Tentative de lire une collection ballots standard.
  // Si ton schéma diffère, on reste robuste et on retourne [].
  try {
    const ref = db.collection(`assemblies/${assemblyId}/votes/${voteId}/ballots`);
    const snap = await ref.get();
    const res: Array<{ uid: string; createdAt?: Date | null }> = [];
    snap.forEach((docSnap: any) => {
      const d = docSnap.data() || {};
      const uid =
        String(d?.memberId ?? d?.voterId ?? d?.uid ?? d?.createdBy ?? d?.userId ?? docSnap.id ?? '').trim();
      if (!uid) return;
      const createdAt = tsToDate(d?.createdAt ?? d?.submittedAt ?? d?.castAt ?? d?.timestamp) ?? null;
      res.push({ uid, createdAt });
    });
    // sort by date if present
    res.sort((a, b) => {
      const ta = a.createdAt ? a.createdAt.getTime() : 0;
      const tb = b.createdAt ? b.createdAt.getTime() : 0;
      return ta - tb;
    });
    return res;
  } catch {
    return [];
  }
}

export async function GET(_req: Request, context: { params: RouteParams | Promise<RouteParams> }) {
  try {
    const { assemblyId, voteId } = await context.params;

    let db;
    try {
      db = getAdminDb();
    } catch (e: any) {
      return NextResponse.json(
        {
          error: 'Firebase Admin init failed',
          message: e?.message ?? String(e),
          hint:
            'Sur App Hosting, utilisez ADC (pas besoin de FIREBASE_PRIVATE_KEY). Si ensuite permission-denied => IAM Firestore.',
        },
        { status: 500 }
      );
    }

    const snap = await db.doc(`assemblies/${assemblyId}/votes/${voteId}`).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Vote not found', assemblyId, voteId }, { status: 404 });
    }

    const voteData = snap.data();
    if (!voteData) {
      return NextResponse.json({ error: 'Vote data empty', assemblyId, voteId }, { status: 404 });
    }

    const pv = extractPVFromVote(voteId, voteData);

    if (!pv.winnerId || pv.ranking.length === 0) {
      return NextResponse.json(
        {
          error: 'Vote has no finalized results for PDF',
          winnerId: pv.winnerId,
          rankingLength: pv.ranking.length,
          hint: 'Vérifie vote.results.winnerId et vote.results.fullRanking',
        },
        { status: 400 }
      );
    }

    const [{ default: PDFDocument }, qrcodeMod] = await Promise.all([import('pdfkit'), import('qrcode')]);
    const QRCode: any = (qrcodeMod as any).default ?? qrcodeMod;

    const lockedAtISO = (pv.lockedAt ?? pv.computedAt ?? new Date()).toISOString();

    const finalSeal = computeFinalSeal({
      voteId,
      method: pv.method,
      lockedAtISO,
      ballotsCount: pv.totalBallots,
      participationPct: pv.participationPct,
      winnerId: pv.winnerId,
      ranking: pv.ranking.map((r) => ({
        projectId: r.projectId,
        title: r.title || r.projectId,
        score: r.score,
      })),
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
    const verifyUrl =
      `${appUrl}/verify` +
      `?voteId=${encodeURIComponent(voteId)}` +
      `&assemblyId=${encodeURIComponent(assemblyId)}` +
      `&seal=${encodeURIComponent(finalSeal)}`;

    const qrBuffer: Buffer = await QRCode.toBuffer(verifyUrl, { type: 'png', margin: 1, scale: 5 });

    // Fonts (embed)
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
      info: { Title: `PV - ${pv.title}`, Author: 'Ekklesia', Subject: 'Procès-verbal scellé' },
    });

    doc.registerFont('Figtree', figtreeRegular);
    doc.registerFont('FigtreeBold', figtreeBold);

    // --- Page 1: PV institutionnel
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;

    // Header
    doc.font('FigtreeBold').fontSize(10).fillColor('#111827').text('EKKLESIA', left, doc.y, {
      characterSpacing: 2,
    });
    doc.font('Figtree').fontSize(9).fillColor('#6B7280').text('Procès-verbal de scrutin • Document scellé', left);

    doc.moveDown(0.8);
    drawHr(doc, doc.y);
    doc.moveDown(0.8);

    doc.font('FigtreeBold').fontSize(20).fillColor('#111827').text(pv.title);
    doc.moveDown(0.4);

    // Badges state + method
    const badgeY = doc.y;
    badge(doc, String(pv.state || '—').toUpperCase(), left, badgeY, { bg: '#111827', fg: '#FFFFFF' });
    badge(doc, String(pv.method || '—').toUpperCase(), left + 110, badgeY, { bg: '#F3F4F6', fg: '#111827' });
    doc.moveDown(1.3);

    // Identité
    drawSectionTitle(doc, 'Identification du scrutin');
    doc.font('Figtree').fontSize(10).fillColor('#111827');
    doc.text(`Assemblée : ${assemblyId}`);
    doc.text(`Vote ID : ${voteId}`);
    if (pv.createdAt) doc.text(`Création : ${formatDateFR(pv.createdAt)}`);
    if (pv.openedAt) doc.text(`Ouverture : ${formatDateFR(pv.openedAt)}`);
    doc.text(`Clôture : ${pv.lockedAt ? formatDateFR(pv.lockedAt) : '—'}`);
    doc.text(`Calcul : ${pv.computedAt ? formatDateFR(pv.computedAt) : '—'}`);
    doc.text(`computedBy : ${pv.computedBy || '—'}`);

    // Participation & validité
    drawSectionTitle(doc, 'Participation & validité');
    const boxY = doc.y;
    const boxH = 92;
    doc.save();
    doc.roundedRect(left, boxY, right - left, boxH, 6).fill('#F9FAFB');
    doc.restore();

    const pX = left + 14;
    const pY = boxY + 12;

    const eligibleTxt = pv.eligible != null ? String(pv.eligible) : '—';
    const participationTxt = pv.participationPct != null ? `${pv.participationPct}%` : '—';
    const quorumTxt = `${pv.quorumPct}%`;

    const validity =
      pv.isValid == null ? '—' : pv.isValid ? 'VALIDE (quorum atteint)' : 'INVALIDE (quorum non atteint)';

    // Label columns
    doc.font('FigtreeBold').fontSize(10).fillColor('#111827');
    doc.text('Éligibles (snapshot à l’ouverture)', pX, pY);
    doc.text('Bulletins exprimés', pX, pY + 22);
    doc.text('Participation', pX, pY + 44);
    doc.text('Quorum requis', pX, pY + 66);

    // Values
    doc.font('Figtree').fontSize(10).fillColor('#111827');
    doc.text(eligibleTxt, pX + 220, pY);
    doc.text(String(pv.totalBallots), pX + 220, pY + 22);
    doc.text(participationTxt, pX + 220, pY + 44);
    doc.text(quorumTxt, pX + 220, pY + 66);

    // Validity badge on right
    const vBg = pv.isValid == null ? '#F3F4F6' : pv.isValid ? '#DCFCE7' : '#FEE2E2';
    const vFg = pv.isValid == null ? '#111827' : pv.isValid ? '#166534' : '#991B1B';
    doc.save();
    doc.roundedRect(right - 210, boxY + 14, 196, 28, 6).fill(vBg);
    doc.restore();
    doc.font('FigtreeBold').fontSize(10).fillColor(vFg).text(validity, right - 200, boxY + 22, {
      width: 176,
      align: 'center',
    });

    doc.y = boxY + boxH + 6;

    // Résultat (vainqueur)
    drawSectionTitle(doc, 'Résultat');
    doc.font('FigtreeBold').fontSize(14).fillColor('#111827').text('Projet vainqueur');
    doc.moveDown(0.3);
    doc.font('Figtree').fontSize(10).fillColor('#111827');
    doc.text(`${pv.winnerId}`);
    doc.moveDown(0.6);

    // Intégrité / scellé + QR
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
    doc.text('Final seal (SHA-256)', left + 12, integrityTop + 12);
    doc.font('Figtree').fontSize(9).fillColor('#111827');
    doc.text(finalSeal, left + 12, integrityTop + 26, { width: (right - left) - 160 });

    doc.font('FigtreeBold').fontSize(9).fillColor('#111827');
    doc.text('lockedAt (ISO)', left + 12, integrityTop + 56);
    doc.font('Figtree').fontSize(9).fillColor('#111827');
    doc.text(lockedAtISO, left + 12, integrityTop + 70);

    if (pv.resultsHash) {
      doc.font('FigtreeBold').fontSize(9).fillColor('#111827');
      doc.text('resultsHash', left + 12, integrityTop + 88);
      doc.font('Figtree').fontSize(9).fillColor('#111827');
      doc.text(String(pv.resultsHash), left + 80, integrityTop + 88, { width: (right - left) - 228 });
    }

    // QR box (bottom-right of integrity block)
    const qrSize = 92;
    const qrX = right - 12 - qrSize;
    const qrY = integrityTop + 12;

    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
    doc.font('Figtree').fontSize(8).fillColor('#6B7280').text('Vérifier ce PV', qrX - 4, qrY + qrSize + 4, {
      width: qrSize + 8,
      align: 'center',
    });

    doc.y = integrityTop + integrityHeight + 10;

    // Footer page 1
    doc.font('Figtree').fontSize(8).fillColor('#6B7280').text(
      `Généré par Ekklesia • ${formatDateFR(new Date())} • Référence : ${voteId}`,
      left,
      doc.page.height - doc.page.margins.bottom - 12,
      { width: right - left, align: 'left' }
    );

    // --- Page 2: Classement complet
    doc.addPage();
    doc.font('FigtreeBold').fontSize(16).fillColor('#111827').text('Classement complet');
    doc.moveDown(0.6);
    drawHr(doc, doc.y);
    doc.moveDown(0.8);

    const rankingRows = pv.ranking.map((r, idx) => ({
      rank: idx + 1,
      title: (r.title || r.projectId || '').trim() || '(Sans titre)',
      id: r.projectId,
      score: String(r.score),
    }));
    drawRankingTable(doc, rankingRows);

    // --- Page 3 (option): émargement pseudonymisé
    // Active via env PV_INCLUDE_PSEUDOLIST="1"
    const includePseudolist = process.env.PV_INCLUDE_PSEUDOLIST === '1';

    if (includePseudolist) {
      const ballots = await fetchBallotsForPseudolist(db, assemblyId, voteId);

      doc.addPage();
      doc.font('FigtreeBold').fontSize(16).fillColor('#111827').text('Annexe — Émargement (pseudonymisé)');
      doc.moveDown(0.6);
      drawHr(doc, doc.y);
      doc.moveDown(0.8);

      doc.font('Figtree').fontSize(9).fillColor('#6B7280').text(
        'Les identifiants des votants sont pseudonymisés afin de protéger les membres. Le pseudonyme est stable pour ce scrutin, et non corrélable entre scrutins.'
      );
      doc.moveDown(0.8);

      const left3 = doc.page.margins.left;
      const right3 = doc.page.width - doc.page.margins.right;
      const w3 = right3 - left3;

      const colN = 40;
      const colPseudo = 140;
      const colWhen = w3 - colN - colPseudo;

      // header
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

    const filenameSafe = sanitizeFilename(pv.title);
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
      {
        error: 'PV PDF generation failed',
        message: e?.message ?? String(e),
        name: e?.name,
        stack: e?.stack,
      },
      { status: 500 }
    );
  }
}