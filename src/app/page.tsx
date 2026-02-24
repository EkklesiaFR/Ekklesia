
"use client";

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { VotingSession, Project } from '@/types';
import Image from 'next/image';
import { ProjectDetailModal } from '@/components/voting/ProjectDetailModal';

// Mock current session with detailed fields
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
        { label: 'Partenariat Énergie Verte', url: '#' }
      ]
    }
  ]
};

export default function Home() {
  const [session, setSession] = useState<VotingSession | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    setSession(MOCK_SESSION);
    
    const timer = setInterval(() => {
      if (!MOCK_SESSION) return;
      const now = new Date();
      const diff = MOCK_SESSION.votingClosesAt.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft('Vote clos');
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      
      setTimeLeft(`${days}j ${hours}h ${minutes}m`);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getStatusText = (s: VotingSession) => {
    const now = new Date();
    if (s.isResultsPublished) return "Résultats publiés";
    if (now < s.votingOpensAt) return "Vote à venir";
    if (now > s.votingClosesAt) return "Vote clos";
    return "Vote ouvert";
  };

  if (!session) return null;

  return (
    <MainLayout role="member" statusText={getStatusText(session)}>
      <div className="space-y-24 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Hero Section */}
        <section className="space-y-8">
          <div className="space-y-4">
            <span className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground block">
              Assemblée en cours
            </span>
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight text-balance">
              1 voix. 1 communauté.<br />
              Des milliers de projets financer.
            </h1>
          </div>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl font-medium">
            Votre participation façonne l'avenir de notre communauté. Prenez le temps d'étudier les projets soumis et exprimez vos préférences par un vote ordonné.
          </p>
        </section>

        {/* Typographic Counters */}
        <section className="border-y border-border py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-12">
          <div className="flex flex-col md:flex-row gap-12 md:gap-16">
            <div className="space-y-1">
              <p className="text-sm uppercase tracking-widest font-bold text-muted-foreground">Participation</p>
              <p className="text-3xl font-bold">
                <span className="text-primary">142</span> bulletins déposés
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm uppercase tracking-widest font-bold text-muted-foreground">Échéance</p>
              <p className="text-3xl font-bold">
                Clôture dans <span className="text-primary">{timeLeft}</span>
              </p>
            </div>
          </div>
          
          <Link href="/vote">
            <Button size="lg" className="bg-black hover:bg-black/90 text-white rounded-none px-10 py-8 text-lg flex items-center gap-3 transition-all hover:gap-5">
              Exprimer mon choix
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </section>

        {/* Projects Section */}
        <section className="space-y-16">
          <div className="space-y-4">
            <h3 className="text-3xl font-bold tracking-tight">Projets soumis au vote</h3>
            <div className="h-1 w-20 bg-primary"></div>
          </div>
          
          <div className="grid gap-24">
            {session.projects.map((project) => (
              <div 
                key={project.id} 
                onClick={() => setSelectedProject(project)}
                className="group grid md:grid-cols-2 gap-12 items-center cursor-pointer"
              >
                <div className="relative aspect-video w-full overflow-hidden border border-border">
                  <Image 
                    src={project.imageUrl || 'https://picsum.photos/seed/ekklesia/800/400'} 
                    alt={project.title}
                    fill
                    className="object-cover grayscale hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-100"
                    data-ai-hint="civic project"
                  />
                </div>
                <div className="space-y-8">
                  <div className="space-y-4">
                    <span className="inline-block px-3 py-1 bg-secondary text-[10px] uppercase tracking-widest font-black border border-border">
                      Budget : {project.budget}
                    </span>
                    <h4 className="text-4xl font-bold tracking-tight group-hover:text-primary transition-colors">{project.title}</h4>
                  </div>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {project.summary}
                  </p>
                  <div className="space-y-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold">Infrastructures & Impact</p>
                    <ul className="grid grid-cols-1 gap-3">
                      {project.keyFeatures.map((feat, i) => (
                        <li key={i} className="text-sm flex items-center gap-3 font-medium">
                          <span className="w-4 h-[1px] bg-primary"></span>
                          {feat}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <ProjectDetailModal 
        project={selectedProject}
        isOpen={!!selectedProject}
        onClose={() => setSelectedProject(null)}
      />
    </MainLayout>
  );
}
