'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';

interface OnboardingContextType {
  /** 0 = not started, 1–4 = active step, 5 = done */
  dashboardStep: number;
  setDashboardStep: (step: number) => void;
  newTxGuideShown: boolean;
  markNewTxGuideDone: () => void;
  /** Resets the dashboard guide — used by sidebar "Take the tour" button */
  resetGuide: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [dashboardStep, setDashboardStepState] = useState<number>(0);
  const [newTxGuideShown, setNewTxGuideShown] = useState<boolean>(false);

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    const done = localStorage.getItem('lex_dashboard_guide_done');
    const newTxDone = localStorage.getItem('lex_newtx_guide_done');
    setDashboardStepState(done ? 5 : 0);
    setNewTxGuideShown(!!newTxDone);
  }, []);

  const setDashboardStep = useCallback((step: number) => {
    setDashboardStepState(step);
    if (step >= 5) {
      localStorage.setItem('lex_dashboard_guide_done', 'true');
    }
  }, []);

  const markNewTxGuideDone = useCallback(() => {
    setNewTxGuideShown(true);
    localStorage.setItem('lex_newtx_guide_done', 'true');
  }, []);

  const resetGuide = useCallback(() => {
    localStorage.removeItem('lex_dashboard_guide_done');
    localStorage.removeItem('lex_newtx_guide_done');
    setDashboardStepState(1);
    setNewTxGuideShown(false);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        dashboardStep,
        setDashboardStep,
        newTxGuideShown,
        markNewTxGuideDone,
        resetGuide,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

const NOOP_CONTEXT: OnboardingContextType = {
  dashboardStep: 0,
  setDashboardStep: () => {},
  newTxGuideShown: true,
  markNewTxGuideDone: () => {},
  resetGuide: () => {},
};

export function useOnboarding(): OnboardingContextType {
  const ctx = useContext(OnboardingContext);
  return ctx ?? NOOP_CONTEXT;
}
