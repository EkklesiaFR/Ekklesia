'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { GlassCard } from '@/components/ui/glass-card';
import { usePublicFinance } from '@/hooks/use-public-finance';
import { formatEuro, publicCategories } from '@/lib/finance/public';

export default function CommunityFundPage() {
  const { data, error, isLoading } = usePublicFinance();
  return (
    <MainLayout statusText="Cagnotte commune">
      <div className="space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">Cagnotte commune</h1>
          <p className="text-muted-foreground">Les comptes et le registre financier de la communauté.</p>
        </header>
        {error || data?.status === 'unavailable' ? (
          <p role="status">Les données financières sont momentanément indisponibles.</p>
        ) : isLoading || !data ? (
          <p role="status">Chargement de la cagnotte…</p>
        ) : (
          <>
            <dl className="grid gap-4 sm:grid-cols-2">
              {([
                ['Disponible pour les projets', data.availableMinor],
                ['Trésorerie actuelle', data.cashMinor],
                ['Engagements en cours', data.commitmentMinor],
                ['Total versé aux projets', data.totalPaidToProjectsMinor],
              ] as const).map(([label, amount]) => (
                <GlassCard key={label} className="p-5">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="mt-2 text-2xl font-bold">{formatEuro(amount)}</dd>
                </GlassCard>
              ))}
            </dl>
            <section className="space-y-4" aria-labelledby="finance-register">
              <h2 id="finance-register" className="text-xl font-semibold">Registre financier</h2>
              {data.entries.length === 0 ? (
                <p className="text-muted-foreground">Aucun mouvement financier enregistré pour le moment.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead><tr className="border-b"><th className="p-3">Date</th><th className="p-3">Catégorie</th><th className="p-3">Libellé public</th><th className="p-3 text-right">Montant</th></tr></thead>
                    <tbody>{data.entries.map((entry, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-3"><time dateTime={entry.date}>{new Date(entry.date).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}</time></td>
                        <td className="p-3">{publicCategories[entry.category]}</td>
                        <td className="p-3">{entry.publicLabel ?? '—'}</td>
                        <td className="p-3 text-right whitespace-nowrap">{formatEuro(entry.amountMinor)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
}
