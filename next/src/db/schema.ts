import { integer, text, boolean, pgTable } from "drizzle-orm/pg-core";

export const todo = pgTable("task", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  creatorId: text("creator_id").notNull(),
  name: text("name").notNull(),
  instruction: text("instruction").notNull(),
  url: text("url").notNull(),
  cron: text("cron").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});
