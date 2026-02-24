
"use client";

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Project, VotingSession } from '@/types';
import Image from 'next/image';
import { ProjectDetailModal } from '@/components/voting/ProjectDetailModal';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';

// Mock current session data consistent with the platform
const MOCK_SESSION: VotingSession = {
  id: 'session-2024-03',
  title: 'Session de Printemps 2024',
  announcementAt: new Date(Date.now() - 86400000),
  votingOpensAt: new Date(Date.now() - 3600000),
  votingClosesAt: new Date(Date.now() + 172800000),
  isResultsPublished: false,
  status: 'open',
  projects: [
    {
      id: 'p1',
      title: 'Rénovation du Parvis Central',
      summary: 'Une proposition pour revitaliser l’espace public devant l’hôtel de ville avec des pavés drainants et du mobilier urbain durable.',
      longDescription: `Ce projet ambitieux vise à transformer le cœur battant de notre commune. Actuellement dominé par l'asphalte et manquant de zones d'ombre, le parvis central doit redevenir un lieu de rencontre intergénérationnel.\n\nLa proposition s'articule autour de trois axes majeurs : l'utilisation de matériaux à haut pouvoir drainant pour limiter les îlots de chaleur, l'implantation d'essences végétales locales adaptées au changement climatique, et l'installation d'un mobilier urbain ergonomique favorisant la convivialité. Une attention particulière sera portée à l'éclairage nocturne, conçu pour être à la fois sécurisant et respectueux de la biodiversité nocturne.`,
      budget: '45 000 €',
      keyFeatures: ['Pavés écologiques', 'Nouveau mobilier', 'Accessibilité PMR'],
      imageUrl: 'https://picsum.photos/seed/urban/1200/600',
      ownerName: 'Comité du Centre-Ville',
      ownerBio: 'Collectif d\'habitants et commerçants engagés pour l\'embellissement des espaces publics.',
      links: [
        { label: 'Dossier technique complet', url: '#' },
        { label: 'Étude d\'impact environnemental', url: '#' }
      ]
    },
    {
      id: 'p2',
      title: 'Réseau de Bornes Électriques',
      summary: 'Installation de 12 points de recharge ultra-rapides pour véhicules électriques répartis sur l’ensemble du territoire communal.',
      longDescription: `Pour accompagner la transition vers une mobilité décarbonée, il est impératif que notre infrastructure de recharge soit à la hauteur des enjeux actuels. Ce projet prévoit le déploiement stratégique de 12 bornes ultra-rapides (jusqu'à 150 kW).\n\nLes emplacements ont été choisis pour leur accessibilité et leur proximité avec les centres d'intérêt locaux (commerces, parcs, services publics). L'énergie utilisée proviendra exclusivement de sources renouvelables locales, garantissant un cycle vertueux. Le système de paiement sera universel et simplifié pour permettre une utilisation fluide par tous les usagers, résidents comme visiteurs.`,
      budget: '60 000 €',
      keyFeatures: ['Charge rapide', 'Application mobile', 'Énergie 100% verte'],
      imageUrl: 'https://picsum.photos/seed/energy/1200/600',
      ownerName: 'Groupe Mobilité Durable',
      ownerBio: 'Association de promotion des énergies propres et des nouveaux modes de transport.',
      links: [
        { label: 'Carte des implantations prévues', url: '#' },
        { label: 'Partenariat Énergie Verde', url: '#' }
      ]
    }
  ]
};

export default function ProjectsPage() {
  const [session, setSession] = useState<VotingSession | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    // In a real app, we would fetch the active session from Firestore
    setSession(MOCK_SESSION);
  }, []);

  const getStatusText = (s: VotingSession) => {
    const now = new Date();
    if (s.isResultsPublished || s.status === 'published') return "Résultats publiés";
    if (now < s.votingOpensAt) return "Vote à venir";
    if (now > s.votingClosesAt) return "Vote clos";
    return "Vote ouvert";
  };

  if (!session) return (
    <MainLayout statusText="Chargement...">
      <div className="py-24 text-center">
        <p className="text-sm uppercase tracking-widest text-muted-foreground animate-pulse">Chargement des projets...</p>
      </div>
    </MainLayout>
  );

  return (
    <MainLayout statusText={getStatusText(session)}>
      <div className="space-y-16 animate-in fade-in duration-700">
        <header className="space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Projets de l'Assemblée</h1>
          <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Consultez les propositions soumises au vote pour la session de {session.title}.
          </p>
        </header>

        <div className="grid gap-12">
          {session.projects.map((project) => (
            <div 
              key={project.id} 
              onClick={() => setSelectedProject(project)}
              className="group border border-border bg-white p-8 md:p-12 hover:border-[#7DC092]/30 transition-all cursor-pointer space-y-8"
            >
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="relative aspect-video w-full md:w-80 overflow-hidden border border-border flex-shrink-0">
                  <Image 
                    src={project.imageUrl || 'https://picsum.photos/seed/ekklesia/800/400'} 
                    alt={project.title}
                    fill
                    className="object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                    data-ai-hint="civic project"
                  />
                </div>
                
                <div className="space-y-6 flex-grow">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <span className="inline-block px-2 py-1 bg-secondary text-[10px] uppercase tracking-widest font-black border border-border">
                        {project.budget}
                      </span>
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight group-hover:text-[#7DC092] transition-colors">
                      {project.title}
                    </h2>
                  </div>
                  
                  <p className="text-lg text-muted-foreground leading-relaxed line-clamp-3">
                    {project.summary}
                  </p>

                  <div className="space-y-3 pt-4 border-t border-border">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Points clés</p>
                    <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {project.keyFeatures.slice(0, 3).map((feat, i) => (
                        <li key={i} className="text-sm flex items-center gap-2 font-medium">
                          <span className="w-3 h-[1px] bg-[#7DC092]"></span>
                          {feat}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {session.projects.length === 0 && (
          <div className="py-24 border border-dashed border-border text-center">
            <p className="text-muted-foreground italic">Aucun projet n'est actuellement soumis pour cette session.</p>
          </div>
        )}
      </div>

      <ProjectDetailModal 
        project={selectedProject}
        isOpen={!!selectedProject}
        onClose={() => setSelectedProject(null)}
      />
    </MainLayout>
  );
}
