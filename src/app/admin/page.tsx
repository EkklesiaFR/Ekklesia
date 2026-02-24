
'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Users, BarChart3, Download, Settings } from 'lucide-react';

export default function AdminDashboard() {
  const handleDryRun = () => {
    alert("Simulation de dépouillement en cours...");
  };

  return (
    <RequireActiveMember>
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
              <TabsTrigger value="allowlist" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-4 text-sm font-bold uppercase tracking-widest">Membres</TabsTrigger>
              <TabsTrigger value="results" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-4 text-sm font-bold uppercase tracking-widest">Archives</TabsTrigger>
            </TabsList>

            <TabsContent value="sessions" className="py-8 space-y-8">
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
                      Export
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
            </TabsContent>

            <TabsContent value="allowlist" className="py-8 space-y-8">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Gestion des accès membres.</p>
                <Button size="sm" variant="outline" className="rounded-none flex items-center gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter un e-mail
                </Button>
              </div>
              <div className="border border-border divide-y divide-border bg-white">
                {['admin@ekklesia.org', 'president@ekklesia.org'].map((email, i) => (
                  <div key={i} className="p-4 flex items-center justify-between group hover:bg-secondary/50">
                    <span className="text-sm font-medium">{email}</span>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10">Retirer</Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="results" className="py-8">
              <p className="text-center py-12 text-muted-foreground italic">Aucune session archivée.</p>
            </TabsContent>
          </Tabs>
        </div>
      </MainLayout>
    </RequireActiveMember>
  );
}
