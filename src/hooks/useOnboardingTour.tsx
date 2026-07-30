import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { useSession } from "@/hooks/use-session";
import {
  clearTourState,
  getTourState,
  setTourState,
  tourSteps,
} from "@/lib/onboardingTour";

type TourContextValue = {
  /** Reinicia o tour do zero (usado pelo botão "Ver tutorial novamente"). */
  startTour: () => void;
  /** Indica se o usuário já concluiu ou pulou o tutorial. */
  hasSeenTour: boolean;
};

const TourContext = createContext<TourContextValue | null>(null);

/** Espera um seletor existir e estar visível (evita iniciar antes da UI renderizar). */
function waitForElement(selector: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const found = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      return !!el && el.offsetParent !== null;
    };
    if (found()) return resolve(true);

    const observer = new MutationObserver(() => {
      if (found()) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(true);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(found());
    }, timeoutMs);
  });
}

/** Mantém apenas as etapas cujo elemento existe na tela atual. */
function visibleSteps(steps: DriveStep[]): DriveStep[] {
  return steps.filter((s) => {
    if (typeof s.element !== "string") return true;
    const el = document.querySelector(s.element) as HTMLElement | null;
    return !!el && el.offsetParent !== null;
  });
}

export function OnboardingTourProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  const userId = user?.id ?? null;
  const driverRef = useRef<Driver | null>(null);
  const autoStartedRef = useRef(false);

  const destroy = useCallback(() => {
    driverRef.current?.destroy();
    driverRef.current = null;
  }, []);

  const run = useCallback(
    async (opts: { markOnFinish: boolean }) => {
      // Só inicia quando a interface estiver realmente renderizada.
      const ready = await waitForElement('[data-tour="nav-dashboard"]');
      if (!ready) return;

      const steps = visibleSteps(tourSteps);
      if (steps.length === 0) return;

      destroy();

      const instance = driver({
        steps,
        showProgress: true,
        progressText: "Etapa {{current}} de {{total}}",
        nextBtnText: "Próximo",
        prevBtnText: "Voltar",
        doneBtnText: "Concluir",
        showButtons: ["next", "previous", "close"],
        allowClose: true,
        overlayOpacity: 0.6,
        stagePadding: 6,
        stageRadius: 12,
        popoverClass: "pp-tour-popover",
        onDestroyStarted: () => {
          const isLast = !instance.hasNextStep();
          if (opts.markOnFinish) {
            setTourState(userId, isLast ? "completed" : "skipped");
          }
          instance.destroy();
        },
        onDestroyed: () => {
          driverRef.current = null;
        },
      });

      driverRef.current = instance;
      instance.drive();
    },
    [destroy, userId],
  );

  // Primeiro acesso: dispara automaticamente uma única vez.
  useEffect(() => {
    if (loading || !userId || autoStartedRef.current) return;
    if (getTourState(userId)) return;
    autoStartedRef.current = true;
    void run({ markOnFinish: true });
  }, [loading, userId, run]);

  useEffect(() => destroy, [destroy]);

  const startTour = useCallback(() => {
    clearTourState(userId);
    void run({ markOnFinish: true });
  }, [run, userId]);

  const value = useMemo(
    () => ({ startTour, hasSeenTour: !!getTourState(userId) }),
    [startTour, userId],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useOnboardingTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    return { startTour: () => {}, hasSeenTour: true };
  }
  return ctx;
}