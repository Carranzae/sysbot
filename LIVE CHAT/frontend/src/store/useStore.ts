import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getStoredUser } from '../lib/authStorage'

interface StoreState {
  currentUser: any | null
  setCurrentUser: (user: any) => void
  clearUser: () => void
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      currentUser: getStoredUser(),
      setCurrentUser: (user) => set({ currentUser: user }),
      clearUser: () => set({ currentUser: null }),
    }),
    {
      name: 'laychat_store',
      partialize: (state) => ({ currentUser: state.currentUser }),
    }
  )
)
