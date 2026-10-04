import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const planogramState=sqliteTable("planogram_state",{id:integer("id").primaryKey(),data:text("data").notNull(),updatedAt:integer("updated_at").notNull()});

export const userWorkspaceState = sqliteTable("user_workspace_state", {
  userKey: text("user_key").primaryKey(),
  data: text("data").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const betaEvent = sqliteTable("beta_event", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userKey: text("user_key").notNull(),
  userEmail: text("user_email").notNull(),
  eventType: text("event_type").notNull(),
  action: text("action").notNull(),
  outcome: text("outcome").notNull(),
  details: text("details"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_beta_event_created_at").on(table.createdAt),
  index("idx_beta_event_user_created").on(table.userKey, table.createdAt),
  index("idx_beta_event_type_created").on(table.eventType, table.createdAt),
]);

export const appSession = sqliteTable("app_session", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  createdAt: integer("created_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [
  index("idx_app_session_email").on(table.email),
  index("idx_app_session_expires_at").on(table.expiresAt),
]);
