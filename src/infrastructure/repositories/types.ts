import type {
  User,
  AuditEntry,
  DomainEvent,
  Product,
  Warehouse,
  InventoryItem,
  SubscriptionPlan,
  Subscription,
  Quotation,
  Customer,
  Approval,
  Invoice,
  FulfillmentOrder,
} from "../../modules/shared/types";
import type { GovernanceConfig } from "../../modules/discount-governance/service";

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  getPasswordHash(email: string): Promise<string | null>;
  list(): Promise<User[]>;
  create(user: User, passwordHash?: string): Promise<User>;
  update(id: string, patch: Partial<User>): Promise<User>;
}

export interface IAuditRepository {
  record(entry: AuditEntry): Promise<AuditEntry>;
  list(filter?: { entity?: string; entityId?: string; actor?: string }): Promise<AuditEntry[]>;
}

export interface IDomainEventRepository {
  emit(event: DomainEvent): Promise<DomainEvent>;
  list(): Promise<DomainEvent[]>;
}

export interface IProductRepository {
  list(): Promise<Product[]>;
  upsert(product: Product): Promise<Product>;
}

export interface IWarehouseRepository {
  list(): Promise<Warehouse[]>;
  create(warehouse: Warehouse): Promise<Warehouse>;
  update(warehouse: Warehouse): Promise<Warehouse>;
}

export interface IInventoryRepository {
  list(): Promise<InventoryItem[]>;
  upsert(item: InventoryItem): Promise<InventoryItem>;
}

export interface ISubscriptionPlanRepository {
  list(): Promise<SubscriptionPlan[]>;
  create(plan: SubscriptionPlan): Promise<SubscriptionPlan>;
  update(plan: SubscriptionPlan): Promise<SubscriptionPlan>;
  delete(id: string): Promise<void>;
}

export interface ISubscriptionRepository {
  list(): Promise<Subscription[]>;
  findById(id: string): Promise<Subscription | null>;
  create(subscription: Subscription): Promise<Subscription>;
  update(id: string, patch: Partial<Subscription>): Promise<Subscription>;
}

export interface IGovernanceRepository {
  load(): Promise<GovernanceConfig>;
  save(config: GovernanceConfig): Promise<void>;
}

export interface IQuotationRepository {
  list(filter?: { customerId?: string; ownerId?: string; stage?: string; search?: string }): Promise<Quotation[]>;
  findById(id: string): Promise<Quotation | null>;
  findByNumber(number: string): Promise<Quotation | null>;
  create(quotation: Quotation): Promise<Quotation>;
  update(id: string, patch: Partial<Quotation>): Promise<Quotation>;
  delete(id: string): Promise<void>;
  deleteMany(ids: string[]): Promise<number>;
  getNextSequence(): Promise<number>;
}

export interface ICustomerRepository {
  findById(id: string): Promise<Customer | null>;
  list(): Promise<Customer[]>;
  create(customer: Customer): Promise<Customer>;
}

export interface IApprovalRepository {
  findById(id: string): Promise<Approval | null>;
  findByQuotationId(quotationId: string): Promise<Approval | null>;
  create(approval: Approval): Promise<Approval>;
  update(id: string, patch: Partial<Approval>): Promise<Approval>;
  list(filter?: { status?: string; quotationId?: string }): Promise<Approval[]>;
}

export interface IInvoiceRepository {
  create(invoice: Invoice): Promise<Invoice>;
  list(): Promise<Invoice[]>;
}

export interface IFulfillmentRepository {
  create(order: FulfillmentOrder): Promise<FulfillmentOrder>;
  list(): Promise<FulfillmentOrder[]>;
  findById(id: string): Promise<FulfillmentOrder | null>;
  update(id: string, patch: Partial<FulfillmentOrder>): Promise<FulfillmentOrder>;
}

