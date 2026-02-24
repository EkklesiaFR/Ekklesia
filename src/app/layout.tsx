
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthStatusProvider } from '@/components/auth/AuthStatusProvider';

export const metadata: Metadata = {
  title: 'Ekklesia Vote',
  description: 'Une plateforme de vote institutionnelle pour l\'Assemblée Ekklesia.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300..900;1,300..900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased selection:bg-primary/20">
        <FirebaseClientProvider>
          <AuthStatusProvider>
            {children}
            <Toaster />
          </AuthStatusProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
