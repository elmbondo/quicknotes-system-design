# QuickNotes Data Model

QuickNotes stores its data in a relational (SQL) database. The statements below use SQLite syntax so they can be tested in an online playground, and they work almost the same in PostgreSQL or MySQL.

## Entities

### users

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Primary key |
| name | TEXT | Required |
| email | TEXT | Required and unique |
| password_hash | TEXT | Required. Only a hash is stored, never the real password |
| created_at | TEXT | Filled in automatically |

### notes

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to `users.id`. Required |
| title | TEXT | Required, 100 characters at most |
| body | TEXT | Optional |
| category | TEXT | `personal`, `work` or `study`. Defaults to `personal` |
| created_at | TEXT | Filled in automatically |
| updated_at | TEXT | Filled in automatically |

### tags

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Primary key |
| name | TEXT | Required and unique, so a tag name is stored only once |

### note_tags

| Column | Type | Notes |
|--------|------|-------|
| note_id | INTEGER | Foreign key to `notes.id` |
| tag_id | INTEGER | Foreign key to `tags.id` |

The primary key is the pair (`note_id`, `tag_id`), which also stops the same tag being added to the same note twice.

## Relationships

- **users to notes is one-to-many.** One user has many notes, but each note belongs to one user. That is why `notes` has a `user_id` foreign key.
- **notes to tags is many-to-many.** A note can have many tags (for example "exams" and "urgent"), and a tag can be on many notes. A foreign key in one table cannot hold a list of ids cleanly, so I use a third table, `note_tags`, with one row for each note and tag pairing.
- `note_tags` is the join table. It has a one-to-many link to `notes` and another one to `tags`, and together they make the many-to-many relationship.

## CREATE TABLE statements

```sql
-- turn on foreign key checks (SQLite needs this)
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  title       TEXT NOT NULL CHECK (length(title) <= 100),
  body        TEXT,
  category    TEXT NOT NULL DEFAULT 'personal'
              CHECK (category IN ('personal', 'work', 'study')),
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tags (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);

-- the join table for notes and tags
CREATE TABLE note_tags (
  note_id  INTEGER NOT NULL,
  tag_id   INTEGER NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

## Sample data

This is a small amount of data for trying the queries. The password hash here is a placeholder, because real ones come from a hashing function on the server.

```sql
INSERT INTO users (name, email, password_hash)
VALUES ('Amina Otieno', 'amina@example.com', 'placeholder-hash');

INSERT INTO notes (user_id, title, body, category) VALUES
  (1, 'Revise HTTP methods', 'GET reads, POST creates', 'study'),
  (1, 'Buy milk', NULL, 'personal'),
  (1, 'Send the project report', 'Email it to Grace', 'work');

INSERT INTO tags (name) VALUES ('exams'), ('urgent');

INSERT INTO note_tags (note_id, tag_id) VALUES (1, 1), (1, 2), (3, 2);
```

## Example queries

In the real server, values such as the user id are passed as placeholders (`?`) and never joined into the text, to prevent SQL injection. Plain numbers are used here so the queries are easy to read and run.

```sql
-- 1. all of one user's notes, newest first (this is GET /notes)
SELECT id, title, category, created_at
FROM notes
WHERE user_id = 1
ORDER BY created_at DESC;

-- 2. all of one user's notes tagged "urgent" (uses a JOIN)
SELECT notes.title, tags.name AS tag
FROM notes
JOIN note_tags ON note_tags.note_id = notes.id
JOIN tags ON tags.id = note_tags.tag_id
WHERE notes.user_id = 1 AND tags.name = 'urgent';

-- 3. how many notes a user has in each category
SELECT category, COUNT(*) AS total
FROM notes
WHERE user_id = 1
GROUP BY category;

-- 4. search the titles for a word
SELECT id, title
FROM notes
WHERE user_id = 1 AND title LIKE '%report%';

-- 5. delete a note, but only if it belongs to this user
DELETE FROM notes
WHERE id = 3 AND user_id = 1;
```

## Indexes

```sql
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);
```

- **`idx_notes_user_id`:** almost every request asks for one user's notes (`WHERE user_id = ...`). Without an index the database has to check every note of every user. With it, it jumps straight to that user's notes. This is the most important index in the system.
- **`idx_note_tags_tag_id`:** the primary key (`note_id`, `tag_id`) already makes it fast to find the tags of one note. It does not help when looking up all the notes with one tag, so this second index covers that.

The trade-off is that indexes make writes a little slower and use more storage. That is fine here, because QuickNotes reads much more than it writes.

## SQL or NoSQL?

I chose SQL. QuickNotes data is clearly structured, with users, notes and tags, and the relationships between them matter. SQL handles these with foreign keys and JOINs, so a question like "show me this user's urgent notes" is easy to ask. The database also enforces the rules itself: emails are unique, a note must belong to a user, titles stay under 100 characters, and the same tag cannot be added to a note twice. That keeps the data correct even if the app code has a bug. A document database such as MongoDB would also work, but tags shared between many notes would be duplicated inside documents, and changing one would mean updating them all. At around 220 GB of data per year, a single SQL database with a read replica is enough, so I do not need the extra scale that NoSQL is known for.