import { integer, text, boolean, pgTable } from "drizzle-orm/pg-core";

export const todo = pgTable("task", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  instruction: text("instruction").notNull(),
  url: text("url").notNull(),
  frequency: integer("frequency").notNull(),
});
