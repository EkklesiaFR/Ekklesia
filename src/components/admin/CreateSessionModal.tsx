'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, serverTimestamp, addDoc, Timestamp } from 'firebase/firestore';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';

import { Calendar, CalendarClock, Loader2 } from 'lucide-react';
import type { Project } from '@/types';
import { DEFAULT_ASSEMBLY_ID } from '@/config/assembly';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableProjects: Project[];
}

type CloseMode = 'manual' | 'scheduled';

const QUORUM_PRESETS = [0, 50, 60, 66, 75];

function clampPct(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function CreateSessionModal({ isOpen, onClose, availableProjects }: CreateSessionModalProps) {
  const { user } = useUser();
  const db = useFirestore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [closeMode, setCloseMode] = useState<CloseMode>('manual');

  // datetime-local => string "YYYY-MM-DDTHH:mm"
  const [closesAtLocal, setClosesAtLocal] = useState<string>('');

  // ✅ Quorum (%)
  const [quorumPct, setQuorumPct] = useState<number>(60);

  // Reset propre à l’ouverture/fermeture
  useEffect(() => {
    if (!isOpen) return;
    setIsSubmitting(false);
    setTitle('');
    setSelectedProjectIds([]);
    setCloseMode('manual');
    setClosesAtLocal('');
    setQuorumPct(60);
  }, [isOpen]);

  const trimmedTitle = useMemo(() => title.trim(), [title]);

  const handleToggleProject = (id: string) => {
    setSelectedProjectIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const parseClosesAt = (): Timestamp | null => {
    if (closeMode !== 'scheduled') return null;
    if (!closesAtLocal) return null;

    const d = new Date(closesAtLocal);
    if (Number.isNaN(d.getTime())) return null;

    return Timestamp.fromDate(d);
  };

  const canSubmit = useMemo(() => {
    if (!user) return false;
    if (trimmedTitle.length < 6) return false;
    if (selectedProjectIds.length < 2) return false;

    const qp = clampPct(quorumPct);
    if (qp < 0 || qp > 100) return false;

    if (closeMode === 'scheduled') {
      const ts = parseClosesAt();
      if (!ts) return false;
      if (ts.toMillis() <= Date.now()) return false;
    }
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, trimmedTitle, selectedProjectIds, closeMode, closesAtLocal, quorumPct]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({ variant: 'destructive', title: 'Erreur', description: "Vous n'êtes pas connecté." });
      return;
    }

    if (trimmedTitle.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Titre trop court',
        description: 'Veuillez saisir un titre (min. 6 caractères).',
      });
      return;
    }

    if (selectedProjectIds.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Incomplet',
        description: 'Veuillez sélectionner au moins 2 projets.',
      });
      return;
    }

    const qp = clampPct(quorumPct);

    const closesAt = parseClosesAt();
    if (closeMode === 'scheduled' && !closesAt) {
      toast({
        variant: 'destructive',
        title: 'Clôture invalide',
        description: 'Veuillez choisir une date/heure de clôture valide.',
      });
      return;
    }
    if (closeMode === 'scheduled' && closesAt && closesAt.toMillis() <= Date.now()) {
      toast({
        variant: 'destructive',
        title: 'Clôture invalide',
        description: 'La clôture doit être dans le futur.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const voteCol = collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes');

      await addDoc(voteCol, {
        assemblyId: DEFAULT_ASSEMBLY_ID,
        question: trimmedTitle,
        projectIds: selectedProjectIds,
        state: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,

        closesAt: closeMode === 'scheduled' ? closesAt : null,

        quorumPct: qp,
      });

      toast({
        title: 'Session créée',
        description: "Le scrutin est en brouillon. Ouvrez-le depuis la console admin.",
      });

      onClose();
    } catch (err: any) {
      console.error('[ADMIN] Create vote failed:', err?.code, err?.message);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Échec de la création du brouillon.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* ✅ p-0 + flex-col + max-h + overflow hidden */}
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl rounded-none p-0 overflow-hidden">
        <div className="flex max-h-[85vh] flex-col">
          {/* HEADER fixe */}
          <div className="px-6 sm:px-10 pt-8 pb-6 border-b bg-white">
            <DialogHeader className="space-y-4">
              <DialogTitle className="text-3xl font-bold">Nouvelle Session</DialogTitle>
              <DialogDescription className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
                Configurez un nouveau scrutin pour l&apos;assemblée.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* ✅ FORM = zone scrollable */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 sm:px-10 py-8 space-y-10">
            {/* Titre */}
            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                Titre du scrutin
              </Label>
              <Input
                placeholder="Ex: Assemblée Hiver 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-none h-14 text-lg font-bold"
                required
              />
              <p className="text-[10px] text-muted-foreground">Min. 6 caractères. Visible par les membres.</p>
            </div>

            {/* Quorum */}
            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                Quorum (%)
              </Label>

              <div className="flex flex-wrap gap-2">
                {QUORUM_PRESETS.map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant={quorumPct === p ? 'default' : 'outline'}
                    onClick={() => setQuorumPct(p)}
                    className="rounded-none h-10 px-4 uppercase font-bold text-[10px]"
                  >
                    {p}%
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                    Valeur personnalisée
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={quorumPct}
                    onChange={(e) => setQuorumPct(clampPct(Number(e.target.value)))}
                    className="rounded-none h-14 font-bold"
                  />
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Suggestion Ekklesia : <span className="font-bold">60%</span> (au-delà de 40% d’abstention, scrutin
                  invalide).
                </p>
              </div>
            </div>

            {/* Clôture */}
            <div className="space-y-6">
              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Clôture</Label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCloseMode('manual')}
                  className={[
                    'border p-4 rounded-none text-left transition-all',
                    closeMode === 'manual' ? 'bg-primary/10 border-primary' : 'bg-white border-border hover:border-black',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <p className="text-xs uppercase tracking-widest font-bold">Clôture manuelle</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">Un admin clôture et publie les résultats.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setCloseMode('scheduled')}
                  className={[
                    'border p-4 rounded-none text-left transition-all',
                    closeMode === 'scheduled'
                      ? 'bg-primary/10 border-primary'
                      : 'bg-white border-border hover:border-black',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" />
                    <p className="text-xs uppercase tracking-widest font-bold">Clôture programmée</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Affiche un compte à rebours, sans automatiser la clôture.
                  </p>
                </button>
              </div>

              {closeMode === 'scheduled' && (
                <div className="space-y-3">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                    Date & heure de clôture
                  </Label>
                  <Input
                    type="datetime-local"
                    value={closesAtLocal}
                    onChange={(e) => setClosesAtLocal(e.target.value)}
                    className="rounded-none h-14 font-bold"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    La clôture reste manuelle côté système (pour l’instant). Cette date sert à l’affichage.
                  </p>
                </div>
              )}
            </div>

            {/* Projets */}
            <div className="space-y-6">
              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                Projets sélectionnés ({selectedProjectIds.length})
              </Label>

              <div className="grid gap-3 max-h-[300px] overflow-y-auto pr-2">
                {availableProjects.map((project) => (
                  <div
                    key={project.id}
                    className={[
                      'flex items-center space-x-4 p-4 border',
                      selectedProjectIds.includes(project.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-secondary/5',
                    ].join(' ')}
                  >
                    <Checkbox
                      id={project.id}
                      checked={selectedProjectIds.includes(project.id)}
                      onCheckedChange={() => handleToggleProject(project.id)}
                    />
                    <div className="flex-1">
                      <label htmlFor={project.id} className="text-sm font-bold cursor-pointer">
                        {project.title}
                      </label>
                      <p className="text-[10px] text-muted-foreground">{project.budget}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-muted-foreground">Minimum : 2 projets.</p>
            </div>

            {/* Spacer pour éviter que le dernier champ soit collé au footer sticky */}
            <div className="h-6" />
          </form>

          {/* ✅ FOOTER sticky en bas (ne flotte plus au milieu) */}
          <div className="sticky bottom-0 border-t bg-white px-6 sm:px-10 py-6">
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="rounded-none h-14 px-8 uppercase font-bold text-xs"
              >
                Annuler
              </Button>

              <Button
                type="submit"
                form=""
                onClick={() => {
                  // rien ici: le submit se fait via le form (bouton type=submit dans le form),
                  // mais on garde le bouton ici et on déclenche manuellement:
                  const el = document.querySelector<HTMLFormElement>('form');
                  el?.requestSubmit();
                }}
                disabled={isSubmitting || !canSubmit}
                className="rounded-none h-14 px-10 uppercase font-bold text-xs gap-2"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                Créer brouillon
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}