import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyStore,
  getOrdersSince,
  getTopItemsSince,
  subscribeToStoreOrders,
  type OrderRow,
} from "@/services/dashboardService";

function startOfDay(d: Date) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

function bucketFor(days: number): "day" | "week" | "month" {
  if (days <= 31) return "day";
  if (days <= 180) return "week";
  return "month";
}

function bucketKey(d: Date, gran: "day" | "week" | "month"): string {
  const dt = new Date(d);
  if (gran === "day") {
    dt.setHours(0, 0, 0, 0);
    return dt.toISOString().slice(0, 10);
  }
  if (gran === "week") {
    const day = dt.getDay();
    const diff = (day + 6) % 7;
    dt.setDate(dt.getDate() - diff);
    dt.setHours(0, 0, 0, 0);
    return dt.toISOString().slice(0, 10);
  }
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function labelKey(key: string, gran: "day" | "week" | "month"): string {
  if (gran === "month") {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", {
      month: "short",
      year: "2-digit",
    });
  }
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function useMyStore() {
  return useQuery({
    queryKey: ["my-store"],
    queryFn: getMyStore,
  });
}

export type DashboardData = {
  ordersToday: number;
  revenueToday: number;
  ordersWeek: number;
  revenueOrdersMonth: number;
  quickSalesCount: number;
  quickSalesRevenue: number;
  revenueMonthTotal: number;
  topProduct: string | null;
  series: Array<{ key: string; label: string; revenue: number; count: number }>;
  granularity: "day" | "week" | "month";
};

export function useDashboard(days: number) {
  const qc = useQueryClient();
  const { data: store } = useMyStore();

  const query = useQuery<DashboardData>({
    queryKey: ["dashboard", store?.id, days],
    enabled: !!store?.id,
    queryFn: async () => {
      const start = startOfDay(new Date());
      start.setDate(start.getDate() - (days - 1));

      const startMonth = new Date();
      startMonth.setDate(1);
      startMonth.setHours(0, 0, 0, 0);

      const startDay = startOfDay(new Date());
      const earliest = start < startMonth ? start : startMonth;

      const [rows, top] = await Promise.all([
        getOrdersSince(store!.id, earliest.toISOString()),
        getTopItemsSince(startMonth.toISOString()),
      ]);

      const isPaid = (r: OrderRow) =>
        r.status === "entregue" && r.payment_status === "pago";

      const inPeriod = rows.filter((r) => new Date(r.created_at) >= start);
      const inMonth = rows.filter((r) => new Date(r.created_at) >= startMonth);
      const inToday = rows.filter((r) => new Date(r.created_at) >= startDay);
      const inWeek = rows.filter((r) => {
        const w = new Date();
        w.setDate(w.getDate() - 7);
        return new Date(r.created_at) >= w;
      });

      const monthPaid = inMonth.filter(isPaid);
      const quickSalesMonth = monthPaid.filter((r) => r.type === "presencial");
      const orderSalesMonth = monthPaid.filter((r) => r.type === "reserva");

      const gran = bucketFor(days);
      const seriesMap = new Map<string, { revenue: number; count: number }>();
      inPeriod
        .filter(isPaid)
        .filter((r) => r.type === "presencial")
        .forEach((r) => {
          const k = bucketKey(new Date(r.created_at), gran);
          const cur = seriesMap.get(k) ?? { revenue: 0, count: 0 };
          cur.revenue += Number(r.total);
          cur.count += 1;
          seriesMap.set(k, cur);
        });

      const buckets: string[] = [];
      const cursor = new Date(start);
      const end = new Date();
      while (cursor <= end) {
        buckets.push(bucketKey(cursor, gran));
        if (gran === "day") cursor.setDate(cursor.getDate() + 1);
        else if (gran === "week") cursor.setDate(cursor.getDate() + 7);
        else cursor.setMonth(cursor.getMonth() + 1);
      }
      const uniqueBuckets = Array.from(new Set(buckets));
      const series = uniqueBuckets.map((k) => ({
        key: k,
        label: labelKey(k, gran),
        revenue: seriesMap.get(k)?.revenue ?? 0,
        count: seriesMap.get(k)?.count ?? 0,
      }));

      const map = new Map<string, number>();
      top.forEach((row) => {
        if (!row.product || row.product.store_id !== store!.id) return;
        map.set(
          row.product.name,
          (map.get(row.product.name) ?? 0) + row.quantity,
        );
      });
      const topProduct =
        [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      const revenueOrdersMonth = orderSalesMonth.reduce(
        (s, r) => s + Number(r.total),
        0,
      );
      const quickSalesRevenue = quickSalesMonth.reduce(
        (s, r) => s + Number(r.total),
        0,
      );

      return {
        ordersToday: inToday.filter((r) => r.type === "reserva").length,
        revenueToday: inToday
          .filter(isPaid)
          .reduce((s, r) => s + Number(r.total), 0),
        ordersWeek: inWeek.filter((r) => r.type === "reserva").length,
        revenueOrdersMonth,
        quickSalesCount: quickSalesMonth.length,
        quickSalesRevenue,
        revenueMonthTotal: revenueOrdersMonth + quickSalesRevenue,
        topProduct,
        series,
        granularity: gran,
      };
    },
  });

  useEffect(() => {
    if (!store?.id) return;
    const unsubscribe = subscribeToStoreOrders(store.id, () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    });
    return unsubscribe;
  }, [store?.id, qc]);

  return query;
}