import type {
  User,
  AuditEntry,
  DomainEvent,
} from "../../modules/shared/types";

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
