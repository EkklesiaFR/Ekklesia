import ResultsVoteDetailClient from '@/app/results/[voteId]/ResultsVoteDetailClient';

export default function Page({ params }: { params: { voteId: string } }) {
  return <ResultsVoteDetailClient voteId={params.voteId} />;
}