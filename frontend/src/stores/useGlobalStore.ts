import { create } from 'zustand';

interface GlobalState {
  // Price & protocol data
  kairoPrice: number;
  totalTVL: number;
  totalBurned: number;
  totalSupply: number;
  effectiveSupply: number;

  // Setters
  setKairoPrice: (price: number) => void;
  setTotalTVL: (tvl: number) => void;
  setTotalBurned: (burned: number) => void;
  setTotalSupply: (supply: number) => void;
  setEffectiveSupply: (supply: number) => void;

  // Bulk update from WebSocket
  updateGlobalStats: (stats: Partial<Omit<GlobalState, 'setKairoPrice' | 'setTotalTVL' | 'setTotalBurned' | 'setTotalSupply' | 'setEffectiveSupply' | 'updateGlobalStats'>>) => void;
}

export const useGlobalStore = create<GlobalState>((set) => ({
  kairoPrice: 0,
  totalTVL: 0,
  totalBurned: 0,
  totalSupply: 0,
  effectiveSupply: 0,

  setKairoPrice: (price) => set({ kairoPrice: price }),
  setTotalTVL: (tvl) => set({ totalTVL: tvl }),
  setTotalBurned: (burned) => set({ totalBurned: burned }),
  setTotalSupply: (supply) => set({ totalSupply: supply }),
  setEffectiveSupply: (supply) => set({ effectiveSupply: supply }),

  updateGlobalStats: (stats) => set((state) => ({ ...state, ...stats })),
}));
