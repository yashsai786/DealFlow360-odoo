import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import {
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  CheckCircle2,
  Users,
  AlertCircle,
  Building2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAppState, identityActions } from "../../infrastructure/store";
import type { Role, User, CustomerTier } from "../../modules/shared/types";
import { ROLE_LABELS } from "../../modules/identity/service";

interface AuthViewProps {
  onSuccess?: (user: User) => void;
  defaultTab?: "login" | "signup";
}

export function AuthView({ onSuccess, defaultTab = "login" }: AuthViewProps) {
  const state = useAppState();
  const [activeTab, setActiveTab] = useState<"login" | "signup">(defaultTab);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Sign Up Form State
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupRole, setSignupRole] = useState<Role>("SALES_REP");
  const [signupCustomerId, setSignupCustomerId] = useState<string>(
    state.customers[0]?.id ?? "c-acme"
  );
  const [customerMode, setCustomerMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyIndustry, setNewCompanyIndustry] = useState("Technology");
  const [newCompanyTier, setNewCompanyTier] = useState<CustomerTier>("Bronze");
  const [signupLoading, setSignupLoading] = useState(false);

  // Check if entered email/id is already registered
  const isAlreadyRegistered =
    signupEmail.trim().length > 3 &&
    state.users.some(
      (u) => u.email.toLowerCase() === signupEmail.trim().toLowerCase()
    );

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      toast.error("Please enter your email address");
      return;
    }
    if (!loginPassword) {
      toast.error("Please enter your password");
      return;
    }

    setLoginLoading(true);
    try {
      const user = await identityActions.login(loginEmail.trim(), loginPassword);
      setLoginLoading(false);
      if (user) {
        if (user.role === "CUSTOMER") {
          sessionStorage.setItem("df360_active_tab", "portal");
        }
        toast.success(`Welcome back, ${user.name}!`, {
          description: `Signed in as ${ROLE_LABELS[user.role] ?? user.role}`,
        });
        onSuccess?.(user);
      }
    } catch (err: any) {
      setLoginLoading(false);
      toast.error("Authentication failed", {
        description: err.message || "Invalid email address or password.",
      });
    }
  };

  // Handle Quick Demo Login via Authentic Credentials
  const handleQuickLogin = async (demoUser: User) => {
    setLoginEmail(demoUser.email);
    setLoginPassword("DealFlow@2026");
    setLoginLoading(true);
    try {
      const user = await identityActions.login(demoUser.email, "DealFlow@2026");
      setLoginLoading(false);
      if (user) {
        if (user.role === "CUSTOMER") {
          sessionStorage.setItem("df360_active_tab", "portal");
        }
        toast.success(`Welcome back, ${user.name}!`, {
          description: `Signed in as ${ROLE_LABELS[user.role] ?? user.role}`,
        });
        onSuccess?.(user);
      }
    } catch (err: any) {
      setLoginLoading(false);
      toast.error("Authentication failed", {
        description: err.message || "Invalid email address or password.",
      });
    }
  };

  // Handle Sign Up
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupName.trim()) {
      toast.error("Please enter your full name");
      return;
    }
    if (!signupEmail.trim() || !signupEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!signupPassword || signupPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (isAlreadyRegistered) {
      toast.error("This email / ID is already registered. Please sign in instead.");
      return;
    }

    if (signupRole === "CUSTOMER" && customerMode === "NEW" && !newCompanyName.trim()) {
      toast.error("Please enter your company or organization name");
      return;
    }

    setSignupLoading(true);
    try {
      const newUser = await identityActions.signup(
        signupName,
        signupEmail,
        signupRole,
        signupRole === "CUSTOMER" && customerMode === "EXISTING" ? signupCustomerId : undefined,
        signupPassword,
        signupRole === "CUSTOMER" && customerMode === "NEW"
          ? {
              name: newCompanyName.trim(),
              industry: newCompanyIndustry,
              tier: newCompanyTier,
            }
          : undefined
      );
      setSignupLoading(false);
      if (newUser.role === "CUSTOMER") {
        sessionStorage.setItem("df360_active_tab", "portal");
      }
      toast.success("Account created & secured!", {
        description: `Welcome to DealFlow360, ${newUser.name}.${
          customerMode === "NEW" ? ` Registered company "${newCompanyName.trim()}".` : ""
        } Credentials safely encrypted.`,
      });
      onSuccess?.(newUser);
    } catch (err: any) {
      setSignupLoading(false);
      toast.error(err.message || "Failed to create account");
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-lg">
        <Card className="shadow-lg border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center mb-2">
                <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm tracking-wider">
                  DF
                </div>
              </div>
              <CardTitle className="text-xl font-bold">
                {activeTab === "login" ? "Sign In to DealFlow360" : "Create DealFlow360 Account"}
              </CardTitle>
              <CardDescription className="text-xs">
                {activeTab === "login"
                  ? "Enter your credentials or choose a quick demo persona to explore."
                  : "Register a new profile to access quotes, approvals, and fulfillment."}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as "login" | "signup")}
                className="w-full"
              >
                <TabsList className="grid grid-cols-2 mb-4 w-full">
                  <TabsTrigger value="login" className="text-xs font-medium">
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="text-xs font-medium">
                    Sign Up
                  </TabsTrigger>
                </TabsList>

                {/* SIGN IN TAB */}
                <TabsContent value="login" className="space-y-4">
                  <form onSubmit={handleLogin} className="space-y-3.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs">
                        Work Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="rep@dealflow360.io"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="pl-8 text-xs h-9"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-xs">
                          Password
                        </Label>
                        <span className="text-[11px] text-muted-foreground hover:text-primary cursor-pointer">
                          Forgot password?
                        </span>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="pl-8 text-xs h-9"
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full text-xs h-9 font-medium"
                      disabled={loginLoading}
                    >
                      {loginLoading ? "Authenticating..." : "Sign In"}
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </form>

                  {/* 1-Click Quick Demo Sign In */}
                  <div className="pt-3 border-t border-border space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Instant Demo Sign-In
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Click any role to test
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {state.users.slice(0, 6).map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleQuickLogin(u)}
                          className="text-left p-2 rounded-md border border-border bg-card hover:bg-muted hover:border-primary/50 transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-foreground group-hover:text-primary truncate">
                              {u.name.split(" ")[0]}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-[9px] py-0 px-1 font-mono font-normal"
                            >
                              {u.role.replace("SALES_", "").slice(0, 4)}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {ROLE_LABELS[u.role] ?? u.role}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* SIGN UP TAB */}
                <TabsContent value="signup" className="space-y-4">
                  <form onSubmit={handleSignup} className="space-y-3.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-name" className="text-xs">
                        Full Name
                      </Label>
                      <div className="relative">
                        <UserIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="e.g. Alex Morgan"
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                          className="pl-8 text-xs h-9"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-email" className="text-xs">
                        Work Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="alex.morgan@dealflow.io"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          className="pl-8 text-xs h-9"
                          required
                        />
                      </div>
                      {isAlreadyRegistered && (
                        <p className="text-[11px] text-destructive font-medium flex items-center gap-1.5 mt-1 animate-in fade-in">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          This email / ID is already registered.
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-password" className="text-xs">
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="At least 4 characters"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          className="pl-8 text-xs h-9"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-role" className="text-xs">
                        Role & Permissions
                      </Label>
                      <Select
                        value={signupRole}
                        onValueChange={(val) => setSignupRole(val as Role)}
                      >
                        <SelectTrigger id="signup-role" className="text-xs h-9">
                          <SelectValue placeholder="Select Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SALES_REP" className="text-xs">
                            Sales Representative
                          </SelectItem>
                          <SelectItem value="SALES_MANAGER" className="text-xs">
                            Sales Manager
                          </SelectItem>
                          <SelectItem value="FINANCE" className="text-xs">
                            Finance & Operations
                          </SelectItem>
                          <SelectItem value="ADMIN" className="text-xs">
                            Administrator
                          </SelectItem>
                          <SelectItem value="CUSTOMER" className="text-xs">
                            Customer (External Portal)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {signupRole === "CUSTOMER" && (
                      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/30 p-2.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                            <Building2 className="h-3.5 w-3.5 text-primary" />
                            Company Account
                          </Label>
                          <div className="flex items-center bg-muted rounded-md p-0.5 text-[11px] border border-border/60">
                            <button
                              type="button"
                              onClick={() => setCustomerMode("EXISTING")}
                              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                                customerMode === "EXISTING"
                                  ? "bg-background text-foreground shadow-xs font-semibold"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              Select Existing
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomerMode("NEW")}
                              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                                customerMode === "NEW"
                                  ? "bg-background text-primary shadow-xs font-semibold"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <Sparkles className="h-2.5 w-2.5" />
                              + New Company
                            </button>
                          </div>
                        </div>

                        {customerMode === "EXISTING" ? (
                          <div className="space-y-1.5">
                            <Select
                              value={signupCustomerId}
                              onValueChange={(val) => setSignupCustomerId(val)}
                            >
                              <SelectTrigger id="signup-customer" className="text-xs h-9 bg-background">
                                <SelectValue placeholder="Select Company" />
                              </SelectTrigger>
                              <SelectContent className="max-h-56">
                                {state.customers.map((c) => (
                                  <SelectItem key={c.id} value={c.id} className="text-xs">
                                    {c.name} ({c.tier})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-[10.5px] text-muted-foreground leading-tight">
                              Join an established enterprise account to immediately view shared quotations, contracts, and invoices.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2 pt-1">
                            <div className="space-y-1">
                              <Label htmlFor="new-company-name" className="text-[11px] text-muted-foreground font-medium">
                                Company / Organization Name <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                id="new-company-name"
                                placeholder="e.g. Stark Global Dynamics"
                                value={newCompanyName}
                                onChange={(e) => setNewCompanyName(e.target.value)}
                                className="text-xs h-8.5 bg-background"
                                required={customerMode === "NEW"}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground font-medium">Industry</Label>
                                <Select
                                  value={newCompanyIndustry}
                                  onValueChange={(val) => setNewCompanyIndustry(val)}
                                >
                                  <SelectTrigger className="text-xs h-8 bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Technology" className="text-xs">Technology</SelectItem>
                                    <SelectItem value="Manufacturing" className="text-xs">Manufacturing</SelectItem>
                                    <SelectItem value="Healthcare" className="text-xs">Healthcare</SelectItem>
                                    <SelectItem value="Financial Services" className="text-xs">Financial Services</SelectItem>
                                    <SelectItem value="Retail & Logistics" className="text-xs">Retail & Logistics</SelectItem>
                                    <SelectItem value="Energy & Utilities" className="text-xs">Energy & Utilities</SelectItem>
                                    <SelectItem value="Consulting" className="text-xs">Consulting</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground font-medium">Default Tier</Label>
                                <Select
                                  value={newCompanyTier}
                                  onValueChange={(val) => setNewCompanyTier(val as CustomerTier)}
                                >
                                  <SelectTrigger className="text-xs h-8 bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Bronze" className="text-xs">Bronze (Standard 5%)</SelectItem>
                                    <SelectItem value="Silver" className="text-xs">Silver (Preferred 10%)</SelectItem>
                                    <SelectItem value="Gold" className="text-xs">Gold (Enterprise 15%)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <p className="text-[10.5px] text-muted-foreground leading-tight">
                              Creates a new client account entity and sets you as its primary procurement officer.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full text-xs h-9 font-medium mt-2"
                      disabled={signupLoading}
                    >
                      {signupLoading ? "Registering..." : "Create Account & Sign In"}
                      <CheckCircle2 className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
