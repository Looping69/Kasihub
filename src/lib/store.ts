"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ViewKey, Member } from "@/lib/types";

interface KasiState {
  // Auth / current member
  currentMemberId: string | null;
  currentMember: Member | null;
  isAuthenticated: boolean;

  // Navigation
  activeView: ViewKey;
  sidebarOpen: boolean;

  // Registration wizard
  registrationOpen: boolean;

  // Actions
  setMember: (member: Member | null) => void;
  login: (memberId: string, member: Member) => void;
  logout: () => void;
  setView: (view: ViewKey) => void;
  setSidebarOpen: (open: boolean) => void;
  openRegistration: () => void;
  closeRegistration: () => void;
}

export const useKasiStore = create<KasiState>()(
  persist(
    (set) => ({
      currentMemberId: null,
      currentMember: null,
      isAuthenticated: false,
      activeView: "dashboard",
      sidebarOpen: false,
      registrationOpen: false,

      setMember: (member) =>
        set({
          currentMember: member,
          currentMemberId: member?.id ?? null,
          isAuthenticated: !!member,
        }),

      login: (memberId, member) =>
        set({
          currentMemberId: memberId,
          currentMember: member,
          isAuthenticated: true,
          activeView: "dashboard",
        }),

      logout: () =>
        set({
          currentMemberId: null,
          currentMember: null,
          isAuthenticated: false,
          activeView: "dashboard",
        }),

      setView: (view) =>
        set({ activeView: view, sidebarOpen: false }),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      openRegistration: () => set({ registrationOpen: true }),
      closeRegistration: () => set({ registrationOpen: false }),
    }),
    {
      name: "kasihub-store",
      partialize: (state) => ({
        currentMemberId: state.currentMemberId,
        currentMember: state.currentMember,
        isAuthenticated: state.isAuthenticated,
        activeView: state.activeView,
      }),
    }
  )
);
