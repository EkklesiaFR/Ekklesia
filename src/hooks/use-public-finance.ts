'use client';
import useSWR from 'swr';
import { publicFinanceSchema } from '@/lib/finance/public';

async function fetchFinance(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('Financial data unavailable');
  return publicFinanceSchema.parse(await response.json());
}

export function usePublicFinance() {
  return useSWR('/api/public/finance', fetchFinance);
}
