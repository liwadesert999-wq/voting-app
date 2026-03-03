import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const votingSessions = pgTable("voting_sessions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  maxVotes: integer("max_votes").notNull().default(1),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => votingSessions.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const votes = pgTable(
  "votes",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => votingSessions.id, { onDelete: "cascade" }),
    voterToken: text("voter_token").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique("votes_session_voter_unique").on(table.sessionId, table.voterToken)]
);

export const voteSelections = pgTable("vote_selections", {
  id: serial("id").primaryKey(),
  voteId: integer("vote_id")
    .notNull()
    .references(() => votes.id, { onDelete: "cascade" }),
  candidateId: integer("candidate_id")
    .notNull()
    .references(() => candidates.id, { onDelete: "cascade" }),
});
