import type { DriveStep } from "driver.js";

/** Versão do tour: incremente para reexibir após mudanças relevantes na UI. */
export const TOUR_VERSION = 1;
const STORAGE_PREFIX = "pp_onboarding_tour_v";

export type TourState = "completed" | "skipped";

function storageKey(userId?: string | null) {
  return `${STORAGE_PREFIX}${TOUR_VERSION}:${userId ?? "anon"}`;
}

export function getTourState(userId?: string | null): TourState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw === "completed" || raw === "skipped" ? raw : null;
  } catch {
    return null;
  }
}

export function setTourState(userId: string | null | undefined, state: TourState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), state);
  } catch {
    /* storage indisponível — tour apenas voltará a aparecer */
  }
}

export function clearTourState(userId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(userId));
  } catch {
    /* noop */
  }
}

/**
 * Remove o estado do tour de TODAS as versões para o usuário informado.
 * Usado por "Ver tutorial novamente" para reiniciar sempre do começo,
 * já alinhado com a versão atual do tour.
 */
export function clearAllTourStates(userId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const suffix = `:${userId ?? "anon"}`;
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX) && key.endsWith(suffix)) {
        keys.push(key);
      }
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* noop */
  }
}

/**
 * Etapas do onboarding. Todos os alvos vivem no AppShell,
 * então o tour funciona em qualquer página autenticada.
 */
export const tourSteps: DriveStep[] = [
  {
    element: '[data-tour="nav-dashboard"]',
    popover: {
      title: "Seu painel",
      description:
        "Aqui você acompanha pedidos do dia, faturamento e os principais indicadores da sua loja.",
    },
  },
  {
    element: '[data-tour="nav-pedidos"]',
    popover: {
      title: "Pedidos",
      description:
        "Receba, acompanhe e mude o status dos pedidos. Também é onde você imprime as comandas.",
    },
  },
  {
    element: '[data-tour="nav-produtos"]',
    popover: {
      title: "Produtos",
      description:
        "Cadastre seus produtos com foto, preço e estoque. Só os produtos ativos aparecem na loja pública.",
    },
  },
  {
    element: '[data-tour="nav-vendas"]',
    popover: {
      title: "Venda rápida",
      description:
        "Registre uma venda presencial em poucos cliques: cliente, produto, quantidade e pagamento.",
    },
  },
  {
    element: '[data-tour="nav-clientes"]',
    popover: {
      title: "Clientes",
      description:
        "Sua base de clientes é criada automaticamente a partir dos pedidos, com histórico de compras.",
    },
  },
  {
    element: '[data-tour="store-link"]',
    popover: {
      title: "Sua loja pública",
      description:
        "Este é o link que você envia para os clientes fazerem pedidos pelo celular.",
    },
  },
  {
    element: '[data-tour="nav-configuracoes"]',
    popover: {
      title: "Configurações",
      description:
        "Ajuste nome, WhatsApp, horários e a identidade da sua loja sempre que precisar.",
    },
  },
  {
    element: '[data-tour="restart-tour"]',
    popover: {
      title: "Tudo pronto!",
      description:
        "Quando quiser rever este passo a passo, é só clicar em “Ver tutorial novamente”. Bom trabalho!",
    },
  },
];