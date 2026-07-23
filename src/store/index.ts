import { create } from 'zustand';

interface AppState {}

export const useStore = create<AppState>(() => ({}));
