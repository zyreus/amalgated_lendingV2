import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchPublicLoanProducts, quickComputeLoan } from './api'
import type { ComputeLoanInput } from './types'

export function useLoanProductsQuery() {
  return useQuery({
    queryKey: ['reference-loan-products'],
    queryFn: fetchPublicLoanProducts,
    staleTime: 5 * 60 * 1000,
  })
}

export function useQuickComputeMutation() {
  return useMutation({
    mutationFn: (input: ComputeLoanInput) => quickComputeLoan(input),
  })
}
