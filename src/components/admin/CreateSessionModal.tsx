'use client';

import { useState } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { 
  collection, 
  doc, 
  runTransaction, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Loader2, Calendar } from 'lucide-react';
import { Project } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { DEFAULT_ASSEMBLY_ID } from '@/config/assembly';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableProjects: Project[];
}

export function CreateSessionModal({ isOpen, onClose, availableProjects }: CreateSessionModalProps) {
  const { user } = useUser();
  const db = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const handleToggleProject = (id: string) => {
    setSelectedProjectIds(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title || selectedProjectIds.length < 2) {
      toast({ variant: "destructive", title: "Incomplet", description: "Veuillez choisir un titre et au moins 2 projets." });
      return;
    }

    setIsSubmitting(true);
    try {
      /**
       * HANDLER : Créer une session
       * - Chemin : /assemblies/{DEFAULT_ASSEMBLY_ID}
       * - Chemin : /assemblies/{DEFAULT_ASSEMBLY_ID}/votes/{voteId}
       * - Transaction atomique pour garantir l'intégrité du pointeur activeVoteId
       */
      await runTransaction(db, async (transaction) => {
        const assemblyRef = doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID);
        const voteRef = doc(collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes'));
        
        const now = serverTimestamp();

        // 1. Mise à jour du document parent (Assembly)
        transaction.update(assemblyRef, {
          title: title,
          state: 'open',
          activeVoteId: voteRef.id,
          updatedAt: now
        });

        // 2. Création du document de vote fils
        transaction.set(voteRef, {
          id: voteRef.id,
          assemblyId: DEFAULT_ASSEMBLY_ID,
          question: `Vote préférentiel : ${title}`,
          projectIds: selectedProjectIds,
          state: 'open',
          createdAt: now,
          updatedAt: now,
          ballotCount: 0,
          eligibleCount: 0,
          createdBy: user.uid
        });
      });

      toast({ title: "Session lancée", description: "Le scrutin est désormais ouvert pour tous les membres." });
      onClose();
    } catch (e: any) {
      console.error("[ADMIN] Failed to create session:", e);
      toast({ variant: "destructive", title: "Erreur", description: `Échec du lancement : ${e.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-none p-10">
        <DialogHeader className="space-y-4">
          <DialogTitle className="text-3xl font-bold">Nouvelle Session</DialogTitle>
          <DialogDescription className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
            Configurez un nouveau scrutin pour l'assemblée par défaut.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-10 py-6">
          <div className="space-y-4">
            <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Titre de la Session</Label>
            <Input 
              placeholder="Ex: Assemblée Générale Hiver 2024" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-none h-14 text-lg font-bold"
              required
            />
          </div>

          <div className="space-y-6">
            <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Sélection des Projets Candidats ({selectedProjectIds.length})</Label>
            <div className="grid gap-3 max-h-[300px] overflow-y-auto pr-4">
              {availableProjects.map(project => (
                <div key={project.id} className="flex items-center space-x-4 p-4 border border-border bg-secondary/5 hover:bg-secondary/10 transition-colors">
                  <Checkbox 
                    id={project.id} 
                    checked={selectedProjectIds.includes(project.id)}
                    onCheckedChange={() => handleToggleProject(project.id)}
                    className="rounded-none h-5 w-5"
                  />
                  <div className="flex-1">
                    <label htmlFor={project.id} className="text-sm font-bold cursor-pointer block">{project.title}</label>
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">{project.budget}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="pt-8 gap-4">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-none h-14 px-8 uppercase font-bold text-xs">
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || selectedProjectIds.length < 2}
              className="rounded-none h-14 px-10 uppercase font-bold text-xs gap-2"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
              Lancer le scrutin
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
