/// <reference types="node" />

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

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
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
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
    Number(voteData?.results?.total ??
      voteData?.results?.totalBallots ??
      voteData?.ballotsCount ??
      0) || 0;

  const eligible = Number(voteData?.eligibleCountAtOpen ?? voteData?.eligibleCount ?? 0) || 0;
  const participationPct = eligible > 0 ? Math.round((100 * totalBallots) / eligible) : null;

  const fullRanking = Array.isArray(voteData?.results?.fullRanking)
    ? voteData.results.fullRanking
    : [];

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

function loadFileBuffer(relPathFromRepoRoot: string): Buffer {
  const abs = path.join(process.cwd(), relPathFromRepoRoot);
  return fs.readFileSync(abs);
}

export async function GET(
  _req: Request,
  context: { params: RouteParams | Promise<RouteParams> }
) {
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

    const [{ default: PDFDocument }, qrcodeMod] = await Promise.all([
      import('pdfkit'),
      import('qrcode'),
    ]);

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

    const qrBuffer: Buffer = await QRCode.toBuffer(verifyUrl, {
      type: 'png',
      margin: 1,
      scale: 5,
    });

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, left: 56, right: 56, bottom: 56 },
      info: { Title: `PV - ${pv.title}`, Author: 'Ekklesia', Subject: 'Procès-verbal scellé' },
    });

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

    doc.registerFont('Figtree', figtreeRegular);
    doc.registerFont('FigtreeBold', figtreeBold);

    doc.font('Figtree').fontSize(22).text(pv.title);
    doc.moveDown();

    doc.fontSize(11);
    doc.text(`Vote ID : ${voteId}`);
    doc.text(`Assemblée : ${assemblyId}`);
    doc.text(`État : ${pv.state}`);
    doc.text(`Bulletins : ${pv.totalBallots}`);
    if (pv.eligible != null) doc.text(`Éligibles : ${pv.eligible}`);
    doc.text(`Participation : ${pv.participationPct ?? '—'}%`);
    doc.moveDown();

    doc.text(`Vainqueur : ${pv.winnerId}`);
    doc.moveDown();

    doc.fontSize(9).fillColor('#666');
    doc.text(`Seal : ${finalSeal}`);
    doc.moveDown();

    doc.image(qrBuffer, { width: 120 });

    const pdfBuffer = await bufferFromStream(doc);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PV_${voteId}.pdf"`,
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