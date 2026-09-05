import type {
  User,
  AuditEntry,
  DomainEvent,
  Product,
  Warehouse,
  SubscriptionPlan,
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
  list(): Promise<User[]>;
  create(user: User): Promise<User>;
  update(id: string, patch: Partial<User>): Promise<User>;
}

export interface IAuditRepository {
  record(entry: AuditEntry): Promise<AuditEntry>;
  list(filter?: { entity?: string; actor?: string }): Promise<AuditEntry[]>;
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
  update(warehouse: Warehouse): Promise<Warehouse>;
}

export interface ISubscriptionPlanRepository {
  list(): Promise<SubscriptionPlan[]>;
  update(plan: SubscriptionPlan): Promise<SubscriptionPlan>;
}

export interface IGovernanceRepository {
  load(): Promise<GovernanceConfig>;
  save(config: GovernanceConfig): Promise<void>;
}

export interface IQuotationRepository {
  list(filter?: { customerId?: string; stage?: string; search?: string }): Promise<Quotation[]>;
  findById(id: string): Promise<Quotation | null>;
  findByNumber(number: string): Promise<Quotation | null>;
  create(quotation: Quotation): Promise<Quotation>;
  update(id: string, patch: Partial<Quotation>): Promise<Quotation>;
  delete(id: string): Promise<void>;
  getNextSequence(): Promise<number>;
}

export interface ICustomerRepository {
  findById(id: string): Promise<Customer | null>;
  list(): Promise<Customer[]>;
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
}
