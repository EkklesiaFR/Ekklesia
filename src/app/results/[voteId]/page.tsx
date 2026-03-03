import ResultsVoteDetailClient from '@/app/results/[voteId]/ResultsVoteDetailClient';

type Params = { voteId: string };

export default function Page({ params }: { params: Params }) {
  return <ResultsVoteDetailClient voteId={params.voteId} />;
}