import React from "react";
import {
  useAppState,
  productMap,
  customerMap,
  quotationActions,
} from "../../infrastructure/store";
import { calculateDealHealth, repDiscountAverages } from "../../modules/deal-intelligence/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  HeartPulse,
  AlertTriangle,
  BellRing,
  ArrowUpRight,
  TrendingDown,
  Clock,
  Truck,
  ShieldAlert,
  Flame,
} from "lucide-react";
import { toast } from "sonner";

interface DealHealthViewProps {
  onOpenQuote: (quoteId: string) => void;
}

export function DealHealthView({ onOpenQuote }: DealHealthViewProps) {
  const state = useAppState();
  const products = productMap(state);
  const customers = customerMap(state);
  const users = Object.fromEntries(state.users.map((u) => [u.id, u]));

  const alerts = calculateDealHealth({
    quotations: state.quotations,
    products,
    customers,
    users,
    orders: state.orders,
    approvals: state.approvals,
  });

  const repBaselines = repDiscountAverages(state.quotations, products);

  const criticalCount = alerts.filter((a) => a.severity === "Critical").length;
  const atRiskCount = alerts.filter((a) => a.severity === "At Risk").length;
  const watchCount = alerts.filter((a) => a.severity === "Watch").length;

  const handleNudge = (quotationId: string) => {
    try {
      quotationActions.nudge(quotationId);
      toast.success("Sales representative nudged! Notification stamped on deal record.");
    } catch (err: any) {
      toast.error(err.message || "Failed to nudge owner");
    }
  };

  const handleEscalate = (quotationId: string) => {
    try {
      quotationActions.escalate(quotationId);
      toast.warning("Deal escalated to sales operations executive queue!");
    } catch (err: any) {
      toast.error(err.message || "Failed to escalate");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Deal Health & Autonomous Intelligence</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Self-governing anomaly detection, stalled pipeline diagnostics, and automated manager intervention.
        </p>
      </div>

      {/* Health Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-xs border-rose-200 dark:border-rose-950 bg-rose-50/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-rose-700 dark:text-rose-400">Critical Anomaly</CardTitle>
            <Flame className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-rose-600">{criticalCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Requires immediate executive intervention</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-amber-200 dark:border-amber-950 bg-amber-50/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-amber-700 dark:text-amber-400">At Risk Deals</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-amber-600">{atRiskCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Delivery delays or discount overruns</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Watch List</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">{watchCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Prolonged negotiation cycles</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-emerald-200 dark:border-emerald-950 bg-emerald-50/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Healthy Pipeline</CardTitle>
            <HeartPulse className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-600">
              {Math.max(0, state.quotations.length - alerts.length)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Deals progressing normally</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Live Health Diagnostic Stream & Rep Baselines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Diagnostic Alerts */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-border">
              <CardTitle className="text-xs font-semibold">Active Deal Diagnostics & Action Engine</CardTitle>
              <CardDescription className="text-[11px]">
                Showing {alerts.length} autonomously flagged items with remediation controls
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {alerts.map((a) => {
                const q = state.quotations.find((x) => x.id === a.quotationId);
                return (
                  <div
                    key={a.id}
                    className="p-3.5 rounded-lg border border-border bg-card text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-primary">{a.quotationNumber}</span>
                        <span className="font-semibold text-foreground">{a.customerName}</span>
                        <Badge
                          variant={
                            a.severity === "Critical"
                              ? "destructive"
                              : a.severity === "At Risk"
                                ? "secondary"
                                : "outline"
                          }
                          className="text-[10px] uppercase font-mono py-0 px-1.5"
                        >
                          {a.severity}
                        </Badge>
                        {q?.escalated && (
                          <Badge variant="destructive" className="text-[9px] uppercase">
                            Escalated
                          </Badge>
                        )}
                        {q?.nudgedAt && (
                          <Badge variant="outline" className="text-[9px] font-mono">
                            Nudged
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {a.issue}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">{a.detail}</p>

                    <div className="p-2 rounded bg-muted/40 text-[11px] text-foreground flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Recommended Action: <strong className="text-foreground">{a.recommendedAction}</strong>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleNudge(a.quotationId)}
                          className="h-6 text-[10px] px-2"
                        >
                          <BellRing className="h-3 w-3 mr-1 text-amber-500" />
                          Nudge Rep
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEscalate(a.quotationId)}
                          className="h-6 text-[10px] px-2 text-rose-600 hover:text-rose-700"
                        >
                          <Flame className="h-3 w-3 mr-1" />
                          Escalate
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => onOpenQuote(a.quotationId)}
                          className="h-6 text-[10px] px-2"
                        >
                          Open Deal
                          <ArrowUpRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {alerts.length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-xs">
                  No active deal health alerts. All opportunities within normal operational velocity.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Rep Historical Baselines */}
        <div className="space-y-4">
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-border">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <TrendingDown className="h-4 w-4 text-primary" />
                Rep Historical Discount Baselines
              </CardTitle>
              <CardDescription className="text-[11px]">
                Anomalies trigger when quote discount exceeds rep average by &gt;5%
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5 text-xs">
              {Object.entries(repBaselines).map(([repId, avg]) => {
                const rep = state.users.find((u) => u.id === repId);
                return (
                  <div
                    key={repId}
                    className="p-2.5 rounded-lg border border-border bg-muted/20 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{rep?.name ?? "Rep"}</div>
                      <div className="text-[10px] text-muted-foreground">{rep?.email}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-primary">{avg}%</div>
                      <div className="text-[10px] text-muted-foreground">Historical avg</div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-border">
              <CardTitle className="text-xs font-semibold">Self-Governing Guardrails</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-[11px] text-muted-foreground">
              <div className="flex items-start gap-1.5">
                <span className="text-primary font-bold">•</span>
                <span><strong>Stalled Deals:</strong> Flagged when untouched for &gt;7 days.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-primary font-bold">•</span>
                <span><strong>Discount Anomaly:</strong> Blended quote discount &gt;5% over rep historical baseline.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-primary font-bold">•</span>
                <span><strong>Delivery Slippage:</strong> Unfulfilled orders past promised delivery date.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-primary font-bold">•</span>
                <span><strong>Approval Bottleneck:</strong> Management review queues delayed &gt;3 days.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
