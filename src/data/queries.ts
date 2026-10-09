import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getMatchHistory, getRanking, registerMatch } from './api'

export const PLAYER_ID = 'captain-rafael'

export function useRanking(page: number) {
  return useQuery({ queryKey: ['ranking', page], queryFn: () => getRanking(page) })
}

export function useMatchHistory(page: number) {
  return useQuery({ queryKey: ['match-history', PLAYER_ID, page], queryFn: () => getMatchHistory(PLAYER_ID, page) })
}

export function useRegisterMatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: registerMatch,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ranking'] })
      void queryClient.invalidateQueries({ queryKey: ['match-history', PLAYER_ID] })
    },
  })
}
