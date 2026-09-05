import type {
  User,
  AuditEntry,
  DomainEvent,
  Product,
  Warehouse,
  SubscriptionPlan,
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
