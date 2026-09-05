import React, { useState } from "react";
import {
  useAppState,
  customerMap,
  billingActions,
} from "../../infrastructure/store";
import { calculateBillingSchedule, calculateProration } from "../../modules/billing/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Repeat,
  Calendar,
  Layers,
  PauseCircle,
  PlayCircle,
  XCircle,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

export function SubscriptionsView() {
  const state = useAppState();
  const customers = customerMap(state);

  const [selectedSubId, setSelectedSubId] = useState<string>(
    state.subscriptions[0]?.id ?? "",
  );
  const selectedSub = state.subscriptions.find((s) => s.id === selectedSubId);
  const plan = selectedSub
    ? state.plans.find((p) => p.id === selectedSub.planId)
    : null;
  const customer = selectedSub ? customers[selectedSub.customerId] : null;

  // Proration simulator input
  const [newSeatCount, setNewSeatCount] = useState<number>(selectedSub?.qty ?? 1);

  const prorationPreview = selectedSub
    ? calculateProration(selectedSub, newSeatCount, selectedSub.unitPrice)
    : null;

  const schedule = selectedSub ? calculateBillingSchedule(selectedSub, 6) : [];

  const handleModifySeats = () => {
    if (!selectedSub) return;
    try {
      const res = billingActions.modifySubscription(selectedSub.id, newSeatCount);
      toast.success(
        res?.kind === "CHARGE"
          ? `Added seats! Prorated additional charge of ₹${res.difference.toFixed(2)} applied.`
          : res?.kind === "CREDIT"
            ? `Reduced seats! Prorated credit adjustment of ₹${Math.abs(res.difference).toFixed(2)} credited.`
            : "Seat count updated.",
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to modify subscription");
    }
  };

  const handleSetStatus = (status: "ACTIVE" | "PAUSED" | "CANCELLED") => {
    if (!selectedSub) return;
    try {
      billingActions.setSubscriptionStatus(selectedSub.id, status);
      toast.success(`Subscription marked as ${status}.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Subscriptions & Recurring Billing</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Hybrid contracts, automated billing cycle scheduling, and real mid-cycle seat proration.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Subscriptions List */}
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Repeat className="h-4 w-4 text-primary" />
              Active Contracts ({state.subscriptions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 space-y-1.5">
            {state.subscriptions.map((s) => {
              const cust = customers[s.customerId];
              const p = state.plans.find((pl) => pl.id === s.planId);
              const active = s.id === selectedSubId;
              const mrr = s.cycle === "Monthly" ? s.qty * s.unitPrice : Math.round((s.qty * s.unitPrice) / 12);

              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setSelectedSubId(s.id);
                    setNewSeatCount(s.qty);
                  }}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    active ? "border-primary bg-primary/5 shadow-xs" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>{cust?.name}</span>
                    <Badge
                      variant={
                        s.status === "ACTIVE"
                          ? "secondary"
                          : s.status === "PAUSED"
                            ? "outline"
                            : "destructive"
                      }
                      className="text-[9px] uppercase font-mono py-0 px-1"
                    >
                      {s.status}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {p?.name ?? "Cloud Care Plan"} · {s.qty} seats
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                    <span className="font-mono font-medium text-foreground">
                      ₹{mrr.toLocaleString()} / mo
                    </span>
                    <span>Next: {new Date(s.nextBillDate).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Right 2 Cols: Subscription Details & Proration Engine */}
        <div className="lg:col-span-2 space-y-6">
          {selectedSub && customer ? (
            <>
              <Card className="shadow-xs">
                <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-bold text-foreground">
                        {customer.name}
                      </CardTitle>
                      <Badge
                        variant={selectedSub.status === "ACTIVE" ? "secondary" : "outline"}
                        className="text-xs uppercase font-mono"
                      >
                        {selectedSub.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs font-mono">
                        {selectedSub.cycle} Cycle
                      </Badge>
                    </div>
                    <CardDescription className="text-xs mt-0.5">
                      Plan: <strong className="text-foreground">{plan?.name}</strong> · Rate: ₹{selectedSub.unitPrice} / seat · Next invoice on: {new Date(selectedSub.nextBillDate).toLocaleDateString()}
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {selectedSub.status === "ACTIVE" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetStatus("PAUSED")}
                        className="h-7 text-xs"
                      >
                        <PauseCircle className="h-3.5 w-3.5 mr-1" /> Pause
                      </Button>
                    )}
                    {selectedSub.status === "PAUSED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetStatus("ACTIVE")}
                        className="h-7 text-xs"
                      >
                        <PlayCircle className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Resume
                      </Button>
                    )}
                    {selectedSub.status !== "CANCELLED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetStatus("CANCELLED")}
                        className="h-7 text-xs text-rose-600 hover:text-rose-700"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel Contract
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-6">
                  {/* Mid-Cycle Seat Proration Engine */}
                  <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-primary flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4" />
                        Mid-Cycle Seat Scaling & Real Proration
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {prorationPreview?.daysRemaining} days remaining in current cycle
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Scaling seats immediately credits the unused days of the previous tier and applies a prorated charge for the remaining period.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Modify Committed Seats:</span>
                        <Input
                          type="number"
                          min={1}
                          value={newSeatCount}
                          onChange={(e) => setNewSeatCount(parseInt(e.target.value) || 1)}
                          className="h-8 w-24 text-xs font-mono text-center font-bold"
                        />
                        <span className="text-muted-foreground">seats</span>
                      </div>

                      {prorationPreview && (
                        <div className="flex-1 flex items-center justify-between p-2 rounded bg-background border border-border text-[11px]">
                          <div>
                            <span className="text-muted-foreground">Proration Net: </span>
                            <strong
                              className={
                                prorationPreview.kind === "CHARGE"
                                  ? "text-primary font-mono"
                                  : prorationPreview.kind === "CREDIT"
                                    ? "text-emerald-600 font-mono"
                                    : "text-muted-foreground font-mono"
                              }
                            >
                              {prorationPreview.kind === "CHARGE"
                                ? `+₹${prorationPreview.difference.toFixed(2)} charge`
                                : prorationPreview.kind === "CREDIT"
                                  ? `-₹${Math.abs(prorationPreview.difference).toFixed(2)} credit`
                                  : "No difference"}
                            </strong>
                          </div>
                          <Button
                            size="sm"
                            disabled={newSeatCount === selectedSub.qty}
                            onClick={handleModifySeats}
                            className="h-6 text-[10px]"
                          >
                            Apply Modification
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Billing Adjustments Log */}
                  {selectedSub.adjustments.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-foreground">Proration Billing Adjustments</div>
                      <div className="space-y-1.5">
                        {selectedSub.adjustments.map((adj) => (
                          <div
                            key={adj.id}
                            className="p-2.5 rounded-lg border border-border bg-card flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-semibold text-foreground">{adj.note}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {new Date(adj.at).toLocaleString()}
                              </div>
                            </div>
                            <Badge
                              variant={adj.kind === "CHARGE" ? "secondary" : "outline"}
                              className="font-mono text-xs"
                            >
                              {adj.kind === "CHARGE" ? "+" : "-"}${adj.amount.toFixed(2)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Projected Billing Schedule */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      Projected Billing Schedule (Next 6 Cycles)
                    </div>
                    <div className="rounded-md border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[11px]">
                            <TableHead>Cycle Label</TableHead>
                            <TableHead>Scheduled Billing Date</TableHead>
                            <TableHead className="text-right">Projected Charge</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                          {schedule.map((entry, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{entry.label}</TableCell>
                              <TableCell className="font-mono text-muted-foreground">
                                {new Date(entry.date).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold">
                                ₹{entry.amount.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline" className="text-[9px] uppercase font-mono py-0 px-1">
                                  Scheduled
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="shadow-xs p-10 text-center text-muted-foreground text-xs">
              Select a subscription contract to view billing schedules and proration calculators.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
