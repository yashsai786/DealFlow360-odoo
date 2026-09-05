import React, { useState, useEffect } from "react";
import {
  useAppState,
  totalsOf,
  customerMap,
} from "../../infrastructure/store";
import { stageLabel } from "../../modules/quotations/service";
import type { QuotationStage } from "../../modules/shared/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  FileText,
  Plus,
  Search,
  ArrowUpRight,
  LayoutList,
  Kanban,
  Building2,
  TrendingUp,
} from "lucide-react";

interface QuotationsListViewProps {
  initialView?: "list" | "pipeline";
  onSelectQuote: (id: string) => void;
  onCreateNew: () => void;
}

const PIPELINE_COLUMNS: { stage: QuotationStage; label: string; headerClass: string }[] = [
  { stage: "DRAFT", label: "Draft", headerClass: "border-slate-300 dark:border-slate-700" },
  { stage: "PENDING_APPROVAL", label: "Pending Approval", headerClass: "border-amber-400 dark:border-amber-600" },
  { stage: "APPROVED", label: "Approved", headerClass: "border-emerald-400 dark:border-emerald-600" },
  { stage: "NEGOTIATION", label: "Negotiation", headerClass: "border-indigo-400 dark:border-indigo-600" },
  { stage: "CONFIRMED", label: "Confirmed / Fulfillment", headerClass: "border-blue-400 dark:border-blue-600" },
];

export function QuotationsListView({
  initialView = "list",
  onSelectQuote,
  onCreateNew,
}: QuotationsListViewProps) {
  const state = useAppState();
  const customers = customerMap(state);

  const [viewMode, setViewMode] = useState<"list" | "pipeline">(initialView);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  useEffect(() => {
    if (initialView) {
      setViewMode(initialView);
    }
  }, [initialView]);

  const filteredQuotes = state.quotations.filter((q) => {
    const cust = customers[q.customerId];
    const matchesSearch =
      q.number.toLowerCase().includes(search.toLowerCase()) ||
      cust?.name.toLowerCase().includes(search.toLowerCase());
    const matchesStage = stageFilter === "all" || q.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {viewMode === "pipeline" ? "Deal Pipeline" : "Quotations & Deals"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {viewMode === "pipeline"
              ? "Visual Kanban deal pipeline across qualification, governance review, and confirmation."
              : "Manage commercial bids, revisions, customer negotiations, and approval statuses."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Switcher: List vs Pipeline */}
          <div className="flex items-center border border-border rounded-md p-0.5 bg-muted/40">
            <Button
              type="button"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setViewMode("list")}
            >
              <LayoutList className="h-3.5 w-3.5 mr-1" />
              List
            </Button>
            <Button
              type="button"
              variant={viewMode === "pipeline" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setViewMode("pipeline")}
            >
              <Kanban className="h-3.5 w-3.5 mr-1" />
              Pipeline
            </Button>
          </div>

          <Button size="sm" onClick={onCreateNew} className="h-8 text-xs font-medium">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Create Quotation
          </Button>
        </div>
      </div>

      {/* Filters bar */}
      <Card className="shadow-xs">
        <CardContent className="p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by quote number (e.g. Q-1041) or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs w-full"
            />
          </div>
          {viewMode === "list" && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="h-8 text-xs w-full sm:w-48">
                  <SelectValue placeholder="Filter by stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Deal Stages</SelectItem>
                  <SelectItem value="DRAFT" className="text-xs">Draft</SelectItem>
                  <SelectItem value="PENDING_APPROVAL" className="text-xs">Pending Approval</SelectItem>
                  <SelectItem value="APPROVED" className="text-xs">Approved</SelectItem>
                  <SelectItem value="NEGOTIATION" className="text-xs">Negotiation</SelectItem>
                  <SelectItem value="CONFIRMED" className="text-xs">Confirmed</SelectItem>
                  <SelectItem value="FULFILLMENT" className="text-xs">Fulfillment</SelectItem>
                  <SelectItem value="INVOICED" className="text-xs">Invoiced</SelectItem>
                  <SelectItem value="PAID" className="text-xs">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* VIEW MODE 1: Pipeline / Kanban View */}
      {viewMode === "pipeline" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {PIPELINE_COLUMNS.map((col) => {
            const columnQuotes = filteredQuotes.filter((q) => {
              if (col.stage === "CONFIRMED") {
                return ["CONFIRMED", "FULFILLMENT", "INVOICED", "PAID"].includes(q.stage);
              }
              return q.stage === col.stage;
            });

            const columnTotal = columnQuotes.reduce(
              (sum, q) => sum + totalsOf(state, q).total,
              0
            );

            return (
              <div
                key={col.stage}
                className="flex flex-col rounded-lg border border-border bg-muted/20 p-3 min-h-[500px]"
              >
                {/* Column Header */}
                <div className={`border-b-2 pb-2 mb-3 flex items-center justify-between ${col.headerClass}`}>
                  <div>
                    <h3 className="font-semibold text-xs text-foreground tracking-tight">
                      {col.label}
                    </h3>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      ₹{columnTotal.toLocaleString()}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5">
                    {columnQuotes.length}
                  </Badge>
                </div>

                {/* Cards List */}
                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {columnQuotes.map((q) => {
                    const cust = customers[q.customerId];
                    const totals = totalsOf(state, q);
                    const owner = state.users.find((u) => u.id === q.ownerId);

                    return (
                      <Card
                        key={q.id}
                        onClick={() => onSelectQuote(q.id)}
                        className="cursor-pointer hover:border-primary hover:shadow-sm transition-all border border-border bg-card p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="space-y-0.5">
                            <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <span>{cust?.name ?? "Customer"}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {q.number} · {owner?.name ?? "Rep"}
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
                            className="text-[9px] uppercase font-mono py-0 px-1"
                          >
                            {stageLabel(q.stage)}
                          </Badge>
                        </div>

                        {/* Amount & Items */}
                        <div className="flex items-baseline justify-between pt-1 border-t border-border/50">
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Amount</span>
                            <span className="text-xs font-mono font-bold text-foreground">
                              ₹{totals.total.toLocaleString()}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-muted-foreground block">Margin</span>
                            <span className="text-[11px] font-mono font-medium text-emerald-600">
                              {totals.marginPct}%
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                          <span>{q.lines.length} items</span>
                          <span className="flex items-center gap-0.5 text-primary text-[10px]">
                            Open Builder <ArrowUpRight className="h-3 w-3" />
                          </span>
                        </div>
                      </Card>
                    );
                  })}

                  {columnQuotes.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground/60 text-[11px] border border-dashed border-border/70 rounded-md">
                      No deals
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: Quotations Table */}
      {viewMode === "list" && (
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs font-semibold">All Records</CardTitle>
              <CardDescription className="text-[11px]">
                Showing {filteredQuotes.length} quotations
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead>Quotation #</TableHead>
                  <TableHead>Customer Account</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Net Total</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {filteredQuotes.map((q) => {
                  const cust = customers[q.customerId];
                  const totals = totalsOf(state, q);
                  const owner = state.users.find((u) => u.id === q.ownerId);

                  return (
                    <TableRow
                      key={q.id}
                      onClick={() => onSelectQuote(q.id)}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <TableCell className="font-mono font-semibold text-primary">
                        {q.number}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{cust?.name}</div>
                        <div className="text-[10px] text-muted-foreground">{cust?.tier} Tier · {cust?.industry}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {owner?.name ?? "Rep"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            q.stage === "APPROVED" || q.stage === "PAID"
                              ? "secondary"
                              : q.stage === "PENDING_APPROVAL"
                                ? "destructive"
                                : q.stage === "NEGOTIATION"
                                  ? "outline"
                                  : "outline"
                          }
                          className="text-[10px] uppercase font-mono py-0 px-1.5"
                        >
                          {stageLabel(q.stage)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {q.lines.length}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        ₹{totals.gross.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-rose-600">
                        -₹{totals.discount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        ₹{totals.total.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-mono font-medium text-emerald-600">
                          ₹{totals.margin.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {totals.marginPct}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredQuotes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-xs">
                      No quotations matching query.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
