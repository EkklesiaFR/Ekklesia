/// <reference types="node" />

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

import { getAdminDb } from '@/lib/firebase/admin';
import { computeFinalSeal, type RankingRow } from '@/lib/pv/seal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PdfDocLike = {
  on: (evt: string, cb: (arg?: any) => void) => void;
  end: () => void;
};

function bufferFromStream(doc: PdfDocLike): Promise<Buffer> {
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

function extractPVFromVote(voteId: string, voteData: any) {
  const title = voteData?.question ?? voteData?.title ?? voteData?.name ?? `Vote ${voteId}`;
  const state = (voteData?.state ?? voteData?.status ?? '—').toString();

  const lockedAt = tsToDate(voteData?.lockedAt);
  const computedAt = tsToDate(voteData?.results?.computedAt);

  const method = (voteData?.results?.method ?? voteData?.method ?? '—').toString();
  const computedBy = (voteData?.results?.computedBy ?? '—').toString();

  const resultsHash = (voteData?.results?.resultsHash ?? voteData?.resultsHash ?? null) as string | null;
  const winnerId = (voteData?.results?.winnerId ?? null) as string | null;

  const totalBallots =
    Number(voteData?.results?.total ?? voteData?.results?.totalBallots ?? voteData?.ballotsCount ?? 0) || 0;

  const eligible = Number(voteData?.eligibleCountAtOpen ?? voteData?.eligibleCount ?? 0) || 0;
  const participationPct = eligible > 0 ? Math.round((100 * totalBallots) / eligible) : null;

  const fullRanking = Array.isArray(voteData?.results?.fullRanking) ? voteData.results.fullRanking : [];
  const ranking: RankingRow[] = fullRanking.map((r: any) => ({
    projectId: String(r.id ?? r.projectId ?? ''),
    title: String(r.title ?? ''),
    score: Number(r.score ?? r.rank ?? 0),
  }));

  return {
    title,
    state,
    lockedAt,
    computedAt,
    method,
    computedBy,
    resultsHash,
    winnerId,
    totalBallots,
    eligible: eligible || null,
    participationPct,
    ranking,
  };
}

function assertAdminEnv() {
  const missing: string[] = [];
  if (!process.env.FIREBASE_PROJECT_ID) missing.push('FIREBASE_PROJECT_ID');
  if (!process.env.FIREBASE_CLIENT_EMAIL) missing.push('FIREBASE_CLIENT_EMAIL');
  if (!process.env.FIREBASE_PRIVATE_KEY) missing.push('FIREBASE_PRIVATE_KEY');
  return missing;
}

function loadFont(relPath: string) {
  const p = path.join(process.cwd(), relPath);
  return fs.readFileSync(p);
}

export async function GET(_req: Request, { params }: { params: { assemblyId: string; voteId: string } }) {
  try {
    // 1) Env check
    const missing = assertAdminEnv();
    if (missing.length) {
      return NextResponse.json({ error: 'Missing Firebase Admin credentials', missing }, { status: 500 });
    }

    const { assemblyId, voteId } = params;

    // 2) Firestore
    const db = getAdminDb();
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

    // 3) Dynamic imports
    // ✅ pdfkit standalone = pas de Helvetica.afm via fs
    const pdfkitMod: any = await import('pdfkit/js/pdfkit.standalone.js');
    const PDFDocument: any = pdfkitMod.default ?? pdfkitMod;

    const qrMod: any = await import('qrcode');
    const QRCode: any = qrMod.default ?? qrMod;

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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9010';
    const verifyUrl = `${appUrl}/verify?voteId=${encodeURIComponent(voteId)}&assemblyId=${encodeURIComponent(
      assemblyId
    )}&seal=${finalSeal}`;

    // ✅ QR en DataURL (évite pdfkit.image(Buffer) -> fs.readFileSync interne)
    const qrDataUrl: string = await QRCode.toDataURL(verifyUrl, { margin: 1, scale: 5 });

    // 4) PDF
    const doc: any = new PDFDocument({
      size: 'A4',
      margins: { top: 56, left: 56, right: 56, bottom: 56 },
      info: { Title: `PV - ${pv.title}`, Author: 'Ekklesia', Subject: 'Procès-verbal scellé' },
    });

    // ✅ Fonts Figtree (TTF)
    try {
      const regular = loadFont('src/assets/fonts/Figtree-Regular.ttf');
      const bold = loadFont('src/assets/fonts/Figtree-Bold.ttf');
      doc.registerFont('Figtree', regular);
      doc.registerFont('FigtreeBold', bold);
      doc.font('Figtree');
    } catch (e: any) {
      return NextResponse.json(
        {
          error: 'Missing PDF fonts',
          message:
            "Ajoute les fichiers : src/assets/fonts/Figtree-Regular.ttf et src/assets/fonts/Figtree-Bold.ttf",
          detail: e?.message ?? String(e),
        },
        { status: 500 }
      );
    }

    const H1 = 22;
    const H2 = 13;
    const BASE = 11;
    const SMALL = 9;

    // HEADER
    doc.font('Figtree').fontSize(SMALL).fillColor('#666').text('EKKLESIA • PROCÈS-VERBAL OFFICIEL');
    doc.moveDown(0.6);

    doc.font('FigtreeBold').fontSize(H1).fillColor('#000').text(pv.title);
    doc.moveDown(0.7);

    doc.font('Figtree').fontSize(BASE).fillColor('#000');
    doc.text(`Vote ID : ${voteId}`);
    doc.text(`Assemblée : ${assemblyId}`);
    doc.text(`État : ${pv.state.toUpperCase()}`);
    doc.text(`Méthode : ${pv.method}`);
    doc.text(`PV : ${pv.computedAt ? formatDateFR(pv.computedAt) : '—'}`);
    doc.text(`Clôture : ${pv.lockedAt ? formatDateFR(pv.lockedAt) : '—'}`);
    doc.moveDown(0.9);

    // SYNTHÈSE
    doc.font('FigtreeBold').fontSize(H2).fillColor('#000').text('Synthèse');
    doc.moveDown(0.4);

    doc.font('Figtree').fontSize(BASE).fillColor('#000');
    doc.text(`Bulletins : ${pv.totalBallots}`);
    if (pv.eligible != null) doc.text(`Éligibles : ${pv.eligible}`);
    doc.text(`Participation : ${pv.participationPct != null ? `${pv.participationPct}%` : '—'}`);
    doc.moveDown(0.9);

    // WINNER
    doc.font('FigtreeBold').fontSize(H2).fillColor('#000').text('Vainqueur');
    doc.moveDown(0.4);

    doc.font('Figtree').fontSize(BASE).fillColor('#000');
    doc.text(pv.winnerId);
    doc.font('Figtree').fontSize(SMALL).fillColor('#666').text(`ID : ${pv.winnerId}`);
    doc.moveDown(0.9);

    // INTEGRITY
    doc.font('FigtreeBold').fontSize(H2).fillColor('#000').text('Intégrité');
    doc.moveDown(0.4);

    doc.font('Figtree').fontSize(SMALL).fillColor('#666').text(
      'Ce document est scellé cryptographiquement. Toute modification invalide le scellé.'
    );
    doc.moveDown(0.4);

    doc.font('Figtree').fontSize(BASE).fillColor('#000').text(`computedBy : ${pv.computedBy}`);
    doc.text(`lockedAt (ISO) : ${lockedAtISO}`);
    doc.text(`Final seal (SHA-256) : ${finalSeal}`);
    if (pv.resultsHash) doc.text(`resultsHash : ${pv.resultsHash}`);

    // QR CODE
    const qrX = 56 + 340;
    const qrY = doc.y - 64;
    doc.image(qrDataUrl, qrX, qrY, { width: 120, height: 120 });
    doc.font('Figtree').fontSize(SMALL).fillColor('#666').text('Vérifier', qrX, qrY + 122, {
      width: 120,
      align: 'center',
    });

    // PAGE 2
    doc.addPage();
    doc.font('FigtreeBold').fontSize(H1).fillColor('#000').text('Classement complet');
    doc.moveDown(0.8);

    const startX = 56;
    let y = doc.y;

    doc.font('Figtree').fontSize(SMALL).fillColor('#666');
    doc.text('#', startX, y);
    doc.text('Projet', startX + 30, y);
    doc.text('Score', 56 + 470, y, { width: 60, align: 'right' });

    y += 18;
    doc.moveTo(56, y).lineTo(56 + 483, y).strokeColor('#ddd').stroke();
    y += 12;

    doc.font('Figtree').fontSize(BASE).fillColor('#000');
    pv.ranking.forEach((r, idx) => {
      if (y > 760) {
        doc.addPage();
        y = 56;
      }
      doc.text(String(idx + 1), startX, y);
      doc.text(r.title || r.projectId, startX + 30, y, { width: 420 });
      doc.text(String(r.score), 56 + 470, y, { width: 60, align: 'right' });
      y += 18;
    });

    // FOOTER
    doc.font('Figtree').fontSize(SMALL).fillColor('#666').text(
      `Généré par Ekklesia • ${formatDateFR(new Date())} • Référence : ${voteId}`,
      56,
      800 - 56
    );

    const pdfBuffer = await bufferFromStream(doc);

    const filenameSafe = pv.title.replace(/[^\w\d\-_. ]+/g, '').slice(0, 80) || 'pv';
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