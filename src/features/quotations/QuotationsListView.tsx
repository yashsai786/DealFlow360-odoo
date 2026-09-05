import React, { useState, useEffect } from "react";
import {
  useAppState,
  totalsOf,
  customerMap,
  quotationActions,
} from "../../infrastructure/store";
import { stageLabel } from "../../modules/quotations/service";
import type { Quotation, QuotationStage } from "../../modules/shared/types";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  FileText,
  Plus,
  Search,
  ArrowUpRight,
  LayoutList,
  Kanban,
  Building2,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

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

  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<Quotation | null>(null);
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (initialView) {
      setViewMode(initialView);
    }
  }, [initialView]);

  const toggleSelectDraft = (id: string) => {
    const next = new Set(selectedDraftIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDraftIds(next);
  };

  const toggleSelectAll = (quotes: Quotation[]) => {
    const draftQuotes = quotes.filter((q) => q.stage === "DRAFT");
    if (draftQuotes.every((q) => selectedDraftIds.has(q.id))) {
      setSelectedDraftIds(new Set());
    } else {
      setSelectedDraftIds(new Set(draftQuotes.map((q) => q.id)));
    }
  };

  const handleConfirmSingleDelete = async () => {
    if (!singleDeleteTarget) return;
    setIsDeleting(true);
    try {
      await quotationActions.delete(singleDeleteTarget.id);
      toast.success(`Draft quotation ${singleDeleteTarget.number} deleted`);
      setSelectedDraftIds((prev) => {
        const next = new Set(prev);
        next.delete(singleDeleteTarget.id);
        return next;
      });
      setSingleDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete quotation");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedDraftIds.size === 0) return;
    setIsDeleting(true);
    try {
      const ids = Array.from(selectedDraftIds);
      const res = await quotationActions.bulkDelete(ids);
      toast.success(`Successfully deleted ${res?.deletedCount ?? ids.length} draft quotation(s)`);
      setSelectedDraftIds(new Set());
      setConfirmBulkDeleteOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to bulk delete quotations");
    } finally {
      setIsDeleting(false);
    }
  };

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
              <Select
                value={stageFilter}
                onValueChange={(val) => {
                  setStageFilter(val);
                  setSelectedDraftIds(new Set());
                }}
              >
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

              {stageFilter === "DRAFT" && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={selectedDraftIds.size === 0 || isDeleting}
                  onClick={() => setConfirmBulkDeleteOpen(true)}
                  className="h-8 text-xs whitespace-nowrap shadow-xs"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete Selected ({selectedDraftIds.size})
                </Button>
              )}
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
                          <div className="flex items-center gap-1.5">
                            {q.stage === "DRAFT" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-destructive p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSingleDeleteTarget(q);
                                }}
                                title="Delete Draft Quotation"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                            <span className="flex items-center gap-0.5 text-primary text-[10px]">
                              Open Builder <ArrowUpRight className="h-3 w-3" />
                            </span>
                          </div>
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
                  {stageFilter === "DRAFT" && (
                    <TableHead className="w-8">
                      <input
                        type="checkbox"
                        checked={
                          filteredQuotes.length > 0 &&
                          filteredQuotes.every((q) => selectedDraftIds.has(q.id))
                        }
                        onChange={() => toggleSelectAll(filteredQuotes)}
                        className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                        title="Select all visible drafts"
                      />
                    </TableHead>
                  )}
                  <TableHead>Quotation #</TableHead>
                  <TableHead>Customer Account</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Net Total</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="w-16 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {filteredQuotes.map((q) => {
                  const cust = customers[q.customerId];
                  const totals = totalsOf(state, q);
                  const owner = state.users.find((u) => u.id === q.ownerId);
                  const isDraft = q.stage === "DRAFT";

                  return (
                    <TableRow
                      key={q.id}
                      onClick={() => onSelectQuote(q.id)}
                      className={`cursor-pointer hover:bg-muted/40 transition-colors ${
                        selectedDraftIds.has(q.id) ? "bg-primary/5" : ""
                      }`}
                    >
                      {stageFilter === "DRAFT" && (
                        <TableCell onClick={(e) => e.stopPropagation()} className="w-8">
                          <input
                            type="checkbox"
                            checked={selectedDraftIds.has(q.id)}
                            onChange={() => toggleSelectDraft(q.id)}
                            className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                          />
                        </TableCell>
                      )}
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
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {isDraft && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive p-0"
                              onClick={() => setSingleDeleteTarget(q)}
                              title="Delete Draft Quotation"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-primary p-0"
                            onClick={() => onSelectQuote(q.id)}
                            title="Open Builder"
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredQuotes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={stageFilter === "DRAFT" ? 11 : 10} className="text-center py-8 text-muted-foreground text-xs">
                      No quotations matching query.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Single Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(singleDeleteTarget)}
        onOpenChange={(open) => !open && setSingleDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Delete Draft Quotation
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete draft{" "}
              <strong className="text-foreground">{singleDeleteTarget?.number}</strong>? This will
              permanently remove the deal from SQLite. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSingleDeleteTarget(null)}
              disabled={isDeleting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmSingleDelete}
              disabled={isDeleting}
              className="text-xs"
            >
              {isDeleting ? "Deleting..." : "Delete Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={confirmBulkDeleteOpen}
        onOpenChange={(open) => !open && setConfirmBulkDeleteOpen(false)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Delete Selected Draft Quotations
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to permanently delete{" "}
              <strong className="text-foreground">{selectedDraftIds.size}</strong> selected draft
              quotation(s)? All associated draft records will be permanently removed from SQLite.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmBulkDeleteOpen(false)}
              disabled={isDeleting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmBulkDelete}
              disabled={isDeleting}
              className="text-xs"
            >
              {isDeleting ? "Deleting..." : `Delete ${selectedDraftIds.size} Drafts`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
