import React, { useState } from "react";
import {
  useAppState,
  productMap,
  customerMap,
} from "../../infrastructure/store";
import {
  getSalesMetrics,
  filterQuotations,
  type ReportFilters,
  DEFAULT_FILTERS,
} from "../../modules/reporting/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
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
  BarChart3,
  Download,
  Printer,
  TrendingUp,
  IndianRupee,
  Clock,
  Sparkles,
  Users,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

export function ReportingView() {
  const state = useAppState();
  const products = productMap(state);
  const customers = customerMap(state);
  const users = Object.fromEntries(state.users.map((u) => [u.id, u]));

  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);

  // Filter quotations
  const filtered = filterQuotations(state.quotations, products, filters);

  // Compute metrics
  const metrics = getSalesMetrics(
    filtered,
    products,
    state.invoices,
    state.approvals,
    users,
    customers,
  );

  // Real CSV Export
  const handleExportCSV = () => {
    try {
      const headers = ["QuotationNumber", "Customer", "Stage", "Owner", "Gross", "DiscountPct", "NetTotal"];
      const rows = filtered.map((q) => {
        const cust = customers[q.customerId]?.name ?? "Unknown";
        const owner = users[q.ownerId]?.name ?? "Rep";
        const gross = q.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
        const disc = gross ? (q.lines.reduce((s, l) => s + (l.qty * l.unitPrice * l.discountPct) / 100, 0) / gross) * 100 : 0;
        const net = gross - (gross * disc) / 100;
        return [q.number, `"${cust}"`, q.stage, `"${owner}"`, gross.toFixed(2), disc.toFixed(2), net.toFixed(2)].join(",");
      });

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `dealflow360_sales_report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Sales report CSV exported successfully.");
    } catch (err: any) {
      toast.error("Export failed: " + err.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Commercial Analytics & Executive Reporting</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit sales velocity, discount behavior, approval queue latency, and upsell conversion.
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs">
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Print Report
          </Button>
          <Button size="sm" onClick={handleExportCSV} className="h-8 text-xs font-medium">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV / XLS
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="shadow-xs print:hidden">
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Time Horizon:</span>
            <Select
              value={filters.period}
              onValueChange={(val: any) => setFilters({ ...filters, period: val })}
            >
              <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30" className="text-xs">Last 30 Days</SelectItem>
                <SelectItem value="90" className="text-xs">Last 90 Days</SelectItem>
                <SelectItem value="365" className="text-xs">Past 12 Months</SelectItem>
                <SelectItem value="all" className="text-xs">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Sales Rep:</span>
            <Select
              value={filters.ownerId}
              onValueChange={(val) => setFilters({ ...filters, ownerId: val })}
            >
              <SelectTrigger className="h-7 text-xs w-36">
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Representatives</SelectItem>
                {state.users
                  .filter((u) => u.role === "SALES_REP")
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">
                      {u.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Category:</span>
            <Select
              value={filters.category}
              onValueChange={(val) => setFilters({ ...filters, category: val })}
            >
              <SelectTrigger className="h-7 text-xs w-32">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Categories</SelectItem>
                <SelectItem value="Hardware" className="text-xs">Hardware</SelectItem>
                <SelectItem value="Services" className="text-xs">Services</SelectItem>
                <SelectItem value="Subscriptions" className="text-xs">Subscriptions</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Stage:</span>
            <Select
              value={filters.stage}
              onValueChange={(val) => setFilters({ ...filters, stage: val })}
            >
              <SelectTrigger className="h-7 text-xs w-32">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Stages</SelectItem>
                <SelectItem value="DRAFT" className="text-xs">Draft</SelectItem>
                <SelectItem value="APPROVED" className="text-xs">Approved</SelectItem>
                <SelectItem value="CONFIRMED" className="text-xs">Confirmed</SelectItem>
                <SelectItem value="PAID" className="text-xs">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="shadow-xs p-3">
          <div className="text-[11px] text-muted-foreground font-medium">Bids Generated</div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">{metrics.quotesCreated}</div>
        </Card>

        <Card className="shadow-xs p-3">
          <div className="text-[11px] text-muted-foreground font-medium">Revenue Booked</div>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-1">
            ₹{metrics.revenue.toLocaleString()}
          </div>
        </Card>

        <Card className="shadow-xs p-3">
          <div className="text-[11px] text-muted-foreground font-medium">Active Pipeline</div>
          <div className="text-xl font-bold font-mono text-primary mt-1">
            ₹{metrics.pipeline.toLocaleString()}
          </div>
        </Card>

        <Card className="shadow-xs p-3">
          <div className="text-[11px] text-muted-foreground font-medium">Win / Conversion</div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">{metrics.conversionRate}%</div>
        </Card>

        <Card className="shadow-xs p-3">
          <div className="text-[11px] text-muted-foreground font-medium">Avg Discount</div>
          <div className="text-xl font-bold font-mono text-amber-600 mt-1">{metrics.avgDiscountPct}%</div>
        </Card>

        <Card className="shadow-xs p-3">
          <div className="text-[11px] text-muted-foreground font-medium">Avg Approval Lag</div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {metrics.avgApprovalHours} hrs
          </div>
        </Card>
      </div>

      {/* Detail Tables: Rep Performance & Approval Bottlenecks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rep Performance */}
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              Sales Representative Performance Ledger
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead>Representative</TableHead>
                  <TableHead className="text-right">Quotes</TableHead>
                  <TableHead className="text-right">Total Quoted</TableHead>
                  <TableHead className="text-right">Avg Discount Given</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {metrics.byRep.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold">{r.rep}</TableCell>
                    <TableCell className="text-right font-mono">{r.quotes}</TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      ₹{r.value.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-amber-600">
                      {r.avgDiscount}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Approval Bottlenecks */}
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" />
              Approval Queue Bottleneck Diagnostics
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead>Organizational Step</TableHead>
                  <TableHead className="text-right">Pending In Queue</TableHead>
                  <TableHead className="text-right">Average Lag Days</TableHead>
                  <TableHead className="text-right">Operational Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {metrics.bottlenecks.map((b, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold">{b.role}</TableCell>
                    <TableCell className="text-right font-mono">{b.pending}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-rose-600">
                      {b.avgDays} days
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={b.avgDays > 2 ? "destructive" : "secondary"}
                        className="text-[9px] uppercase font-mono py-0 px-1"
                      >
                        {b.avgDays > 2 ? "Delayed" : "Normal"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {metrics.bottlenecks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">
                      No active bottlenecks in approval chains.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Top Upsold Products & Monthly Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              Top Converted Upsell Add-on
            </CardTitle>
            <Badge variant="secondary" className="text-xs font-mono">
              {metrics.topUpsoldProduct}
            </Badge>
          </CardHeader>
          <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
            <p>
              Recommendations attached to Enterprise Laptop and Network Equipment orders demonstrate the highest attachment velocity when bundled during quotation creation.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Monthly Pipeline Velocity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Pipeline Quoted</TableHead>
                  <TableHead className="text-right">Booked Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {metrics.trend.map((t, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold">{t.month}</TableCell>
                    <TableCell className="text-right font-mono">₹{t.pipeline.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-600">
                      ₹{t.revenue.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
