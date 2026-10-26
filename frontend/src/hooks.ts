import { useMutation, useQuery } from "@tanstack/react-query";

import { api, type AgendaItem, type Habit, type Routine } from "@/src/api";
import { queryClient } from "@/src/query-client";

export const refreshAll = () => queryClient.invalidateQueries();

export const useAgenda = (start: string, days = 1) =>
  useQuery({ queryKey: ["agenda", start, days], queryFn: () => api<{ items: AgendaItem[] }>(`/agenda?start=${start}&days=${days}`) });

export const useHabits = () => useQuery({ queryKey: ["habits"], queryFn: () => api<Habit[]>("/habits") });
export const useRoutines = () => useQuery({ queryKey: ["routines"], queryFn: () => api<Routine[]>("/routines") });
export const useSettings = () => useQuery({ queryKey: ["settings"], queryFn: () => api<any>("/settings") });
export const useProgress = () => useQuery({ queryKey: ["progress"], queryFn: () => api<any>("/progress") });

export const usePlan = () =>
  useMutation({
    mutationFn: () => api<any>("/plan", { method: "POST" }),
    onSuccess: refreshAll,
  });

export const useSessionAction = () =>
  useMutation({
    mutationFn: ({ id, action }: { id: string; action: "done" | "postpone" | "undo" }) => api<any>(`/sessions/${id}/${action}`, { method: "POST" }),
    onSuccess: refreshAll,
  });
