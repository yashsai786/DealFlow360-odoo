import React from "react";
import {
  useAppState,
  productMap,
  totalsOf,
  customerMap,
} from "../../infrastructure/store";
import { stageLabel } from "../../modules/quotations/service";
import { calculateDealHealth } from "../../modules/deal-intelligence/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  ArrowUpRight,
  Clock,
  IndianRupee,
  FileText,
  AlertTriangle,
  PackageCheck,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";

interface DashboardViewProps {
  onNavigate: (tab: any, extraId?: string) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const state = useAppState();
  const products = productMap(state);
  const customers = customerMap(state);

  const pendingApprovals = state.approvals.filter((a) => a.status === "PENDING");
  const awaitingOrders = state.orders.filter(
    (o) => o.status === "AWAITING" || o.status === "BACKORDERED",
  );

  const totalPipeline = state.quotations
    .filter((q) => !["PAID", "CANCELLED"].includes(q.stage))
    .reduce((sum, q) => sum + totalsOf(state, q).total, 0);

  const totalRevenue = state.invoices
    .filter((i) => i.status === "PAID" || i.status === "PARTIALLY_PAID")
    .reduce(
      (sum, i) =>
        sum + i.payments.reduce((pSum, p) => pSum + p.amount, 0),
      0,
    );

  const dealAlerts = calculateDealHealth({
    quotations: state.quotations,
    products,
    customers,
    users: Object.fromEntries(state.users.map((u) => [u.id, u])),
    orders: state.orders,
    approvals: state.approvals,
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sales Operations Command</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time self-governing deal lifecycle, discount validation, and fulfillment oversight.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => onNavigate("quotation-builder")}
            className="h-8 text-xs font-medium"
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Create Quotation
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Active Pipeline</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono">
              ₹{Math.round(totalPipeline).toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {state.quotations.filter((q) => q.stage !== "CANCELLED").length} active deals
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Collected Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-emerald-600">
              ₹{Math.round(totalRevenue).toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {state.invoices.filter((i) => i.status === "PAID").length} settled invoices
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-amber-600">
              {pendingApprovals.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Requiring manager or finance sign-off
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Critical Health Flags</CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-rose-600">
              {dealAlerts.filter((a) => a.severity === "Critical" || a.severity === "At Risk").length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Anomalies & stalled negotiations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Active Deals & Governance Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Quotations Table */}
        <Card className="lg:col-span-2 shadow-xs">
          <CardHeader className="p-4 flex flex-row items-center justify-between border-b border-border">
            <div>
              <CardTitle className="text-sm font-semibold">Active Deals & Quotations</CardTitle>
              <CardDescription className="text-xs">
                Connected stage progression from draft to payment
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate("quotations")}
              className="h-7 text-xs"
            >
              View All
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {state.quotations.slice(0, 5).map((q) => {
                const cust = customers[q.customerId];
                const totals = totalsOf(state, q);
                return (
                  <div
                    key={q.id}
                    onClick={() => onNavigate("quotation-builder", q.id)}
                    className="p-3.5 hover:bg-muted/40 cursor-pointer flex items-center justify-between transition-colors text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold font-mono text-primary">{q.number}</span>
                        <span className="font-medium text-foreground">{cust?.name}</span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal">
                          {cust?.tier}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground text-[11px]">
                        {q.lines.length} lines · Owner: {state.users.find((u) => u.id === q.ownerId)?.name ?? "Rep"}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <div className="font-mono font-semibold">₹{totals.total.toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Margin: {totals.marginPct}% (₹{totals.margin.toLocaleString()})
                        </div>
                      </div>
                      <Badge
                        variant={
                          q.stage === "APPROVED" || q.stage === "PAID"
                            ? "secondary"
                            : q.stage === "PENDING_APPROVAL"
                              ? "destructive"
                              : "outline"
                        }
                        className="text-[10px] uppercase font-mono"
                      >
                        {stageLabel(q.stage)}
                      </Badge>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right Col: Deal Health Alerts */}
        <Card className="shadow-xs flex flex-col">
          <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Deal Health Alerts
              </CardTitle>
              <CardDescription className="text-xs">
                Autonomous risk detection
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("deal-health")}
              className="h-7 text-xs text-muted-foreground"
            >
              All Alerts
            </Button>
          </CardHeader>
          <CardContent className="p-3 flex-1 divide-y divide-border">
            {dealAlerts.slice(0, 4).map((a) => (
              <div key={a.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{a.issue}</span>
                  <Badge
                    variant={
                      a.severity === "Critical"
                        ? "destructive"
                        : a.severity === "At Risk"
                          ? "secondary"
                          : "outline"
                    }
                    className="text-[10px] py-0 px-1"
                  >
                    {a.severity}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">{a.detail}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-mono text-muted-foreground">{a.quotationNumber}</span>
                  <button
                    type="button"
                    onClick={() => onNavigate("quotation-builder", a.quotationId)}
                    className="text-[10px] text-primary hover:underline font-medium"
                  >
                    Resolve Deal &rarr;
                  </button>
                </div>
              </div>
            ))}
            {dealAlerts.length === 0 && (
              <p className="text-xs text-muted-foreground py-6 text-center">All deals healthy.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Operational Queues: Fulfillment & Approvals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Approvals Awaiting Action
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("approvals")}
              className="h-6 text-[11px]"
            >
              Queue ({pendingApprovals.length})
            </Button>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="space-y-2">
              {pendingApprovals.slice(0, 2).map((a) => {
                const q = state.quotations.find((x) => x.id === a.quotationId);
                const cust = customers[q?.customerId ?? ""];
                return (
                  <div
                    key={a.id}
                    onClick={() => onNavigate("approvals")}
                    className="p-2.5 rounded-lg border border-border hover:bg-muted/40 cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-semibold">{q?.number}</span> · {cust?.name}
                      <p className="text-[10px] text-muted-foreground">
                        Waiting on: {a.steps.find((s) => s.status === "PENDING")?.role.replace("_", " ")}
                      </p>
                    </div>
                    <Badge variant="destructive" className="text-[10px] uppercase">
                      {a.riskLevel} Risk
                    </Badge>
                  </div>
                );
              })}
              {pendingApprovals.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">No pending approvals.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <PackageCheck className="h-4 w-4 text-primary" />
              Fulfillment Operations
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("fulfillment")}
              className="h-6 text-[11px]"
            >
              Manage Orders ({awaitingOrders.length})
            </Button>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="space-y-2">
              {awaitingOrders.slice(0, 2).map((o) => {
                const q = state.quotations.find((x) => x.id === o.quotationId);
                const cust = customers[q?.customerId ?? ""];
                return (
                  <div
                    key={o.id}
                    onClick={() => onNavigate("fulfillment")}
                    className="p-2.5 rounded-lg border border-border hover:bg-muted/40 cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-semibold">{q?.number}</span> · {cust?.name}
                      <p className="text-[10px] text-muted-foreground">
                        Due: {new Date(o.dueAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={o.status === "BACKORDERED" ? "destructive" : "secondary"}
                      className="text-[10px] uppercase"
                    >
                      {o.status}
                    </Badge>
                  </div>
                );
              })}
              {awaitingOrders.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">All warehouse orders fulfilled.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
