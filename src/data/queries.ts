import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getMatchHistory, getRanking, registerMatch } from './api'
import { isAxiosError } from 'axios'

export const PLAYER_ID = 'captain-rafael'
const retryRead = (failures: number, error: unknown) => failures < 1 && !(isAxiosError(error) && error.response && error.response.status >= 400 && error.response.status < 500)

export function useRanking(page: number) {
  return useQuery({ queryKey: ['ranking', page], queryFn: ({ signal }) => getRanking(page, signal), retry: retryRead, retryDelay: 250, refetchOnMount: 'always' })
}

export function useMatchHistory(page: number) {
  return useQuery({ queryKey: ['match-history', PLAYER_ID, page], queryFn: ({ signal }) => getMatchHistory(PLAYER_ID, page, signal), retry: retryRead, retryDelay: 250, refetchOnMount: 'always' })
}

export function useRegisterMatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: registerMatch,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ranking'] })
      void queryClient.invalidateQueries({ queryKey: ['match-history', PLAYER_ID] })
    },
  })
}
