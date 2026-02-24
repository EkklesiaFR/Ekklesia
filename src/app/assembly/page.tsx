'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import Link from 'next/link';
import { 
  Vote, 
  LayoutGrid, 
  User, 
  Settings, 
  ArrowRight,
  ChevronRight
} from 'lucide-react';

export default function AssemblyDashboard() {
  const { isAdmin } = useAuthStatus();

  const menuItems = [
    {
      title: "Voter",
      description: "Exprimez vos préférences pour la session en cours.",
      href: "/vote",
      icon: Vote,
      color: "bg-primary/10 text-primary"
    },
    {
      title: "Projets",
      description: "Consultez le détail des propositions soumises.",
      href: "/projects",
      icon: LayoutGrid,
      color: "bg-blue-50 text-blue-600"
    },
    {
      title: "Mon Compte",
      description: "Gérez vos informations et votre statut de membre.",
      href: "/account",
      icon: User,
      color: "bg-gray-100 text-gray-600"
    }
  ];

  return (
    <RequireActiveMember>
      <MainLayout statusText="Dashboard Assemblée">
        <div className="space-y-12 animate-in fade-in duration-700">
          <header className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Espace Membre</h1>
            <p className="text-xl text-muted-foreground">Bienvenue dans votre interface de participation.</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href} className="group">
                <div className="h-full border border-border p-8 bg-white hover:border-black transition-all flex flex-col justify-between space-y-8">
                  <div className="space-y-6">
                    <div className={`w-12 h-12 ${item.color} flex items-center justify-center`}>
                      <item.icon className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold">{item.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest group-hover:gap-4 transition-all">
                    Y accéder <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            ))}

            {isAdmin && (
              <Link href="/admin" className="group md:col-span-2">
                <div className="border border-dashed border-primary p-8 bg-primary/5 hover:bg-primary/10 transition-all flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-primary text-white flex items-center justify-center">
                      <Settings className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Administration</h3>
                      <p className="text-sm text-muted-foreground">Gérer les sessions, les membres et les émargements.</p>
                    </div>
                  </div>
                  <Button variant="ghost" className="rounded-none font-bold uppercase tracking-widest text-xs">
                    Gérer <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </Link>
            )}
          </div>
        </div>
      </MainLayout>
    </RequireActiveMember>
  );
}
