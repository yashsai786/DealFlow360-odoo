import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { ScrollArea } from "../../components/ui/scroll-area";
import {
  User as UserIcon,
  Mail,
  Shield,
  ShieldCheck,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  LogOut,
  Save,
  KeyRound,
  Briefcase,
  History,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useAppState, identityActions } from "../../infrastructure/store";
import { ROLE_LABELS, can, type Permission } from "../../modules/identity/service";
import type { NavTab } from "../../components/layout/AppShell";

interface ProfileViewProps {
  onNavigate?: (tab: NavTab, extraId?: string) => void;
}

const ALL_PERMISSIONS: { key: Permission; label: string; module: string; description: string }[] = [
  {
    key: "quotation.create",
    label: "Create Quotations",
    module: "Quotations",
    description: "Initialize new commercial quotes for customer accounts",
  },
  {
    key: "quotation.edit",
    label: "Edit Lines & Discounts",
    module: "Quotations",
    description: "Modify items, quantities, and line-item discounts",
  },
  {
    key: "quotation.submit",
    label: "Submit for Approval",
    module: "Quotations",
    description: "Submit quotes exceeding discount risk ceilings for approval",
  },
  {
    key: "quotation.confirm",
    label: "Confirm & Finalize Order",
    module: "Quotations",
    description: "Lock deals and advance directly to fulfillment and billing",
  },
  {
    key: "approval.decide",
    label: "Sales Manager Review",
    module: "Approvals",
    description: "Approve, Return, or Reject quotes with discount risk violations",
  },
  {
    key: "approval.finance",
    label: "Finance Review & Override",
    module: "Approvals",
    description: "Authorize high-risk quotations with custom payment conditions",
  },
  {
    key: "fulfillment.manage",
    label: "Warehouse Fulfillment",
    module: "Fulfillment",
    description: "Run split optimization, manage stock backorders and shipping",
  },
  {
    key: "billing.manage",
    label: "Subscription Billing",
    module: "Billing",
    description: "Configure billing cycles, execute mid-cycle proration",
  },
  {
    key: "invoice.payment",
    label: "Record Invoices & Payments",
    module: "Invoicing",
    description: "Record partial payments and reconcile invoice balances",
  },
  {
    key: "dealhealth.view",
    label: "Deal Health Analytics",
    module: "Intelligence",
    description: "Inspect stalled quotes, discount anomalies, and send rep nudges",
  },
  {
    key: "reports.view",
    label: "Executive Reporting",
    module: "Reports",
    description: "View sales rep performance tables, export audit logs and CSVs",
  },
  {
    key: "admin.configure",
    label: "Platform Governance & Admin",
    module: "Administration",
    description: "Configure tier ceilings, category caps, warehouses, and plans",
  },
  {
    key: "portal.use",
    label: "Customer Portal Access",
    module: "Customer Portal",
    description: "Review quotations, submit counter discounts, and chat in negotiation",
  },
];

export function ProfileView({ onNavigate }: ProfileViewProps) {
  const state = useAppState();
  const session = state.session;

  const [name, setName] = useState(session?.name ?? "");
  const [email, setEmail] = useState(session?.email ?? "");
  const [isSaving, setIsSaving] = useState(false);

  // Synchronize with session
  useEffect(() => {
    if (session) {
      setName(session.name);
      setEmail(session.email);
    }
  }, [session]);

  if (!session) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground text-sm">No active session found.</p>
        <Button onClick={() => onNavigate?.("dashboard")} size="sm">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const customerObj = session.customerId
    ? state.customers.find((c) => c.id === session.customerId)
    : null;

  // Filter personal audit records
  const personalAudit = state.audit.filter(
    (a) => a.actor.toLowerCase() === session.name.toLowerCase()
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast.error("Valid email required");
      return;
    }

    setIsSaving(true);
    try {
      await identityActions.updateProfile(session.id, { name, email });
      setIsSaving(false);
      toast.success("Profile details updated & saved to database!");
    } catch {
      setIsSaving(false);
      toast.error("Failed to update profile");
    }
  };

  const handleLogout = () => {
    identityActions.logout();
    toast.info("Signed out of DealFlow360");
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl border-2 border-primary/20 shrink-0">
            {session.name.charAt(0)}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {session.name}
              </h1>
              <Badge variant="default" className="text-xs">
                {ROLE_LABELS[session.role] ?? session.role}
              </Badge>
              {customerObj && (
                <Badge variant="outline" className="text-xs flex items-center gap-1 font-mono">
                  <Building2 className="h-3 w-3" />
                  {customerObj.name} ({customerObj.tier})
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {session.email}
              </span>
              <span className="font-mono text-[11px]">ID: {session.id}</span>
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Authenticated Session
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Tabs Section */}
      <Tabs defaultValue="overview" className="w-full space-y-4">
        <TabsList className="grid grid-cols-1 sm:grid-cols-3 w-full md:w-auto h-auto p-1 gap-1">
          <TabsTrigger value="overview" className="text-xs py-2">
            Profile Settings
          </TabsTrigger>
          <TabsTrigger value="permissions" className="text-xs py-2">
            Role Permissions ({ALL_PERMISSIONS.filter((p) => can(session.role, p.key)).length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs py-2">
            Activity History ({personalAudit.length})
          </TabsTrigger>
        </TabsList>

        {/* 1. PROFILE SETTINGS */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-primary" />
                    Personal Information
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Update your display name and communications email address.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleSaveProfile}>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="prof-name" className="text-xs">
                          Full Name
                        </Label>
                        <Input
                          id="prof-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="text-xs h-9"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="prof-email" className="text-xs">
                          Email Address
                        </Label>
                        <Input
                          id="prof-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="text-xs h-9"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Assigned Role</Label>
                        <div className="h-9 px-3 rounded-md border border-border bg-muted/40 flex items-center justify-between text-xs font-medium">
                          <span>{ROLE_LABELS[session.role] ?? session.role}</span>
                          <ShieldCheck className="h-4 w-4 text-primary" />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Role hierarchy is governed by system domain security.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Organization Context</Label>
                        <div className="h-9 px-3 rounded-md border border-border bg-muted/40 flex items-center justify-between text-xs">
                          <span>
                            {customerObj
                              ? `${customerObj.name} (${customerObj.industry})`
                              : "DealFlow Enterprise"}
                          </span>
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-border pt-3 flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSaving}
                      className="text-xs flex items-center gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>

            {/* Security Card */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" />
                    Security & Session
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Current authentication parameters
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3.5 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium text-emerald-600">Active</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">Authentication</span>
                    <span className="font-mono text-[11px]">Passkey / Token</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">Encryption</span>
                    <span className="font-mono text-[11px]">TLS 1.3 / AES-256</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Access Scope</span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {session.role === "ADMIN" ? "Global Full" : "Role Bounded"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* 2. ROLE PERMISSIONS MATRIX */}
        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Granted Capabilities & RBAC Matrix
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Domain-driven access controls enforced for role:{" "}
                    <span className="font-semibold text-foreground">
                      {ROLE_LABELS[session.role]}
                    </span>
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs font-mono">
                  Role: {session.role}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ALL_PERMISSIONS.map((perm) => {
                  const hasPerm = can(session.role, perm.key);
                  return (
                    <div
                      key={perm.key}
                      className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                        hasPerm
                          ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                          : "border-border bg-muted/20 opacity-60 text-muted-foreground"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs">{perm.label}</span>
                          <span className="text-[10px] uppercase font-mono px-1 py-0.2 rounded bg-muted">
                            {perm.module}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {perm.description}
                        </p>
                      </div>
                      <div className="shrink-0 mt-0.5">
                        {hasPerm ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 flex items-center gap-1 font-mono"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Allowed
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-muted text-muted-foreground border-border flex items-center gap-1 font-mono"
                          >
                            <XCircle className="h-3 w-3" />
                            Denied
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. ACTIVITY HISTORY */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Personal Audit Trail
              </CardTitle>
              <CardDescription className="text-xs">
                Immutable chronological ledger of all actions authored by {session.name}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {personalAudit.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs space-y-1">
                  <Clock className="h-6 w-6 mx-auto opacity-40 mb-2" />
                  <p>No logged actions found for this user yet.</p>
                  <p className="text-[11px]">
                    Actions like creating quotes, recording payments, or changing plans will
                    appear here.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[360px] pr-4">
                  <div className="space-y-2.5">
                    {personalAudit.map((a) => (
                      <div
                        key={a.id}
                        className="p-3 rounded-lg border border-border bg-card text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{a.action}</span>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {a.entity} ({a.entityId})
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                          <span>Actor: {a.actor}</span>
                          <span className="text-[10px]">
                            {new Date(a.at).toLocaleString()}
                          </span>
                        </div>
                        {a.reason && (
                          <p className="text-[11px] text-muted-foreground italic bg-muted/40 p-1.5 rounded mt-1">
                            Reason: "{a.reason}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
