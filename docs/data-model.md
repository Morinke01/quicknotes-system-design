# QuickNotes data model

QuickNotes uses a relational model. A user owns notes and tags; notes and tags are connected through the `note_tags` join table.

## Entities and relationships

- **users** stores each account. One user can own many notes and many tags (two one-to-many relationships).
- **notes** stores note text and timestamps. Each note belongs to exactly one user.
- **tags** stores a user's reusable labels. Each tag belongs to exactly one user.
- **note_tags** connects notes and tags. A note can have many tags, and a tag can label many notes, so this join table implements a many-to-many relationship.

The application verifies that a tag and note belong to the same user before creating a `note_tags` row. All foreign keys cascade on deletion so a deleted user, note, or tag cannot leave orphaned associations.

## PostgreSQL schema

```sql
CREATE TABLE users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         VARCHAR(320) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(100) NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tags (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
    note_id    UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (note_id, tag_id)
);
```

## Example queries

List the most recently updated notes for one user:

```sql
SELECT id, title, body, created_at, updated_at
FROM notes
WHERE user_id = $1
ORDER BY updated_at DESC
LIMIT 20;
```

Get notes with their tags (JOIN across the many-to-many relationship):

```sql
SELECT n.id, n.title, t.id AS tag_id, t.name AS tag_name
FROM notes AS n
LEFT JOIN note_tags AS nt ON nt.note_id = n.id
LEFT JOIN tags AS t ON t.id = nt.tag_id AND t.user_id = n.user_id
WHERE n.user_id = $1 AND n.id = $2
ORDER BY t.name;
```

Create a tag association without duplicating an existing one:

```sql
INSERT INTO note_tags (note_id, tag_id)
SELECT n.id, t.id
FROM notes AS n
JOIN tags AS t ON t.user_id = n.user_id
WHERE n.user_id = $1 AND n.id = $2 AND t.id = $3
ON CONFLICT (note_id, tag_id) DO NOTHING;
```

Count notes per user:

```sql
SELECT u.id, u.email, COUNT(n.id) AS note_count
FROM users AS u
LEFT JOIN notes AS n ON n.user_id = u.id
GROUP BY u.id, u.email
ORDER BY note_count DESC;
```

## Indexes

```sql
CREATE INDEX notes_user_updated_idx ON notes (user_id, updated_at DESC);
CREATE INDEX note_tags_tag_idx ON note_tags (tag_id, note_id);
```

The first index supports the common query that lists one user's notes in update order without scanning every user's rows. The `note_tags` primary key already indexes lookups by `note_id`; the second index supports finding notes by tag efficiently.

## Why SQL

Notes have clear ownership, tags have explicit many-to-many relationships, and creating or deleting a note and its associations should preserve referential integrity. PostgreSQL provides transactions, foreign keys, unique constraints, and flexible indexed queries for those needs. A document database could store a note and its tags together, but shared tags and relationship queries would require duplicated data or extra application-side consistency work. At the estimated scale, one properly indexed SQL database with read replicas is a simpler starting point; sharding is unnecessary until measurements show a single primary cannot keep up.
