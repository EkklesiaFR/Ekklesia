'use client';

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ShieldAlert } from 'lucide-react';

import { useFirestore } from '@/firebase';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { MainLayout } from '@/components/layout/MainLayout';
import { toast } from '@/hooks/use-toast';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

type MemberRowData = {
  id: string; // doc id = uid
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  role?: 'member' | 'admin';
  status?: 'pending' | 'active' | 'disabled';
  createdAt?: any;
  lastLoginAt?: any;
};

function fmtTs(v: any): string {
  if (!v) return '—';
  try {
    if (v instanceof Timestamp) return v.toDate().toLocaleString();
    if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000).toLocaleString();
    return String(v);
  } catch {
    return '—';
  }
}

function MemberRow({ member }: { member: MemberRowData }) {
  const db = useFirestore();
  const [role, setRole] = useState<MemberRowData['role']>(member.role ?? 'member');
  const [status, setStatus] = useState<MemberRowData['status']>(member.status ?? 'pending');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRole(member.role ?? 'member');
    setStatus(member.status ?? 'pending');
  }, [member.id, member.role, member.status]);

  const isDirty = role !== (member.role ?? 'member') || status !== (member.status ?? 'pending');

  async function onSave() {
    setSaving(true);
    try {
      console.log('[ADMIN] members:update start', { uid: member.id, role, status });
      await updateDoc(doc(db, 'members', member.id), {
        role,
        status,
        updatedAt: serverTimestamp(),
      });
      console.log('[ADMIN] members:update success', { uid: member.id });
      toast({ title: '✅ Membre mis à jour' });
    } catch (e: any) {
      console.error('[ADMIN] members:update error', { uid: member.id, code: e?.code, message: e?.message });
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: `${e?.code ?? ''} ${e?.message ?? ''}`.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{member.email ?? '—'}</TableCell>
      <TableCell>{member.displayName ?? '—'}</TableCell>

      <TableCell>
        <Select value={role} onValueChange={(v) => setRole(v as any)} disabled={saving}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">member</SelectItem>
            <SelectItem value="admin">admin</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>

      <TableCell>
        <Select value={status} onValueChange={(v) => setStatus(v as any)} disabled={saving}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">pending</SelectItem>
            <SelectItem value="active">active</SelectItem>
            <SelectItem value="disabled">disabled</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>

      <TableCell className="text-xs text-muted-foreground">{fmtTs(member.createdAt)}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{fmtTs(member.lastLoginAt)}</TableCell>

      <TableCell>
        <Button size="sm" onClick={onSave} disabled={saving || !isDirty}>
          {saving ? 'Saving…' : 'Enregistrer'}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function AdminMembersPage() {
  const db = useFirestore();
  const { isMemberLoading, isAdmin, isActiveMember } = useAuthStatus();

  const [members, setMembers] = useState<MemberRowData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isMemberLoading) return;

    if (!isAdmin || !isActiveMember) {
      setLoading(false);
      return;
    }

    console.log('[ADMIN] members:list subscribe');
    const q = query(collection(db, 'members'), orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        console.log('[ADMIN] members:list snapshot', { count: snap.docs.length });
        setMembers(snap.docs.map((d) => ({ ...(d.data() as any), id: d.id })));
        setLoading(false);
      },
      (err) => {
        console.error('[ADMIN] members:list error', { code: err.code, message: err.message });
        toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de charger les membres.' });
        setLoading(false);
      }
    );

    return () => {
      console.log('[ADMIN] members:list unsubscribe');
      unsub();
    };
  }, [db, isMemberLoading, isAdmin, isActiveMember]);

  return (
    <RequirePageFrame>
      {loading || isMemberLoading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-6">
          <div className="w-12 h-12 border-t-2 border-primary animate-spin rounded-full" />
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Vérification de l'accès…</p>
        </div>
      ) : !isAdmin || !isActiveMember ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-8 text-center animate-in fade-in duration-700">
          <ShieldAlert className="h-16 w-16 text-destructive" />
          <header className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">Accès réservé</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Seuls les administrateurs avec un statut actif peuvent accéder à cette page.
            </p>
          </header>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-700">
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground block">Console</span>
            <h1 className="text-4xl font-bold">Gestion des membres</h1>
          </div>

          <div className="bg-white border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Créé</TableHead>
                  <TableHead>Dernier login</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <MemberRow key={m.id} member={m} />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </RequirePageFrame>
  );
}

// Wrap with your layout. Keep it minimal and stable.
function RequirePageFrame({ children }: { children: React.ReactNode }) {
  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 py-10">{children}</div>
    </MainLayout>
  );
}