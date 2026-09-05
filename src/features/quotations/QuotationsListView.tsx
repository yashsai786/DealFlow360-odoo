import React, { useState } from "react";
import {
  useAppState,
  totalsOf,
  customerMap,
} from "../../infrastructure/store";
import { stageLabel } from "../../modules/quotations/service";
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
} from "lucide-react";

interface QuotationsListViewProps {
  onSelectQuote: (id: string) => void;
  onCreateNew: () => void;
}

export function QuotationsListView({
  onSelectQuote,
  onCreateNew,
}: QuotationsListViewProps) {
  const state = useAppState();
  const customers = customerMap(state);

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Quotations & Deals</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage commercial bids, revisions, customer negotiations, and approval statuses.
          </p>
        </div>
        <Button size="sm" onClick={onCreateNew} className="h-8 text-xs font-medium">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Create Quotation
        </Button>
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
                <SelectItem value="FULFILLMENT" className="text-xs">Fulfillment</SelectItem>
                <SelectItem value="INVOICED" className="text-xs">Invoiced</SelectItem>
                <SelectItem value="PAID" className="text-xs">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quotations Table */}
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
    </div>
  );
}
