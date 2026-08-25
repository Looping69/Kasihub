import { create } from "zustand";

export type FaultSeverity = "info" | "warning" | "error" | "critical";
export type FaultSource = "frontend" | "api" | "network";

export type DevFault = {
  id: string;
  timestamp: number;
  severity: FaultSeverity;
  source: FaultSource;
  title: string;
  message: string;
  stack?: string;
  file?: string;
  line?: number;
  requestId?: string;
  metadata?: Record<string, unknown>;
};

export type NewDevFault = Omit<DevFault, "id" | "timestamp">;

type FaultState = {
  faults: DevFault[];
  report: (fault: NewDevFault) => void;
  dismiss: (id: string) => void;
  clear: () => void;
};

function faultId() {
  return globalThis.crypto?.randomUUID?.() ?? `fault_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export const useFaultStore = create<FaultState>((set) => ({
  faults: [],
  report: (fault) => set((state) => ({
    faults: [{ id: faultId(), timestamp: Date.now(), ...fault }, ...state.faults].slice(0, 100),
  })),
  dismiss: (id) => set((state) => ({ faults: state.faults.filter((fault) => fault.id !== id) })),
  clear: () => set({ faults: [] }),
}));

export function reportFault(fault: NewDevFault) {
  useFaultStore.getState().report(fault);
}

