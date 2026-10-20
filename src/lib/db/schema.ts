import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

/* -------------------------------------------------------------------------- */
/*  Enums                                                                     */
/* -------------------------------------------------------------------------- */

export const memberRoleEnum = pgEnum("member_role", ["owner", "adult", "child"]);
export const todoStatusEnum = pgEnum("todo_status", ["open", "done"]);
export const auditActorTypeEnum = pgEnum("audit_actor_type", ["user", "api_key"]);

export type MemberRole = (typeof memberRoleEnum.enumValues)[number];
export type TodoStatus = (typeof todoStatusEnum.enumValues)[number];
export type AuditActorType = (typeof auditActorTypeEnum.enumValues)[number];

/* -------------------------------------------------------------------------- */
/*  Auth.js tables (shape required by @auth/drizzle-adapter)                  */
/*  JS property names must match the adapter; DB column names are snake_case. */
/* -------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* -------------------------------------------------------------------------- */
/*  Households                                                                */
/* -------------------------------------------------------------------------- */

const createdAt = () =>
  timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const householdMembers = pgTable(
  "household_members",
  {
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("adult"),
    /** Hex color, e.g. "#3b82f6" */
    color: text("color"),
    displayName: text("display_name"),
    joinedAt: timestamp("joined_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.householdId, t.userId] }),
    index("household_members_user_idx").on(t.userId),
  ],
);

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    role: memberRoleEnum("role").notNull().default("adult"),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { mode: "date", withTimezone: true }),
  },
  (t) => [index("invites_household_idx").on(t.householdId)],
);

/* -------------------------------------------------------------------------- */
/*  Agent API keys + audit log                                                */
/* -------------------------------------------------------------------------- */

/**
 * API keys let AI agents call /api/v1 on behalf of the admin who created them.
 * Only the SHA-256 hash of the full key is stored; `prefix` is the short visible id.
 * `scopes` ⊆ {read, write, delete} (see lib/api-keys.ts).
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    scopes: text("scopes").array().notNull().default(sql`'{read}'::text[]`),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { mode: "date", withTimezone: true }),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
  },
  (t) => [index("api_keys_household_idx").on(t.householdId)],
);

/** Who did what, from the web UI (actor_type=user) or an API key (actor_type=api_key). */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    actorType: auditActorTypeEnum("actor_type").notNull(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
    /** e.g. "event.create", "api_key.revoke" (see lib/audit.ts) */
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    /** Text, not uuid: member entities are Auth.js user ids. */
    entityId: text("entity_id"),
    /** Short human description (a title, a name). Never secrets. */
    summary: text("summary").notNull().default(""),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ip: text("ip"),
  },
  (t) => [index("audit_log_household_occurred_at_idx").on(t.householdId, t.occurredAt.desc())],
);

/** Nullable link to the API key that created a row (created_by stays the key's owner). */
const createdViaApiKeyId = () =>
  uuid("created_via_api_key_id").references(() => apiKeys.id, { onDelete: "set null" });

/* -------------------------------------------------------------------------- */
/*  Calendar                                                                  */
/* -------------------------------------------------------------------------- */

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    startsAt: timestamp("starts_at", { mode: "date", withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { mode: "date", withTimezone: true }),
    allDay: boolean("all_day").notNull().default(false),
    /** RFC 5545 RRULE string (parsed with `rrule`), null for one-off events */
    rrule: text("rrule"),
    color: text("color"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdViaApiKeyId: createdViaApiKeyId(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("events_household_starts_at_idx").on(t.householdId, t.startsAt)],
);

export const eventAttendees = pgTable(
  "event_attendees",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] })],
);

/* -------------------------------------------------------------------------- */
/*  Todos                                                                     */
/* -------------------------------------------------------------------------- */

export const todos = pgTable(
  "todos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    details: text("details"),
    dueAt: timestamp("due_at", { mode: "date", withTimezone: true }),
    assignedTo: text("assigned_to").references(() => users.id, { onDelete: "set null" }),
    status: todoStatusEnum("status").notNull().default("open"),
    completedAt: timestamp("completed_at", { mode: "date", withTimezone: true }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdViaApiKeyId: createdViaApiKeyId(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("todos_household_status_due_at_idx").on(t.householdId, t.status, t.dueAt)],
);

/* -------------------------------------------------------------------------- */
/*  Bulletin board                                                            */
/* -------------------------------------------------------------------------- */

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    createdViaApiKeyId: createdViaApiKeyId(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("posts_household_pinned_created_at_idx").on(t.householdId, t.pinned, t.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Inferred types                                                            */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type Household = typeof households.$inferSelect;
export type NewHousehold = typeof households.$inferInsert;
export type HouseholdMember = typeof householdMembers.$inferSelect;
export type NewHouseholdMember = typeof householdMembers.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventAttendee = typeof eventAttendees.$inferSelect;
export type NewEventAttendee = typeof eventAttendees.$inferInsert;
export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
