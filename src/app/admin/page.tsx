
"use client";

import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Settings, Plus, Users, BarChart3, Mail, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';

export default function AdminDashboard() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) {
      toast({
        title: "Accès restreint",
        description: "Vous devez être connecté pour accéder à l'administration.",
      });
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const handleDryRun = () => {
    alert("Simulation de dépouillement : Le projet 'Rénovation du Parvis Central' est en tête avec 52% des scores Schulze.");
  };

  if (isUserLoading || !user) {
    return (
      <MainLayout role="admin" statusText="Administration">
        <div className="flex items-center justify-center py-24">
          <p className="text-sm uppercase tracking-widest text-muted-foreground animate-pulse">
            Vérification des droits...
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout role="admin" statusText="Administration">
      <div className="space-y-12">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold">Gestion des Sessions</h1>
          <Button className="bg-black hover:bg-black/90 text-white rounded-none flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle Session
          </Button>
        </div>

        <Tabs defaultValue="sessions" className="w-full">
          <TabsList className="w-full justify-start rounded-none bg-transparent border-b border-border h-auto p-0 gap-8">
            <TabsTrigger value="sessions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-4 text-sm font-bold uppercase tracking-widest">Sessions</TabsTrigger>
            <TabsTrigger value="allowlist" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-4 text-sm font-bold uppercase tracking-widest">Liste d'autorisés</TabsTrigger>
            <TabsTrigger value="results" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-4 text-sm font-bold uppercase tracking-widest">Archives</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="py-8 space-y-8">
            <div className="grid gap-6">
              <Card className="rounded-none border-border shadow-none">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Session de Printemps 2024</CardTitle>
                    <CardDescription>Du 15 Mars au 15 Avril • 3 projets soumis</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="rounded-none border-border flex items-center gap-2" onClick={handleDryRun}>
                      <BarChart3 className="h-3.5 w-3.5" />
                      Aperçu (Dry Run)
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-none border-border flex items-center gap-2">
                      <Download className="h-3.5 w-3.5" />
                      Export JSON
                    </Button>
                    <Button size="sm" className="bg-primary hover:bg-primary/90 rounded-none">Éditer</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-8 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" />
                      142 Participants
                    </span>
                    <span className="flex items-center gap-2">
                      <Settings className="h-3.5 w-3.5" />
                      Statut: En cours
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="allowlist" className="py-8 space-y-8">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Seuls les membres figurant sur cette liste peuvent participer au vote.</p>
              <Button size="sm" variant="outline" className="rounded-none flex items-center gap-2">
                <Plus className="h-3.5 w-3.5" />
                Ajouter un e-mail
              </Button>
            </div>
            
            <div className="border border-border divide-y divide-border bg-white">
              {['admin@ekklesia.org', 'president@ekklesia.org', 'membre1@ekklesia.org', 'membre2@ekklesia.org'].map((email, i) => (
                <div key={i} className="p-4 flex items-center justify-between group hover:bg-secondary/50">
                  <span className="text-sm font-medium">{email}</span>
                  <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10">Retirer</Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="results" className="py-8">
            <p className="text-center py-12 text-muted-foreground italic">Aucune session archivée pour le moment.</p>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
