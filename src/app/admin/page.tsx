
'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function AdminPage() {
  return (
    <RequireActiveMember>
      <MainLayout role="admin" statusText="Administration">
        <div className="space-y-12">
          <h1 className="text-4xl font-bold">Gestion des Sessions</h1>
          
          <Tabs defaultValue="sessions" className="w-full">
            <TabsList className="w-full justify-start rounded-none bg-transparent border-b border-border h-auto p-0 gap-8">
              <TabsTrigger value="sessions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 py-4 text-sm font-bold uppercase tracking-widest">Sessions</TabsTrigger>
              <TabsTrigger value="members" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 py-4 text-sm font-bold uppercase tracking-widest">Membres</TabsTrigger>
            </TabsList>
            
            <TabsContent value="sessions" className="py-8">
              <p className="text-muted-foreground italic">Liste des sessions à venir.</p>
            </TabsContent>
            
            <TabsContent value="members" className="py-8">
              <p className="text-muted-foreground italic">Gestion des accès membres.</p>
            </TabsContent>
          </Tabs>
        </div>
      </MainLayout>
    </RequireActiveMember>
  );
}
