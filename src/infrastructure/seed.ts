import type {
  Approval,
  ApprovalStep,
  AuditEntry,
  Customer,
  CustomerTier,
  DomainEvent,
  FulfillmentOrder,
  InventoryItem,
  Invoice,
  Product,
  ProductCategory,
  Quotation,
  QuotationLine,
  QuotationStage,
  Subscription,
  SubscriptionPlan,
  User,
  Warehouse,
  BillingCycle,
  Payment,
  Allocation,
  Backorder,
} from "../modules/shared/types";

const day = 86400000;
const nowTime = Date.now();
const ago = (d: number) => new Date(nowTime - d * day).toISOString();
const ahead = (d: number) => new Date(nowTime + d * day).toISOString();

// ==========================================
// 1. USERS (2 Admins, 5 Managers, 5 Finance, 10 Reps, 30 Customers)
// ==========================================
export const USERS: User[] = [
  // Admins (2)
  { id: "u-admin", name: "Sasha Idris", email: "admin@dealflow360.io", role: "ADMIN" },
  { id: "u-admin2", name: "Robert Sterling", email: "admin2@dealflow360.io", role: "ADMIN" },

  // Sales Managers (5)
  { id: "u-mgr", name: "Dana Whitfield", email: "manager@dealflow360.io", role: "SALES_MANAGER" },
  { id: "u-mgr2", name: "Vikram Singhania", email: "manager2@dealflow360.io", role: "SALES_MANAGER" },
  { id: "u-mgr3", name: "Elena Rostov", email: "manager3@dealflow360.io", role: "SALES_MANAGER" },
  { id: "u-mgr4", name: "Marcus Aurelius", email: "manager4@dealflow360.io", role: "SALES_MANAGER" },
  { id: "u-mgr5", name: "Sarah Jenkins", email: "manager5@dealflow360.io", role: "SALES_MANAGER" },

  // Finance Reviewers (5)
  { id: "u-fin", name: "Owen Vasquez", email: "finance@dealflow360.io", role: "FINANCE" },
  { id: "u-fin2", name: "David Chen", email: "finance2@dealflow360.io", role: "FINANCE" },
  { id: "u-fin3", name: "Ananya Sharma", email: "finance3@dealflow360.io", role: "FINANCE" },
  { id: "u-fin4", name: "Michael Scott", email: "finance4@dealflow360.io", role: "FINANCE" },
  { id: "u-fin5", name: "Rachel Green", email: "finance5@dealflow360.io", role: "FINANCE" },

  // Sales Representatives (10)
  { id: "u-rep1", name: "Priya Raman", email: "rep@dealflow360.io", role: "SALES_REP" },
  { id: "u-rep2", name: "Marcus Feld", email: "rep2@dealflow360.io", role: "SALES_REP" },
  { id: "u-rep3", name: "Aisha Patel", email: "rep3@dealflow360.io", role: "SALES_REP" },
  { id: "u-rep4", name: "Carlos Gomez", email: "rep4@dealflow360.io", role: "SALES_REP" },
  { id: "u-rep5", name: "Liam O'Connor", email: "rep5@dealflow360.io", role: "SALES_REP" },
  { id: "u-rep6", name: "Chloe Dupont", email: "rep6@dealflow360.io", role: "SALES_REP" },
  { id: "u-rep7", name: "Tarun Verma", email: "rep7@dealflow360.io", role: "SALES_REP" },
  { id: "u-rep8", name: "Yuki Tanaka", email: "rep8@dealflow360.io", role: "SALES_REP" },
  { id: "u-rep9", name: "James Wilson", email: "rep9@dealflow360.io", role: "SALES_REP" },
  { id: "u-rep10", name: "Fatima Al-Mansoor", email: "rep10@dealflow360.io", role: "SALES_REP" },

  // Customer Portal Accounts (Primary Seed Accounts)
  { id: "u-cust-acme", name: "Lena Ortiz", email: "acme@customer.io", role: "CUSTOMER", customerId: "c-acme" },
  { id: "u-cust-beta", name: "Ravi Kapoor", email: "beta@customer.io", role: "CUSTOMER", customerId: "c-beta" },
  { id: "u-cust-delta", name: "Suresh Nambiar", email: "delta@customer.io", role: "CUSTOMER", customerId: "c-delta" },
  { id: "u-cust-nova", name: "Emily Watson", email: "nova@customer.io", role: "CUSTOMER", customerId: "c-nova" },
  { id: "u-cust-zenith", name: "Dr. Arthur Vance", email: "zenith@customer.io", role: "CUSTOMER", customerId: "c-zenith" },
];

// ==========================================
// 2. CUSTOMERS (30 B2B Enterprise Accounts)
// ==========================================
const RAW_CUSTOMERS: { id: string; name: string; tier: CustomerTier; industry: string; email: string }[] = [
  { id: "c-acme", name: "Acme Corp", tier: "Gold", industry: "Manufacturing", email: "procurement@acme.test" },
  { id: "c-delta", name: "Delta Systems", tier: "Silver", industry: "Logistics", email: "buying@delta.test" },
  { id: "c-beta", name: "Beta Industries", tier: "Bronze", industry: "Construction", email: "ops@beta.test" },
  { id: "c-nova", name: "Nova Technologies", tier: "Gold", industry: "Software", email: "finance@nova.test" },
  { id: "c-zenith", name: "Zenith Solutions", tier: "Silver", industry: "Healthcare", email: "purchasing@zenith.test" },
  { id: "c-apex", name: "Apex Global Logistics", tier: "Gold", industry: "Supply Chain", email: "contracts@apex.test" },
  { id: "c-cyber", name: "CyberShield Networks", tier: "Gold", industry: "Cybersecurity", email: "security@cybershield.test" },
  { id: "c-quantum", name: "Quantum BioPharma", tier: "Gold", industry: "Pharmaceuticals", email: "lab-procure@quantumbio.test" },
  { id: "c-titan", name: "Titan Heavy Machinery", tier: "Silver", industry: "Heavy Industry", email: "gear@titan.test" },
  { id: "c-bluewave", name: "BlueWave Telecom", tier: "Gold", industry: "Telecommunications", email: "network@bluewave.test" },
  { id: "c-omni", name: "OmniRetail Partners", tier: "Bronze", industry: "E-Commerce", email: "buyer@omniretail.test" },
  { id: "c-stellar", name: "Stellar FinTech Labs", tier: "Gold", industry: "Banking & Finance", email: "finops@stellarfin.test" },
  { id: "c-horizon", name: "Horizon Automotive", tier: "Silver", industry: "Automotive", email: "supply@horizonauto.test" },
  { id: "c-vanguard", name: "Vanguard Aerospace", tier: "Gold", industry: "Aerospace & Defense", email: "contracts@vanguard.test" },
  { id: "c-green", name: "GreenEnergy Dynamics", tier: "Silver", industry: "Renewable Energy", email: "solar@greendynamics.test" },
  { id: "c-cloudscale", name: "CloudScale Media", tier: "Bronze", industry: "Digital Media", email: "content@cloudscale.test" },
  { id: "c-prime", name: "Prime Hospitality Group", tier: "Bronze", industry: "Hospitality", email: "procure@primehospitality.test" },
  { id: "c-metrorail", name: "MetroRail Infrastructure", tier: "Gold", industry: "Transportation", email: "railways@metrorail.test" },
  { id: "c-nexus", name: "Nexus Robotics", tier: "Silver", industry: "Automation", email: "engineering@nexusrobotics.test" },
  { id: "c-solaris", name: "Solaris Semiconductor", tier: "Gold", industry: "Electronics Mfg", email: "fabs@solaris.test" },
  { id: "c-beacon", name: "Beacon Health Systems", tier: "Silver", industry: "Hospital Network", email: "medical@beaconhealth.test" },
  { id: "c-corelogic", name: "CoreLogic Analytics", tier: "Bronze", industry: "Data Analytics", email: "data@corelogic.test" },
  { id: "c-vertex", name: "Vertex Cloud Solutions", tier: "Gold", industry: "Cloud Infrastructure", email: "devops@vertexcloud.test" },
  { id: "c-pinnacle", name: "Pinnacle Capital Group", tier: "Gold", industry: "Private Equity", email: "deals@pinnaclecap.test" },
  { id: "c-alphafreight", name: "Alpha Freight Logistics", tier: "Silver", industry: "Freight Cargo", email: "dispatch@alphafreight.test" },
  { id: "c-precision", name: "Precision Chemical Works", tier: "Silver", industry: "Specialty Chemicals", email: "safety@precisionchem.test" },
  { id: "c-globalmaritime", name: "Global Maritime Carriers", tier: "Bronze", industry: "Maritime Shipping", email: "fleet@globalmaritime.test" },
  { id: "c-summit", name: "Summit Food Processing", tier: "Bronze", industry: "Food & Beverage", email: "ops@summitfoods.test" },
  { id: "c-ironclad", name: "Ironclad Security Tech", tier: "Silver", industry: "Physical Security", email: "access@ironclad.test" },
  { id: "c-evergreen", name: "Evergreen Paper & Packaging", tier: "Bronze", industry: "Packaging Mfg", email: "boxes@evergreen.test" },
];

export const CUSTOMERS: Customer[] = RAW_CUSTOMERS.map((c) => ({
  id: c.id,
  name: c.name,
  tier: c.tier,
  industry: c.industry,
  contactEmail: c.email,
}));

// Append customer portal users for the remaining companies
for (const c of CUSTOMERS) {
  if (!USERS.some((u) => u.customerId === c.id)) {
    USERS.push({
      id: `u-cust-${c.id.replace("c-", "")}`,
      name: `${c.name} Procurement`,
      email: c.contactEmail,
      role: "CUSTOMER",
      customerId: c.id,
    });
  }
}

// ==========================================
// 3. PRODUCTS (Over 210 Distinct Products)
// ==========================================
const BASE_PRODUCTS: Product[] = [
  // Flagship Demo Hardware
  { id: "p-laptop", name: "Enterprise Laptop", category: "Hardware", unit: "unit", price: 1850, cost: 1400, taxPct: 8, description: "14-inch business laptop, 32 GB RAM, 1 TB SSD, 3-year chassis cover." },
  { id: "p-network", name: "Network Equipment", category: "Hardware", unit: "unit", price: 3400, cost: 2600, taxPct: 8, description: "Rackmount core switch, 48x 10GbE SFP+, redundant power supply." },
  { id: "p-server", name: "Rack Server 2U", category: "Hardware", unit: "unit", price: 5800, cost: 4200, taxPct: 8, description: "Dual Xeon Scalable, 128 GB ECC RAM, 8-bay hot-swap NVMe." },
  { id: "p-firewall", name: "Edge Firewall Appliance", category: "Hardware", unit: "unit", price: 2900, cost: 2100, taxPct: 8, description: "Next-gen enterprise firewall, 10 Gbps threat protection throughput." },
  { id: "p-storage", name: "SAN Storage Enclosure", category: "Hardware", unit: "unit", price: 8900, cost: 6800, taxPct: 8, description: "24-bay SAS-3 SAN array with dual active-active controllers." },

  // Flagship Demo Services
  { id: "p-setup", name: "Setup Service", category: "Services", unit: "hour", price: 150, cost: 85, taxPct: 18, description: "On-site installation, rack-mounting, cabling, and baseline configuration." },
  { id: "p-deploy", name: "Cluster Deployment", category: "Services", unit: "day", price: 1800, cost: 1000, taxPct: 18, description: "High-availability cluster orchestration and failover validation." },
  { id: "p-migration", name: "Active Directory Migration", category: "Services", unit: "project", price: 4500, cost: 2500, taxPct: 18, description: "Zero-downtime domain controller migration and tenant federation." },

  // Flagship Demo Subscriptions
  { id: "p-care", name: "Enterprise Care Pack", category: "Subscriptions", unit: "seat", price: 65, cost: 20, taxPct: 18, description: "24/7 SLA, 4-hour on-site dispatch, quarterly preventive maintenance.", cycle: "Monthly" },
  { id: "p-saas", name: "SaaS Analytics License", category: "Subscriptions", unit: "seat", price: 45, cost: 12, taxPct: 18, description: "Real-time telemetry and commercial operations intelligence suite.", cycle: "Monthly" },
  { id: "p-secops", name: "Managed SIEM & Endpoint", category: "Subscriptions", unit: "device", price: 120, cost: 35, taxPct: 18, description: "Continuous threat detection, automated isolation, and SOC escalation.", cycle: "Monthly" },
];

// Dynamically generate additional structured catalog items to exceed 210 products
const HARDWARE_MODELS = [
  "Workstation Pro 32C", "Blade Server Node 4U", "All-Flash NVMe Array 50TB", "Layer-3 100G Spine Switch",
  "High-Density 48-Port PoE+ Switch", "SD-WAN Edge Gateway", "Rugged Field Tablet i7", "Industrial IoT Gateway LTE",
  "Fiber Optic Patch Panel 96-Port", "Smart Rack PDU 30A 3-Phase", "Online Modular UPS 10kVA", "KVM Over IP 16-Port",
  "Enterprise Wi-Fi 7 AP", "Outdoor Directional Bridge", "Biometric Server Room Access Unit", "Hot-Swap Power Supply 1200W",
  "40GbE QSFP+ Optical Transceiver", "Cat-6A Shielded Bulk Cable 1000ft", "Network Attached Storage 8-Bay", "Hardware Security Module PCIe",
  "VDI Thin Client Terminal", "Deep Learning GPU Node 4x A100", "Thermal Environmental Sensor Rack Kit", "100G QSFP28 Direct Attach Copper Cable",
  "Precision Time Server GPS/PTP", "Cellular Out-of-Band Console Server", "Storage Expansion Shelf 12G SAS", "Load Balancer Appliance 20G"
];

const SERVICE_MODELS = [
  "Zero-Trust Architecture Audit", "Penetration Testing & Red Team Exercise", "Cloud Readiness & Migration Assessment",
  "Fiber Optic OTDR Link Certification", "Disaster Recovery Drill & Simulation", "SQL Database Performance Optimization",
  "Microservices Kubernetes Hardening", "Custom Webhook & API Middleware Development", "Network Latency & Jitter Tuning",
  "Post-Breach Forensics Readiness Drill", "Data Center Cable Grooming & Labelling", "Executive Security Awareness Workshop",
  "Automated CI/CD Pipeline Integration", "ISO 27001 Compliance Gap Analysis", "Storage Pool Re-tiering & Deduplication Setup",
  "BGP Multi-Homing Configuration Service", "Firewall Rulebase Consolidation & Cleanup", "Wireless RF Site Survey & Heatmap",
  "Identity Governance & SSO Integration", "Storage Snapshot Lifecycle Automation"
];

const SUBSCRIPTION_MODELS = [
  "Continuous Vulnerability Scanning Seat", "AI Network Anomaly Detection Feed", "Automated Cloud Backup Plan (5TB)",
  "Priority Hardware Advance Replacement", "Dedicated Technical Account Manager (TAM)", "DDoS Mitigation Layer-7 Shield",
  "Container Registry Security Scanner", "Email Phishing Simulation Subscription", "Extended Chassis Hardware Warranty (Yearly)",
  "Managed Kubernetes Node Support", "Global CDN Dynamic Acceleration Plan", "Unified Threat Intelligence Feed",
  "Log Retention & Cold Archival Vault", "Privileged Access Management (PAM) Seat", "VoIP Hosted PBX Enterprise Trunk",
  "SSL/TLS Certificate Automation Manager", "SaaS Disaster Recovery Hot-Site Reserve", "Endpoint Antivirus & EDR License",
  "Zero-Day Malware Sandbox Detonation Feed", "Executive Mobile Threat Protection Seat"
];

let prodCount = BASE_PRODUCTS.length;
const GENERATED_PRODUCTS: Product[] = [...BASE_PRODUCTS];

// Generate Hardware Products (totaling ~85 hardware)
for (let i = 0; i < HARDWARE_MODELS.length; i++) {
  const name = HARDWARE_MODELS[i];
  const price = Math.round(500 + (i * 370) % 7500);
  const cost = Math.round(price * 0.72);
  GENERATED_PRODUCTS.push({
    id: `p-hw-${i + 1}`,
    name,
    category: "Hardware",
    unit: "unit",
    price,
    cost,
    taxPct: 8,
    description: `Enterprise-grade ${name.toLowerCase()} with high MTBF rating and modular field replaceability.`
  });
  prodCount++;
}

// Generate Services Products (totaling ~65 services)
for (let i = 0; i < SERVICE_MODELS.length; i++) {
  const name = SERVICE_MODELS[i];
  const price = Math.round(120 + (i * 180) % 3800);
  const cost = Math.round(price * 0.55);
  GENERATED_PRODUCTS.push({
    id: `p-srv-${i + 1}`,
    name,
    category: "Services",
    unit: (i % 3 === 0 ? "hour" : i % 3 === 1 ? "day" : "project"),
    price,
    cost,
    taxPct: 18,
    description: `Certified engineering deliverable: ${name} executed by L3 certified architects with compliance sign-off.`
  });
  prodCount++;
}

// Generate Subscriptions Products (totaling ~65 subscriptions)
for (let i = 0; i < SUBSCRIPTION_MODELS.length; i++) {
  const name = SUBSCRIPTION_MODELS[i];
  const cycle: BillingCycle = i % 3 === 0 ? "Monthly" : i % 3 === 1 ? "Quarterly" : "Yearly";
  const baseRate = Math.round(35 + (i * 65) % 1200);
  const price = cycle === "Yearly" ? baseRate * 10 : cycle === "Quarterly" ? baseRate * 2.8 : baseRate;
  const cost = Math.round(price * 0.35);
  GENERATED_PRODUCTS.push({
    id: `p-sub-${i + 1}`,
    name,
    category: "Subscriptions",
    unit: (i % 2 === 0 ? "seat" : "device"),
    price: Math.round(price),
    cost,
    taxPct: 18,
    description: `Recurring enterprise SLA: ${name} delivered via cloud telemetry on a ${cycle.toLowerCase()} billing cycle.`,
    cycle
  });
  prodCount++;
}

// Duplicate variations to reach exactly 215 products
while (GENERATED_PRODUCTS.length < 215) {
  const idx = GENERATED_PRODUCTS.length;
  const cat: ProductCategory = idx % 3 === 0 ? "Hardware" : idx % 3 === 1 ? "Services" : "Subscriptions";
  const price = Math.round(150 + (idx * 95) % 4500);
  GENERATED_PRODUCTS.push({
    id: `p-gen-${idx + 1}`,
    name: `${cat} Module SKU-${idx + 100}`,
    category: cat,
    unit: cat === "Hardware" ? "unit" : cat === "Services" ? "hour" : "license",
    price,
    cost: Math.round(price * 0.65),
    taxPct: cat === "Hardware" ? 8 : 18,
    description: `Commercial commercialized ${cat.toLowerCase()} package for mid-market and enterprise accounts.`,
    cycle: cat === "Subscriptions" ? "Monthly" : undefined
  });
}

export const PRODUCTS: Product[] = GENERATED_PRODUCTS.map((p, index) => {
  const daysAgo = Math.max(1, Math.round((GENERATED_PRODUCTS.length - index) * 0.8));
  return {
    ...p,
    createdAt: p.createdAt || ago(daysAgo),
  };
});

// ==========================================
// 4. WAREHOUSES (5 Regional Logistics Centers)
// ==========================================
export const WAREHOUSES: Warehouse[] = [
  { id: "w-main", name: "Main Central Depot", location: "Mumbai Hub", shipmentCost: 150 },
  { id: "w-east", name: "Eastern Logistics Depot", location: "Kolkata Hub", shipmentCost: 220 },
  { id: "w-north", name: "Northern Fulfillment Center", location: "Delhi NCR Hub", shipmentCost: 180 },
  { id: "w-south", name: "Southern Tech Distribution Hub", location: "Bengaluru Hub", shipmentCost: 160 },
  { id: "w-west", name: "Western Coastal Terminal", location: "Ahmedabad Hub", shipmentCost: 200 },
];

// ==========================================
// 5. INVENTORY (Hardware items stocked across 5 warehouses)
// ==========================================
const hardwareProducts = PRODUCTS.filter((p) => p.category === "Hardware");
export const INVENTORY: InventoryItem[] = [];

for (const p of hardwareProducts) {
  for (const w of WAREHOUSES) {
    // Generate deterministic inventory counts
    const hash = (p.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) + w.id.charCodeAt(2)) % 100;
    const available = hash > 85 ? 4 : hash > 40 ? 45 : 90;
    const reserved = Math.round(available * 0.15);
    const replenishmentDays = 3 + (hash % 11);
    INVENTORY.push({
      warehouseId: w.id,
      productId: p.id,
      available,
      reserved,
      replenishmentDays,
    });
  }
}

// ==========================================
// 6. SUBSCRIPTION PLANS
// ==========================================
export const PLANS: SubscriptionPlan[] = [
  { id: "plan-silver", name: "Silver Basic SLA", cycle: "Monthly", price: 150, prorationEnabled: true, cancellationPolicy: "Prorated calendar refund on early termination." },
  { id: "plan-gold", name: "Gold 24/7 Mission-Critical SLA", cycle: "Monthly", price: 400, prorationEnabled: true, cancellationPolicy: "Non-refundable after 15th of billing cycle." },
  { id: "plan-plat", name: "Platinum Dedicated NOC Retainer", cycle: "Monthly", price: 950, prorationEnabled: true, cancellationPolicy: "Full credit note on unused calendar billing days." },
  { id: "plan-backup-q", name: "Cloud Vault Snapshot Backup", cycle: "Quarterly", price: 600, prorationEnabled: true, cancellationPolicy: "Prorated quarterly credit to account balance." },
  { id: "plan-threat-y", name: "Automated Threat Defense Enterprise", cycle: "Yearly", price: 3200, prorationEnabled: true, cancellationPolicy: "Annual commitments non-refundable; transferrable." },
  { id: "plan-care-y", name: "Enterprise Chassis Care Pack", cycle: "Yearly", price: 1800, prorationEnabled: true, cancellationPolicy: "Prorated annual rebate applied to hardware trade-in." },
];

// ==========================================
// 7. QUOTATIONS (300 Quotations: 250 Won/Completed + 50 Active)
// ==========================================
const REPS = USERS.filter((u) => u.role === "SALES_REP");
const MANAGERS = USERS.filter((u) => u.role === "SALES_MANAGER");
const FINANCE_USERS = USERS.filter((u) => u.role === "FINANCE");

// Flagship Demo Quotations (Q-1041 to Q-1045)
const FLAGSHIP_QUOTES: Quotation[] = [
  {
    id: "q-1041",
    number: "Q-1041",
    customerId: "c-acme",
    ownerId: "u-rep1",
    stage: "PENDING_APPROVAL",
    lines: [
      { id: "l-1", productId: "p-laptop", qty: 25, unitPrice: 1850, discountPct: 12, taxPct: 8 },
      { id: "l-2", productId: "p-network", qty: 2, unitPrice: 3400, discountPct: 15, taxPct: 8 },
      { id: "l-3", productId: "p-setup", qty: 40, unitPrice: 150, discountPct: 18, taxPct: 18 },
    ],
    createdAt: ago(4),
    updatedAt: ago(1),
    messages: [
      { id: "m-1", author: "Lena Ortiz", role: "CUSTOMER", body: "Can we get an additional discount on setup services?", at: ago(3) },
      { id: "m-2", author: "Priya Raman", role: "SALES_REP", body: "I have adjusted setup discount to 18% pending manager sign-off.", at: ago(2) },
    ],
    requests: [
      { id: "req-1", lineId: "l-3", requestedDiscountPct: 18, note: "Need concession on configuration overhead.", status: "ACCEPTED", at: ago(2) }
    ],
    dismissedRecommendations: [],
    nudgedAt: undefined,
    escalated: true,
  },
  {
    id: "q-1042",
    number: "Q-1042",
    customerId: "c-delta",
    ownerId: "u-rep2",
    stage: "APPROVED",
    lines: [
      { id: "l-4", productId: "p-laptop", qty: 10, unitPrice: 1850, discountPct: 8, taxPct: 8 },
      { id: "l-5", productId: "p-care", qty: 10, unitPrice: 65, discountPct: 10, taxPct: 18 },
    ],
    createdAt: ago(8),
    updatedAt: ago(2),
    messages: [],
    requests: [],
    dismissedRecommendations: [],
  },
  {
    id: "q-1043",
    number: "Q-1043",
    customerId: "c-beta",
    ownerId: "u-rep1",
    stage: "DRAFT",
    lines: [
      { id: "l-6", productId: "p-server", qty: 4, unitPrice: 5800, discountPct: 5, taxPct: 8 },
      { id: "l-7", productId: "p-deploy", qty: 3, unitPrice: 1800, discountPct: 5, taxPct: 18 },
    ],
    createdAt: ago(1),
    updatedAt: ago(1),
    messages: [],
    requests: [],
    dismissedRecommendations: [],
  },
  {
    id: "q-1044",
    number: "Q-1044",
    customerId: "c-nova",
    ownerId: "u-rep2",
    stage: "CONFIRMED",
    lines: [
      { id: "l-8", productId: "p-firewall", qty: 4, unitPrice: 2900, discountPct: 10, taxPct: 8 },
      { id: "l-9", productId: "p-secops", qty: 4, unitPrice: 120, discountPct: 10, taxPct: 18 },
    ],
    createdAt: ago(15),
    updatedAt: ago(10),
    messages: [],
    requests: [],
    dismissedRecommendations: [],
  },
  {
    id: "q-1045",
    number: "Q-1045",
    customerId: "c-zenith",
    ownerId: "u-rep3",
    stage: "PAID",
    lines: [
      { id: "l-10", productId: "p-storage", qty: 2, unitPrice: 8900, discountPct: 10, taxPct: 8 },
      { id: "l-11", productId: "p-migration", qty: 1, unitPrice: 4500, discountPct: 10, taxPct: 18 },
    ],
    createdAt: ago(45),
    updatedAt: ago(35),
    messages: [],
    requests: [],
    dismissedRecommendations: [],
  },
];

export const QUOTATIONS: Quotation[] = [...FLAGSHIP_QUOTES];

// Generate 295 additional realistic quotations to reach exactly 300 quotations
// Exactly 250 completed (CONFIRMED, FULFILLMENT, INVOICED, PAID) + 50 active
const WON_STAGES: QuotationStage[] = ["CONFIRMED", "FULFILLMENT", "INVOICED", "PAID"];
const ACTIVE_STAGES: QuotationStage[] = ["DRAFT", "PENDING_APPROVAL", "NEGOTIATION", "APPROVED"];

for (let i = 1; i <= 295; i++) {
  const quoteId = `q-${2000 + i}`;
  const quoteNumber = `Q-${2000 + i}`;
  const customer = CUSTOMERS[i % CUSTOMERS.length];
  const rep = REPS[i % REPS.length];

  // 250 completed quotes, 45 active quotes
  const isWon = i <= 248; // (plus 2 flagship won = 250 won)
  const stage: QuotationStage = isWon
    ? (i % 4 === 0 ? "PAID" : i % 4 === 1 ? "INVOICED" : i % 4 === 2 ? "FULFILLMENT" : "CONFIRMED")
    : (i % 4 === 0 ? "PENDING_APPROVAL" : i % 4 === 1 ? "NEGOTIATION" : i % 4 === 2 ? "DRAFT" : "APPROVED");

  // Dates spread across the last 365 days
  const daysAgo = isWon ? Math.round(5 + ((i * 1.45) % 355)) : Math.round(1 + (i % 12));
  const createdDate = ago(daysAgo);
  const updatedDate = ago(Math.max(0, daysAgo - 2));

  // Build 2 to 4 product lines per quote
  const linesCount = 2 + (i % 3);
  const lines: QuotationLine[] = [];
  for (let l = 0; l < linesCount; l++) {
    const prod = PRODUCTS[(i * 7 + l * 19) % PRODUCTS.length];
    const qty = 1 + ((i + l * 3) % 8);
    // Discount adhering to tier limit or slight variation
    const maxTierDisc = customer.tier === "Gold" ? 15 : customer.tier === "Silver" ? 10 : 5;
    const discountPct = stage === "PENDING_APPROVAL"
      ? maxTierDisc + 4 // intentional violation
      : Math.round(((i + l) % (maxTierDisc + 1)));

    lines.push({
      id: `l-${2000 + i}-${l + 1}`,
      productId: prod.id,
      qty,
      unitPrice: prod.price,
      discountPct,
      taxPct: prod.taxPct,
    });
  }

  QUOTATIONS.push({
    id: quoteId,
    number: quoteNumber,
    customerId: customer.id,
    ownerId: rep.id,
    stage,
    lines,
    createdAt: createdDate,
    updatedAt: updatedDate,
    messages: stage === "NEGOTIATION" ? [
      { id: `m-${i}-1`, author: customer.name, role: "CUSTOMER", body: "We request a volume rebate on this proposal.", at: ago(daysAgo - 1) },
      { id: `m-${i}-2`, author: rep.name, role: "SALES_REP", body: "Let me check with leadership on the concessions.", at: updatedDate }
    ] : [],
    requests: stage === "NEGOTIATION" ? [
      { id: `req-${i}-1`, lineId: lines[0]?.id || `l-${2000 + i}-1`, requestedDiscountPct: 18, note: "Targeting enterprise unit economics", status: "OPEN", at: ago(daysAgo - 1) }
    ] : [],
    dismissedRecommendations: [],
    nudgedAt: (i % 17 === 0 && !isWon) ? ago(1) : undefined,
    escalated: (i % 23 === 0 && !isWon),
  });
}

// ==========================================
// 8. APPROVALS (For all completed & pending approval quotes)
// ==========================================
export const APPROVALS: Approval[] = [
  {
    id: "app-1041",
    quotationId: "q-1041",
    status: "PENDING",
    steps: [
      { role: "SALES_MANAGER", status: "PENDING" },
      { role: "FINANCE", status: "PENDING" },
    ],
    riskLevel: "HIGH",
    submittedBy: "u-rep1",
    submittedAt: ago(3),
  },
  {
    id: "app-1042",
    quotationId: "q-1042",
    status: "APPROVED",
    steps: [
      { role: "SALES_MANAGER", status: "APPROVED", decidedBy: "u-mgr", reason: "Standard enterprise deal tier.", decidedAt: ago(6) },
    ],
    riskLevel: "MEDIUM",
    submittedBy: "u-rep2",
    submittedAt: ago(7),
  },
];

// Populate approvals for all quotes that are approved, confirmed, fulfillment, invoiced, paid, or pending
for (const q of QUOTATIONS) {
  if (q.id === "q-1041" || q.id === "q-1042") continue;
  if (["APPROVED", "CONFIRMED", "FULFILLMENT", "INVOICED", "PAID"].includes(q.stage)) {
    const mgr = MANAGERS[parseInt(q.id.replace("q-", "")) % MANAGERS.length];
    const fin = FINANCE_USERS[parseInt(q.id.replace("q-", "")) % FINANCE_USERS.length];
    const isHighRisk = parseInt(q.id.replace("q-", "")) % 3 === 0;

    const steps: ApprovalStep[] = [
      { role: "SALES_MANAGER", status: "APPROVED", decidedBy: mgr.id, reason: "Commercial margin approved.", decidedAt: q.createdAt }
    ];
    if (isHighRisk) {
      steps.push({ role: "FINANCE", status: "APPROVED", decidedBy: fin.id, reason: "Finance risk assessment cleared.", decidedAt: q.createdAt });
    }

    APPROVALS.push({
      id: `app-${q.id.replace("q-", "")}`,
      quotationId: q.id,
      status: "APPROVED",
      steps,
      riskLevel: isHighRisk ? "HIGH" : "MEDIUM",
      submittedBy: q.ownerId,
      submittedAt: q.createdAt,
    });
  } else if (q.stage === "PENDING_APPROVAL") {
    APPROVALS.push({
      id: `app-${q.id.replace("q-", "")}`,
      quotationId: q.id,
      status: "PENDING",
      steps: [
        { role: "SALES_MANAGER", status: "PENDING" }
      ],
      riskLevel: "MEDIUM",
      submittedBy: q.ownerId,
      submittedAt: q.updatedAt,
    });
  }
}

// ==========================================
// 9. FULFILLMENT ORDERS (For all confirmed/fulfillment/invoiced/paid quotes)
// ==========================================
export const ORDERS: FulfillmentOrder[] = [];

for (const q of QUOTATIONS) {
  if (["CONFIRMED", "FULFILLMENT", "INVOICED", "PAID"].includes(q.stage)) {
    const idx = parseInt(q.id.replace("q-", ""));
    const hwLine = q.lines.find((l) => PRODUCTS.find((p) => p.id === l.productId)?.category === "Hardware") || q.lines[0];
    const status = q.stage === "PAID" || q.stage === "INVOICED"
      ? "SHIPPED"
      : (idx % 3 === 0 ? "BACKORDERED" : idx % 3 === 1 ? "ALLOCATED" : "AWAITING");

    const allocations: Allocation[] = [];
    const backorders: Backorder[] = [];

    if (hwLine) {
      // Split between main and east/north warehouses
      const w1 = WAREHOUSES[idx % WAREHOUSES.length];
      const w2 = WAREHOUSES[(idx + 1) % WAREHOUSES.length];
      const q1 = Math.max(1, Math.floor(hwLine.qty / 2));
      const q2 = hwLine.qty - q1;

      allocations.push({ warehouseId: w1.id, productId: hwLine.productId, qty: q1, shipmentCost: w1.shipmentCost });
      if (q2 > 0) {
        allocations.push({ warehouseId: w2.id, productId: hwLine.productId, qty: q2, shipmentCost: w2.shipmentCost });
      }

      if (status === "BACKORDERED") {
        backorders.push({
          id: `bo-${idx}`,
          productId: hwLine.productId,
          qty: 2,
          status: "OPEN",
        });
      }
    }

    ORDERS.push({
      id: `ord-${idx}`,
      quotationId: q.id,
      status,
      allocations,
      backorders,
      createdAt: q.createdAt,
      shippedAt: status === "SHIPPED" ? q.updatedAt : undefined,
      dueAt: ahead(7),
    });
  }
}

// ==========================================
// 10. INVOICES (For invoiced and paid quotations)
// ==========================================
export const INVOICES: Invoice[] = [];

for (const q of QUOTATIONS) {
  if (["INVOICED", "PAID"].includes(q.stage)) {
    const idx = parseInt(q.id.replace("q-", ""));
    const gross = q.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    const disc = q.lines.reduce((s, l) => s + (l.qty * l.unitPrice * l.discountPct) / 100, 0);
    const net = Math.round(gross - disc);

    const isPaid = q.stage === "PAID";
    const payments: Payment[] = isPaid
      ? [
          {
            id: `pay-${idx}`,
            amount: net,
            method: idx % 2 === 0 ? "Bank Wire / NEFT" : "Corporate Card",
            at: q.updatedAt,
            recordedBy: "u-fin",
          },
        ]
      : [];

    INVOICES.push({
      id: `inv-${idx}`,
      number: `INV-${3000 + idx}`,
      customerId: q.customerId,
      quotationId: q.id,
      amount: net,
      status: isPaid ? "PAID" : "UNPAID",
      issuedAt: q.createdAt,
      dueDate: ahead(30),
      payments,
    });
  }
}

// ==========================================
// 11. SUBSCRIPTIONS (For quotes with subscription items)
// ==========================================
export const SUBSCRIPTIONS: Subscription[] = [];

for (const q of QUOTATIONS) {
  const subLine = q.lines.find((l) => PRODUCTS.find((p) => p.id === l.productId)?.category === "Subscriptions");
  if (subLine && ["CONFIRMED", "FULFILLMENT", "INVOICED", "PAID"].includes(q.stage)) {
    const idx = parseInt(q.id.replace("q-", ""));
    const plan = PLANS[idx % PLANS.length];

    SUBSCRIPTIONS.push({
      id: `sub-${idx}`,
      customerId: q.customerId,
      quotationId: q.id,
      planId: plan.id,
      qty: subLine.qty,
      unitPrice: subLine.unitPrice,
      cycle: plan.cycle,
      startDate: q.createdAt,
      nextBillDate: ahead(30),
      status: "ACTIVE",
      adjustments: [],
    });
  }
}

// ==========================================
// 12. AUDIT LOG & DOMAIN EVENTS
// ==========================================
export const AUDIT: AuditEntry[] = [
  { id: "aud-1", entity: "Quotation", entityId: "q-1041", actor: "u-rep1", action: "CREATED", reason: "Draft created for Acme Corp.", at: ago(4) },
  { id: "aud-2", entity: "Quotation", entityId: "q-1041", actor: "u-rep1", action: "SUBMITTED_FOR_APPROVAL", reason: "High risk discount threshold triggered.", at: ago(3) },
  { id: "aud-3", entity: "Quotation", entityId: "q-1042", actor: "u-mgr", action: "APPROVED", reason: "Approved within delegation limits.", at: ago(6) },
];

export const EVENTS: DomainEvent[] = [
  { id: "evt-1", name: "QUOTATION_SUBMITTED", payload: JSON.stringify({ quotationId: "q-1041", number: "Q-1041" }), at: ago(3) },
  { id: "evt-2", name: "APPROVAL_REQUESTED", payload: JSON.stringify({ quotationId: "q-1041", riskLevel: "HIGH" }), at: ago(3) },
  { id: "evt-3", name: "SPLIT_RECOMMENDED", payload: JSON.stringify({ quotationId: "q-1042", orderId: "ord-1042" }), at: ago(2) },
];

console.log(
  `[DealFlow360 Seed] Loaded ${USERS.length} Users, ${CUSTOMERS.length} Customers, ${PRODUCTS.length} Products, ` +
  `${WAREHOUSES.length} Warehouses, ${INVENTORY.length} Inventory items, ${QUOTATIONS.length} Quotations, ` +
  `${APPROVALS.length} Approvals, ${ORDERS.length} Orders, ${INVOICES.length} Invoices, ${SUBSCRIPTIONS.length} Subscriptions.`
);
