import React, { useState } from "react";
import {
  useAppState,
  productMap,
  customerMap,
} from "../../infrastructure/store";
import {
  getSalesMetrics,
  filterQuotations,
  filterOrders,
  type ReportFilters,
  DEFAULT_FILTERS,
  SALES_TEAMS,
  type PeriodType,
} from "../../modules/reporting/service";
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
  BarChart3,
  Download,
  Printer,
  TrendingUp,
  IndianRupee,
  Clock,
  Sparkles,
  Users,
  ShieldAlert,
  Calendar,
  Layers,
  FileSpreadsheet,
  RotateCcw,
  Package,
  Percent,
  Award,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

export function ReportingView() {
  const state = useAppState();
  const products = productMap(state);
  const customers = customerMap(state);
  const users = Object.fromEntries(state.users.map((u) => [u.id, u]));
  const quotationMap = Object.fromEntries(state.quotations.map((q) => [q.id, q]));

  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState<"quotations" | "orders">("quotations");

  // Filter quotations and orders according to period, team, rep, approval status, category, product
  const filteredQuotes = filterQuotations(state.quotations, products, filters, state.approvals);
  const filteredOrders = filterOrders(state.orders, quotationMap, filters);

  // Compute comprehensive metrics
  const metrics = getSalesMetrics(
    filteredQuotes,
    products,
    state.invoices,
    state.approvals,
    users,
    customers,
    filteredOrders,
  );

  // Export to native Microsoft Excel (.xls) with multi-sheet XML
  const handleExportXLS = () => {
    try {
      const nowStr = new Date().toLocaleDateString();
      const quoteRows = filteredQuotes.map((q) => {
        const cust = customers[q.customerId]?.name ?? "Unknown";
        const owner = users[q.ownerId]?.name ?? "Rep";
        const gross = q.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
        const disc = gross
          ? (q.lines.reduce((s, l) => s + (l.qty * l.unitPrice * l.discountPct) / 100, 0) / gross) * 100
          : 0;
        const net = gross - (gross * disc) / 100;
        return `
        <Row>
          <Cell><Data ss:Type="String">${q.number}</Data></Cell>
          <Cell><Data ss:Type="String">${cust.replace(/&/g, "&amp;")}</Data></Cell>
          <Cell><Data ss:Type="String">${q.stage}</Data></Cell>
          <Cell><Data ss:Type="String">${owner.replace(/&/g, "&amp;")}</Data></Cell>
          <Cell><Data ss:Type="Number">${gross.toFixed(2)}</Data></Cell>
          <Cell><Data ss:Type="Number">${disc.toFixed(1)}</Data></Cell>
          <Cell><Data ss:Type="Number">${net.toFixed(2)}</Data></Cell>
          <Cell><Data ss:Type="String">${new Date(q.createdAt).toLocaleDateString()}</Data></Cell>
        </Row>`;
      }).join("");

      const bestSellingRows = metrics.bestSellingProducts.map((p, idx) => `
        <Row>
          <Cell><Data ss:Type="Number">${idx + 1}</Data></Cell>
          <Cell><Data ss:Type="String">${p.name.replace(/&/g, "&amp;")}</Data></Cell>
          <Cell><Data ss:Type="String">${p.category}</Data></Cell>
          <Cell><Data ss:Type="Number">${p.unitsSold}</Data></Cell>
          <Cell><Data ss:Type="Number">${p.totalRevenue}</Data></Cell>
          <Cell><Data ss:Type="Number">${p.avgSellingPrice}</Data></Cell>
        </Row>
      `).join("");

      const discountRows = metrics.mostDiscountedProducts.map((p, idx) => `
        <Row>
          <Cell><Data ss:Type="Number">${idx + 1}</Data></Cell>
          <Cell><Data ss:Type="String">${p.name.replace(/&/g, "&amp;")}</Data></Cell>
          <Cell><Data ss:Type="String">${p.category}</Data></Cell>
          <Cell><Data ss:Type="Number">${p.quoteCount}</Data></Cell>
          <Cell><Data ss:Type="Number">${p.avgDiscountPct}</Data></Cell>
          <Cell><Data ss:Type="Number">${p.maxDiscountPct}</Data></Cell>
        </Row>
      `).join("");

      const xmlTemplate = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Quotations">
    <Table>
      <Column ss:Width="110"/>
      <Column ss:Width="160"/>
      <Column ss:Width="100"/>
      <Column ss:Width="120"/>
      <Column ss:Width="100"/>
      <Column ss:Width="90"/>
      <Column ss:Width="100"/>
      <Column ss:Width="90"/>
      <Row ss:StyleID="Header">
        <Cell><Data ss:Type="String">Quotation #</Data></Cell>
        <Cell><Data ss:Type="String">Customer</Data></Cell>
        <Cell><Data ss:Type="String">Stage</Data></Cell>
        <Cell><Data ss:Type="String">Sales Rep</Data></Cell>
        <Cell><Data ss:Type="String">Gross (INR)</Data></Cell>
        <Cell><Data ss:Type="String">Discount %</Data></Cell>
        <Cell><Data ss:Type="String">Net Total (INR)</Data></Cell>
        <Cell><Data ss:Type="String">Created Date</Data></Cell>
      </Row>
      ${quoteRows}
    </Table>
  </Worksheet>
  <Worksheet ss:Name="Best Selling Items">
    <Table>
      <Column ss:Width="40"/>
      <Column ss:Width="180"/>
      <Column ss:Width="120"/>
      <Column ss:Width="80"/>
      <Column ss:Width="110"/>
      <Column ss:Width="110"/>
      <Row ss:StyleID="Header">
        <Cell><Data ss:Type="String">Rank</Data></Cell>
        <Cell><Data ss:Type="String">Product</Data></Cell>
        <Cell><Data ss:Type="String">Category</Data></Cell>
        <Cell><Data ss:Type="String">Units Sold</Data></Cell>
        <Cell><Data ss:Type="String">Revenue (INR)</Data></Cell>
        <Cell><Data ss:Type="String">Avg Realized Price</Data></Cell>
      </Row>
      ${bestSellingRows}
    </Table>
  </Worksheet>
  <Worksheet ss:Name="Most Discounted Items">
    <Table>
      <Column ss:Width="40"/>
      <Column ss:Width="180"/>
      <Column ss:Width="120"/>
      <Column ss:Width="80"/>
      <Column ss:Width="100"/>
      <Column ss:Width="100"/>
      <Row ss:StyleID="Header">
        <Cell><Data ss:Type="String">Rank</Data></Cell>
        <Cell><Data ss:Type="String">Product</Data></Cell>
        <Cell><Data ss:Type="String">Category</Data></Cell>
        <Cell><Data ss:Type="String">Times Quoted</Data></Cell>
        <Cell><Data ss:Type="String">Avg Discount %</Data></Cell>
        <Cell><Data ss:Type="String">Max Discount %</Data></Cell>
      </Row>
      ${discountRows}
    </Table>
  </Worksheet>
</Workbook>`;

      const blob = new Blob([xmlTemplate], { type: "application/vnd.ms-excel;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dealflow360_sales_performance_${new Date().toISOString().slice(0, 10)}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Excel (.xls) report generated and downloaded successfully.");
    } catch (err: any) {
      toast.error("XLS export failed: " + err.message);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    try {
      const headers = ["QuotationNumber", "Customer", "Stage", "Owner", "Gross", "DiscountPct", "NetTotal", "Date"];
      const rows = filteredQuotes.map((q) => {
        const cust = customers[q.customerId]?.name ?? "Unknown";
        const owner = users[q.ownerId]?.name ?? "Rep";
        const gross = q.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
        const disc = gross
          ? (q.lines.reduce((s, l) => s + (l.qty * l.unitPrice * l.discountPct) / 100, 0) / gross) * 100
          : 0;
        const net = gross - (gross * disc) / 100;
        return [q.number, `"${cust}"`, q.stage, `"${owner}"`, gross.toFixed(2), disc.toFixed(1), net.toFixed(2), new Date(q.createdAt).toISOString().slice(0, 10)].join(",");
      });

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `dealflow360_sales_report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV report exported successfully.");
    } catch (err: any) {
      toast.error("CSV export failed: " + err.message);
    }
  };

  // PDF Export / Print
  const handleExportPDF = () => {
    window.print();
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    toast.info("Reporting filters reset to default (Last 90 Days).");
  };

  const productList = Object.values(products);

  return (
    <div className="space-y-6 print:p-6 print:space-y-4">
      {/* Header with Title & PDF/XLS Export Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Commercial Analytics & Executive Reporting
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Audit sales velocity, discount compliance, approval queue latency, fulfillment orders, and product performance.
          </p>
        </div>

        {/* Action Buttons: PDF and XLS Export */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-8 text-xs">
            <Printer className="h-3.5 w-3.5 mr-1.5 text-rose-500" />
            Export PDF / Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportXLS} className="h-8 text-xs font-medium">
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
            Export XLS
          </Button>
          <Button size="sm" onClick={handleExportCSV} className="h-8 text-xs font-medium">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Comprehensive Reporting Filters Bar (Period, Sales Team/Rep, Approval Status, Product/Category) */}
      <Card className="shadow-xs border border-border bg-card/70 print:hidden">
        <CardHeader className="p-3 pb-2 border-b border-border/60">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
              <Filter className="h-3.5 w-3.5 text-primary" />
              Reporting Filters & Segmentation
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-2"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* 1. Period: today, week, custom range */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3 text-primary" />
                Period
              </label>
              <Select
                value={filters.period}
                onValueChange={(val: PeriodType) => setFilters({ ...filters, period: val })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today" className="text-xs font-medium">Today</SelectItem>
                  <SelectItem value="week" className="text-xs font-medium">This Week (Last 7d)</SelectItem>
                  <SelectItem value="30" className="text-xs">Last 30 Days</SelectItem>
                  <SelectItem value="90" className="text-xs">Last 90 Days</SelectItem>
                  <SelectItem value="365" className="text-xs">Past 12 Months</SelectItem>
                  <SelectItem value="custom" className="text-xs text-primary font-semibold">Custom Range...</SelectItem>
                  <SelectItem value="all" className="text-xs">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 2. Sales Team */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3 text-blue-500" />
                Sales Team
              </label>
              <Select
                value={filters.team}
                onValueChange={(val) => setFilters({ ...filters, team: val, ownerId: "all" })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Teams</SelectItem>
                  {SALES_TEAMS.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Sales Rep */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3 text-emerald-500" />
                Responsible Rep
              </label>
              <Select
                value={filters.ownerId}
                onValueChange={(val) => setFilters({ ...filters, ownerId: val })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Representatives" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Representatives</SelectItem>
                  {state.users
                    .filter((u) => u.role === "SALES_REP")
                    .filter((u) => {
                      if (filters.team === "all") return true;
                      const t = SALES_TEAMS.find((team) => team.id === filters.team);
                      return t ? t.repIds.includes(u.id) : true;
                    })
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">
                        {u.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* 4. Approval Status */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <ShieldAlert className="h-3 w-3 text-amber-500" />
                Approval Status
              </label>
              <Select
                value={filters.approvalStatus}
                onValueChange={(val) => setFilters({ ...filters, approvalStatus: val })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Approval Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                  <SelectItem value="PENDING" className="text-xs text-amber-600 font-medium">Pending Approval</SelectItem>
                  <SelectItem value="APPROVED" className="text-xs text-emerald-600 font-medium">Approved</SelectItem>
                  <SelectItem value="REJECTED" className="text-xs text-rose-600 font-medium">Rejected / Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 5. Product Category */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Layers className="h-3 w-3 text-purple-500" />
                Category
              </label>
              <Select
                value={filters.category}
                onValueChange={(val) => setFilters({ ...filters, category: val, productId: "all" })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Categories</SelectItem>
                  <SelectItem value="Hardware" className="text-xs">Hardware</SelectItem>
                  <SelectItem value="Services" className="text-xs">Services</SelectItem>
                  <SelectItem value="Subscriptions" className="text-xs">Subscriptions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sub-row: Specific Product filter & Custom Date Range inputs */}
          <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap items-center gap-4">
            {/* Specific Product */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Specific Product:</span>
              <Select
                value={filters.productId}
                onValueChange={(val) => setFilters({ ...filters, productId: val })}
              >
                <SelectTrigger className="h-7 text-xs w-48">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Products</SelectItem>
                  {productList
                    .filter((p) => filters.category === "all" || p.category === filters.category)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quotation Stage Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Stage:</span>
              <Select
                value={filters.stage}
                onValueChange={(val) => setFilters({ ...filters, stage: val })}
              >
                <SelectTrigger className="h-7 text-xs w-36">
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Stages</SelectItem>
                  <SelectItem value="DRAFT" className="text-xs">Draft</SelectItem>
                  <SelectItem value="PENDING_APPROVAL" className="text-xs">Pending Approval</SelectItem>
                  <SelectItem value="APPROVED" className="text-xs">Approved</SelectItem>
                  <SelectItem value="CONFIRMED" className="text-xs">Confirmed</SelectItem>
                  <SelectItem value="FULFILLMENT" className="text-xs">Fulfillment</SelectItem>
                  <SelectItem value="INVOICED" className="text-xs">Invoiced</SelectItem>
                  <SelectItem value="PAID" className="text-xs">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range Picker (shown when period === "custom") */}
            {filters.period === "custom" && (
              <div className="flex items-center gap-2 bg-muted/40 p-1.5 rounded-md border border-border">
                <span className="text-xs font-medium text-primary">Date Range:</span>
                <input
                  type="date"
                  value={filters.customStartDate ?? ""}
                  onChange={(e) => setFilters({ ...filters, customStartDate: e.target.value })}
                  className="h-6 text-xs bg-background border border-input rounded px-1.5 text-foreground"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="date"
                  value={filters.customEndDate ?? ""}
                  onChange={(e) => setFilters({ ...filters, customEndDate: e.target.value })}
                  className="h-6 text-xs bg-background border border-input rounded px-1.5 text-foreground"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <Card className="shadow-xs p-3">
          <div className="text-[11px] text-muted-foreground font-medium">Bids Generated</div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">{metrics.quotesCreated}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Matching filter</div>
        </Card>

        <Card className="shadow-xs p-3">
          <div className="text-[11px] text-muted-foreground font-medium">Orders in Period</div>
          <div className="text-xl font-bold font-mono text-blue-600 mt-1">{metrics.orderCount}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{metrics.ordersShipped} shipped</div>
        </Card>

        <Card className="shadow-xs p-3">
          <div className="text-[11px] text-muted-foreground font-medium">Revenue Booked</div>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-1">
            ₹{metrics.revenue.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600/80 mt-0.5">Collected</div>
        </Card>

        <Card className="shadow-xs p-3">
          <div className="text-[11px] text-muted-foreground font-medium">Active Pipeline</div>
          <div className="text-xl font-bold font-mono text-primary mt-1">
            ₹{metrics.pipeline.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Open deals</div>
        </Card>

        <Card className="shadow-xs p-3">
          <div className="text-[11px] text-muted-foreground font-medium">Win / Conversion</div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">{metrics.conversionRate}%</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Closed won</div>
        </Card>

        <Card className="shadow-xs p-3">
          <div className="text-[11px] text-muted-foreground font-medium">Avg Discount</div>
          <div className="text-xl font-bold font-mono text-amber-600 mt-1">{metrics.avgDiscountPct}%</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Across lines</div>
        </Card>

        <Card className="shadow-xs p-3">
          <div className="text-[11px] text-muted-foreground font-medium">Approval Lag</div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {metrics.avgApprovalHours}h
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Avg turnaround</div>
        </Card>
      </div>

      {/* Product Analytics: Best Selling Items & Most Discounted Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best Selling Items Table */}
        <Card className="shadow-xs border border-border">
          <CardHeader className="p-4 pb-2 border-b border-border flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Award className="h-4 w-4 text-emerald-600" />
                Best Selling Items (Units & Revenue)
              </CardTitle>
              <CardDescription className="text-[11px]">
                Ranked by customer volume adoption and total booked turnover
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-600">
              Top Performers
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Units Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Avg Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {metrics.bestSellingProducts.slice(0, 6).map((item, idx) => (
                  <TableRow key={item.productId}>
                    <TableCell className="font-mono text-muted-foreground text-[11px]">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      <div className="flex items-center gap-1.5">
                        {idx === 0 && <span className="text-amber-500">★</span>}
                        {item.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-foreground">
                      {item.unitsSold}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-600">
                      ₹{item.totalRevenue.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground text-[11px]">
                      ₹{item.avgSellingPrice.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {metrics.bestSellingProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-xs">
                      No sales recorded in the selected period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Most Discounted Items Table */}
        <Card className="shadow-xs border border-border">
          <CardHeader className="p-4 pb-2 border-b border-border flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Percent className="h-4 w-4 text-amber-600" />
                Most Discounted Items (Margin Risk)
              </CardTitle>
              <CardDescription className="text-[11px]">
                Products with highest average discount granted during quotation creation
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-600">
              Discount Audit
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Quoted</TableHead>
                  <TableHead className="text-right">Avg Discount</TableHead>
                  <TableHead className="text-right">Max Discount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {metrics.mostDiscountedProducts.slice(0, 6).map((item, idx) => (
                  <TableRow key={item.productId}>
                    <TableCell className="font-mono text-muted-foreground text-[11px]">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      {item.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {item.quoteCount}x
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-amber-600">
                      {item.avgDiscountPct}%
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <Badge
                        variant={item.maxDiscountPct > 20 ? "destructive" : "outline"}
                        className="text-[10px] font-mono py-0 px-1.5"
                      >
                        {item.maxDiscountPct}% max
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {metrics.mostDiscountedProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-xs">
                      No discount activity recorded in the selected period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Team & Representative Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Team Performance */}
        <Card className="shadow-xs border border-border">
          <CardHeader className="p-4 pb-2 border-b border-border">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              Sales Team Performance Overview
            </CardTitle>
            <CardDescription className="text-[11px]">
              Aggregate team output, active deal pipeline, and margin discipline
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead>Sales Team</TableHead>
                  <TableHead>Reps</TableHead>
                  <TableHead className="text-right">Quotes</TableHead>
                  <TableHead className="text-right">Pipeline Value</TableHead>
                  <TableHead className="text-right">Avg Discount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {metrics.byTeam.map((t) => (
                  <TableRow key={t.teamId}>
                    <TableCell className="font-semibold text-foreground">{t.teamName}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {t.reps.join(", ")}
                    </TableCell>
                    <TableCell className="text-right font-mono">{t.quotesCount}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-foreground">
                      ₹{t.totalValue.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-amber-600">
                      {t.avgDiscount}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Rep Individual Performance Ledger */}
        <Card className="shadow-xs border border-border">
          <CardHeader className="p-4 pb-2 border-b border-border">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Users className="h-4 w-4 text-emerald-600" />
              Individual Sales Representative Ledger
            </CardTitle>
            <CardDescription className="text-[11px]">
              Individual rep quota attainment, deal flow volume, and concession habits
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead>Representative</TableHead>
                  <TableHead className="text-right">Quotes</TableHead>
                  <TableHead className="text-right">Total Quoted</TableHead>
                  <TableHead className="text-right">Avg Discount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {metrics.byRep.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold text-foreground">{r.rep}</TableCell>
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
      </div>

      {/* Operational Diagnostic & Trend Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Approval Bottlenecks */}
        <Card className="shadow-xs border border-border">
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
                  <TableHead>Role</TableHead>
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

        {/* Monthly Pipeline Velocity */}
        <Card className="shadow-xs border border-border">
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

      {/* Quotations & Orders Period Activity Table */}
      <Card className="shadow-xs border border-border">
        <CardHeader className="p-4 pb-2 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-xs font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Activity Ledger: Quotations &amp; Orders in Filtered Period
            </CardTitle>
            <CardDescription className="text-[11px]">
              Inspecting {filteredQuotes.length} quotations and {filteredOrders.length} fulfillment orders
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 print:hidden">
            <Button
              variant={activeTab === "quotations" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("quotations")}
              className="h-7 text-xs"
            >
              Quotations ({filteredQuotes.length})
            </Button>
            <Button
              variant={activeTab === "orders" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("orders")}
              className="h-7 text-xs"
            >
              Fulfillment Orders ({filteredOrders.length})
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {activeTab === "quotations" ? (
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead>Quote #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Sales Rep</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Net Total</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {filteredQuotes.map((q) => {
                  const cust = customers[q.customerId]?.name ?? "Unknown";
                  const owner = users[q.ownerId]?.name ?? "Rep";
                  const gross = q.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
                  const disc = gross
                    ? (q.lines.reduce((s, l) => s + (l.qty * l.unitPrice * l.discountPct) / 100, 0) / gross) * 100
                    : 0;
                  const net = gross - (gross * disc) / 100;

                  return (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono font-bold text-foreground">{q.number}</TableCell>
                      <TableCell>{cust}</TableCell>
                      <TableCell className="text-muted-foreground">{owner}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {q.stage}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        ₹{gross.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-amber-600">
                        {disc.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-foreground">
                        ₹{net.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-right text-[11px] text-muted-foreground">
                        {new Date(q.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredQuotes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-muted-foreground text-xs">
                      No quotations match the selected filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead>Order ID</TableHead>
                  <TableHead>Quotation</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Fulfillment Status</TableHead>
                  <TableHead>Allocations</TableHead>
                  <TableHead className="text-right">Due Date</TableHead>
                  <TableHead className="text-right">Order Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {filteredOrders.map((o) => {
                  const q = quotationMap[o.quotationId];
                  const cust = q ? customers[q.customerId]?.name ?? "Customer" : "Customer";
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono font-bold text-foreground">{o.id}</TableCell>
                      <TableCell className="font-mono">{q?.number ?? o.quotationId}</TableCell>
                      <TableCell>{cust}</TableCell>
                      <TableCell>
                        <Badge
                          variant={o.status === "SHIPPED" ? "default" : o.status === "BACKORDERED" ? "destructive" : "secondary"}
                          className="text-[10px] font-mono"
                        >
                          {o.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {o.allocations.length} line(s) allocated
                      </TableCell>
                      <TableCell className="text-right text-[11px]">
                        {new Date(o.dueAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right text-[11px] text-muted-foreground">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-xs">
                      No fulfillment orders match the selected filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
