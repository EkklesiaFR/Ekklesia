'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/firebase';
import { initiatePasswordReset } from '@/firebase/non-blocking-login';
import { useState } from 'react';
import { Mail, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    try {
      await initiatePasswordReset(auth, email);
      toast({ 
        title: "Email envoyé", 
        description: "Vérifiez votre boîte mail pour réinitialiser votre mot de passe.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible d'envoyer l'email.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout statusText="Réinitialisation">
      <div className="flex flex-col items-center justify-center py-12 space-y-10 animate-in fade-in duration-700">
        <header className="space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-black">Mot de passe oublié</h1>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Saisissez votre email pour recevoir un lien de réinitialisation.
          </p>
        </header>

        <div className="w-full max-w-sm space-y-8">
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="nom@exemple.com" 
                  className="pl-10 rounded-none h-12" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-none font-bold uppercase tracking-widest text-xs"
            >
              {isLoading ? "Envoi..." : "Envoyer le lien"}
            </Button>
          </form>

          <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-black font-bold uppercase tracking-widest text-xs">
            <ArrowLeft className="h-4 w-4" />
            Retour à la connexion
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
