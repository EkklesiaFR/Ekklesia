import ResultsVoteDetailClient from '@/app/results/[voteId]/ResultsVoteDetailClient';

type Params = { voteId: string };

export default async function Page({
  params,
}: {
  params: Params | Promise<Params>;
}) {
  const { voteId } = await params;

  return <ResultsVoteDetailClient voteId={voteId} />;
}