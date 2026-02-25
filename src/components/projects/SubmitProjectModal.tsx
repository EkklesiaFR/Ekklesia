
'use client';

import { useState } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { PlusCircle, Loader2, Sparkles } from 'lucide-react';
import { generateProjectSummary } from '@/ai/flows/generate-project-summary';

interface SubmitProjectModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubmitProjectModal({ isOpen, onOpenChange }: SubmitProjectModalProps) {
  const { user } = useUser();
  const db = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    description: '',
    budget: '',
    imageUrl: ''
  });

  const handleAiEnhance = async () => {
    if (!formData.title || !formData.budget) {
      toast({ 
        title: "Informations insuffisantes", 
        description: "Veuillez saisir au moins un titre et un budget pour que l'IA puisse travailler.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateProjectSummary({
        title: formData.title,
        budget: formData.budget,
        keyFeatures: [formData.summary || "Nouveau projet citoyen"],
        description: formData.description
      });

      if (result && result.summary) {
        setFormData(prev => ({ ...prev, summary: result.summary }));
        toast({ title: "Résumé optimisé", description: "L'IA a généré un résumé percutant pour votre projet." });
      }
    } catch (error) {
      console.error("AI Error:", error);
      toast({ title: "Erreur IA", description: "Impossible de générer le résumé pour le moment.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.title || !formData.summary || !formData.budget) {
      toast({ 
        variant: "destructive", 
        title: "Champs requis", 
        description: "Veuillez remplir au moins le titre, le résumé et le budget." 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'projects'), {
        title: formData.title,
        summary: formData.summary,
        longDescription: formData.description,
        budget: formData.budget,
        imageUrl: formData.imageUrl || null,
        status: 'submitted',
        ownerUid: user.uid,
        ownerEmail: user.email,
        ownerName: user.displayName || user.email?.split('@')[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast({ title: "Projet déposé", description: "Votre proposition a été transmise pour revue." });
      setFormData({ title: '', summary: '', description: '', budget: '', imageUrl: '' });
      onOpenChange(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer le projet." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-none p-8">
        <DialogHeader className="space-y-4">
          <DialogTitle className="text-2xl font-bold uppercase tracking-tight">Déposer un Projet</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground uppercase tracking-widest font-medium">
            Contribuez à l'avenir de l'assemblée.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-8 py-6">
          <div className="space-y-4">
            <Label htmlFor="title" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Titre du Projet</Label>
            <Input 
              id="title" 
              placeholder="Ex: Aménagement d'un jardin partagé" 
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="rounded-none h-12"
              required
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="summary" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Résumé court (2-3 lignes)</Label>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={handleAiEnhance}
                disabled={isGenerating || !formData.title}
                className="h-8 text-[9px] uppercase font-bold tracking-wider gap-2 text-primary hover:text-primary hover:bg-primary/10"
              >
                {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Optimiser avec l'IA
              </Button>
            </div>
            <Textarea 
              id="summary" 
              placeholder="Décrivez brièvement l'impact du projet. Utilisez l'IA pour vous aider !" 
              value={formData.summary}
              onChange={(e) => setFormData({...formData, summary: e.target.value})}
              className="rounded-none min-h-[80px]"
              required
            />
          </div>

          <div className="space-y-4">
            <Label htmlFor="description" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Description complète</Label>
            <Textarea 
              id="description" 
              placeholder="Détaillez les objectifs, les étapes et les bénéfices..." 
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="rounded-none min-h-[150px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <Label htmlFor="budget" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Budget estimé</Label>
              <Input 
                id="budget" 
                placeholder="Ex: 15 000 €" 
                value={formData.budget}
                onChange={(e) => setFormData({...formData, budget: e.target.value})}
                className="rounded-none h-12"
                required
              />
            </div>
            <div className="space-y-4">
              <Label htmlFor="imageUrl" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">URL Image (Optionnel)</Label>
              <Input 
                id="imageUrl" 
                placeholder="https://..." 
                value={formData.imageUrl}
                onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                className="rounded-none h-12"
              />
            </div>
          </div>

          <DialogFooter className="pt-8">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              className="rounded-none h-14 px-8 uppercase font-bold text-xs"
            >
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="rounded-none h-14 px-10 uppercase font-bold text-xs gap-2"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              Soumettre le projet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
