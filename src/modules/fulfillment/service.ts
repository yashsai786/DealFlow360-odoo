import type {
  Allocation,
  Backorder,
  InventoryItem,
  Product,
  Quotation,
  Warehouse,
} from "../shared/types";

export interface SplitPlan {
  allocations: Allocation[];
  shortages: { productId: string; qty: number }[];
  shipmentCount: number;
  shippingCost: number;
}

/**
 * Greedy cost-optimal split: cheapest warehouses first, preferring warehouses
 * already used by the plan so the shipment count stays low.
 */
export function calculateWarehouseSplit(
  quotation: Quotation,
  products: Record<string, Product>,
  warehouses: Warehouse[],
  inventory: InventoryItem[],
): SplitPlan {
  const allocations: Allocation[] = [];
  const shortages: { productId: string; qty: number }[] = [];
  const used = new Set<string>();

  const physicalLines = quotation.lines.filter(
    (l) => products[l.productId]?.category === "Hardware",
  );

  for (const line of physicalLines) {
    let remaining = line.qty;
    const options = inventory
      .filter((i) => i.productId === line.productId && i.available - i.reserved > 0)
      .sort((a, b) => {
        const wa = warehouses.find((w) => w.id === a.warehouseId);
        const wb = warehouses.find((w) => w.id === b.warehouseId);
        const preferA = used.has(a.warehouseId) ? -1 : 0;
        const preferB = used.has(b.warehouseId) ? -1 : 0;
        if (preferA !== preferB) return preferA - preferB;
        return (wa?.shipmentCost ?? 0) - (wb?.shipmentCost ?? 0);
      });

    for (const option of options) {
      if (remaining <= 0) break;
      const free = option.available - option.reserved;
      const take = Math.min(free, remaining);
      if (take <= 0) continue;
      remaining -= take;
      used.add(option.warehouseId);
      allocations.push({
        warehouseId: option.warehouseId,
        productId: line.productId,
        qty: take,
        shipmentCost: warehouses.find((w) => w.id === option.warehouseId)?.shipmentCost ?? 0,
      });
    }

    if (remaining > 0) shortages.push({ productId: line.productId, qty: remaining });
  }

  const shipmentWarehouses = new Set(allocations.map((a) => a.warehouseId));
  const shippingCost = [...shipmentWarehouses].reduce(
    (sum, id) => sum + (warehouses.find((w) => w.id === id)?.shipmentCost ?? 0),
    0,
  );

  return {
    allocations,
    shortages,
    shipmentCount: shipmentWarehouses.size,
    shippingCost,
  };
}

export function createBackorders(shortages: { productId: string; qty: number }[]): Backorder[] {
  return shortages.map((s, i) => ({
    id: `bo-${Date.now()}-${i}`,
    productId: s.productId,
    qty: s.qty,
    status: "OPEN" as const,
  }));
}

/** True when replenished stock can now cover an open backorder. */
export function canConsolidate(backorder: Backorder, inventory: InventoryItem[]) {
  const free = inventory
    .filter((i) => i.productId === backorder.productId)
    .reduce((sum, i) => sum + Math.max(0, i.available - i.reserved), 0);
  return free >= backorder.qty;
}
