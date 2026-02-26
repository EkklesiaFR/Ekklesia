'use client';

import { useState } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { 
  collection, 
  doc, 
  serverTimestamp,
  addDoc
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
      const voteRef = collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes');
      
      await addDoc(voteRef, {
        assemblyId: DEFAULT_ASSEMBLY_ID,
        question: title,
        projectIds: selectedProjectIds,
        state: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ballotCount: 0,
        eligibleCount: 0,
        createdBy: user.uid
      });

      toast({ title: "Session créée", description: "Le scrutin est en brouillon. Ouvrez-le depuis la console admin." });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: "Échec de la création." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-none p-10">
        <DialogHeader className="space-y-4">
          <DialogTitle className="text-3xl font-bold">Nouvelle Session</DialogTitle>
          <DialogDescription className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
            Configurez un nouveau scrutin pour l'assemblée.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-10 py-6">
          <div className="space-y-4">
            <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Titre de la Session</Label>
            <Input 
              placeholder="Ex: Assemblée Hiver 2024" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-none h-14 text-lg font-bold"
              required
            />
          </div>

          <div className="space-y-6">
            <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Projets Sélectionnés ({selectedProjectIds.length})</Label>
            <div className="grid gap-3 max-h-[300px] overflow-y-auto pr-4">
              {availableProjects.map(project => (
                <div key={project.id} className="flex items-center space-x-4 p-4 border border-border bg-secondary/5">
                  <Checkbox 
                    id={project.id} 
                    checked={selectedProjectIds.includes(project.id)}
                    onCheckedChange={() => handleToggleProject(project.id)}
                  />
                  <div className="flex-1">
                    <label htmlFor={project.id} className="text-sm font-bold cursor-pointer">{project.title}</label>
                    <p className="text-[10px] text-muted-foreground">{project.budget}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="pt-8 gap-4">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-none h-14 px-8 uppercase font-bold text-xs">Annuler</Button>
            <Button type="submit" disabled={isSubmitting || selectedProjectIds.length < 2} className="rounded-none h-14 px-10 uppercase font-bold text-xs gap-2">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
              Créer Brouillon
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}