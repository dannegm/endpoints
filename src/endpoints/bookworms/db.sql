-- SUPABASE - PostgreSQL database schema for Bookworms application
--
-- Extensions required:
--   pg_trgm  — trigram similarity search (similarity(), gin_trgm_ops)

-- Schema and privileges

CREATE SCHEMA IF NOT EXISTS bookworms;

GRANT USAGE ON SCHEMA bookworms TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA bookworms TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA bookworms TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA bookworms TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA bookworms GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA bookworms GRANT ALL ON ROUTINES  TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA bookworms GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- Tables

CREATE TABLE IF NOT EXISTS bookworms.authors (
    id               SERIAL       PRIMARY KEY,
    name             VARCHAR(255) UNIQUE NOT NULL,
    name_normalized  VARCHAR(255) NOT NULL,
    views            INT          DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bookworms.series (
    id               SERIAL       PRIMARY KEY,
    name             VARCHAR(255) UNIQUE NOT NULL,
    name_normalized  VARCHAR(255) NOT NULL,
    views            INT          DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bookworms.books (
    id                     SERIAL       PRIMARY KEY,
    libid                  INT          UNIQUE NOT NULL,
    title                  VARCHAR(255) NOT NULL,
    title_normalized       VARCHAR(255) NOT NULL,
    cover_id               INT,
    description            TEXT,
    labels                 TEXT[],
    published              INT,
    pagecount              INT,
    sha256sum              VARCHAR(64),
    size                   INT,
    filename               VARCHAR(255),
    serie_name             VARCHAR(255),
    serie_name_normalized  VARCHAR(255),
    serie_sequence         FLOAT,
    views                  INT DEFAULT 0,
    downloads              INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bookworms.authors_books (
    book_id    INT NOT NULL REFERENCES bookworms.books,
    author_id  INT NOT NULL REFERENCES bookworms.authors,
    PRIMARY KEY (book_id, author_id)
);

CREATE TABLE IF NOT EXISTS bookworms.series_books (
    book_id   INT NOT NULL REFERENCES bookworms.books,
    serie_id  INT NOT NULL REFERENCES bookworms.series,
    PRIMARY KEY (book_id, serie_id)
);

-- Indexes

CREATE INDEX idx_books_id                ON bookworms.books(id);
CREATE INDEX idx_books_filename          ON bookworms.books(filename);
CREATE INDEX idx_books_title_normalized  ON bookworms.books(title_normalized);
CREATE INDEX idx_books_views             ON bookworms.books(views);
CREATE INDEX idx_books_downloads         ON bookworms.books(downloads);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_books_title_trgm   ON bookworms.books    USING GIN (title_normalized  gin_trgm_ops);
CREATE INDEX idx_authors_name_trgm  ON bookworms.authors  USING GIN (name_normalized   gin_trgm_ops);
CREATE INDEX idx_series_name_trgm   ON bookworms.series   USING GIN (name_normalized   gin_trgm_ops);

-- Search functions

-- Books
CREATE OR REPLACE FUNCTION bookworms.search_books_similar(
    q           TEXT,
    threshold   REAL DEFAULT 0.3,
    from_index  INT  DEFAULT 1,
    to_index    INT  DEFAULT 10
)
RETURNS TABLE (
    libid          TEXT,
    title          TEXT,
    filename       TEXT,
    cover_id       INT,
    views          INT,
    downloads      INT,
    serie_name     TEXT,
    serie_sequence INT,
    authors        JSON
)
LANGUAGE SQL AS $$
    SELECT
        b.libid,
        b.title,
        b.filename,
        b.cover_id,
        b.views,
        b.downloads,
        b.serie_name,
        b.serie_sequence,
        json_agg(json_build_object('name', a.name)) AS authors
    FROM bookworms.books b
    LEFT JOIN bookworms.authors_books ba ON ba.book_id = b.id
    LEFT JOIN bookworms.authors a        ON a.id = ba.author_id
    WHERE similarity(b.title_normalized, q) > threshold
    GROUP BY b.id
    ORDER BY similarity(b.title_normalized, q) DESC
    OFFSET (from_index - 1)
    LIMIT  (to_index - from_index + 1)
$$;

-- Authors
CREATE OR REPLACE FUNCTION bookworms.search_authors_similar(
    q           TEXT,
    threshold   REAL DEFAULT 0.3,
    from_index  INT  DEFAULT 1,
    to_index    INT  DEFAULT 10
)
RETURNS TABLE (
    id           INT,
    name         TEXT,
    views        INT,
    books_count  INT
)
LANGUAGE SQL AS $$
    SELECT
        a.id,
        a.name,
        a.views,
        count(ba.book_id) AS books_count
    FROM bookworms.authors a
    LEFT JOIN bookworms.authors_books ba ON ba.author_id = a.id
    WHERE similarity(a.name_normalized, q) > threshold
    GROUP BY a.id
    ORDER BY similarity(a.name_normalized, q) DESC
    OFFSET (from_index - 1)
    LIMIT  (to_index - from_index + 1)
$$;

-- Series
CREATE OR REPLACE FUNCTION bookworms.search_series_similar(
    q           TEXT,
    threshold   REAL DEFAULT 0.3,
    from_index  INT  DEFAULT 1,
    to_index    INT  DEFAULT 10
)
RETURNS TABLE (
    id           INT,
    name         TEXT,
    views        INT,
    books_count  INT
)
LANGUAGE SQL AS $$
    SELECT
        s.id,
        s.name,
        s.views,
        count(bs.book_id) AS books_count
    FROM bookworms.series s
    LEFT JOIN bookworms.series_books bs ON bs.serie_id = s.id
    WHERE similarity(s.name_normalized, q) > threshold
    GROUP BY s.id
    ORDER BY similarity(s.name_normalized, q) DESC
    OFFSET (from_index - 1)
    LIMIT  (to_index - from_index + 1)
$$;

-- Categories
DROP FUNCTION bookworms.match_books_by_label(text, real, integer, integer);

CREATE OR REPLACE FUNCTION bookworms.match_books_by_label(
    q           TEXT,
    threshold   REAL DEFAULT 0.3,
    from_index  INT  DEFAULT 1,
    to_index    INT  DEFAULT 10
)
RETURNS TABLE (
    libid          TEXT,
    title          TEXT,
    filename       TEXT,
    cover_id       INT,
    views          INT,
    downloads      INT,
    serie_name     TEXT,
    serie_sequence INT,
    labels         TEXT[],
    authors        JSON
)
LANGUAGE SQL AS $$
    SELECT
        b.libid,
        b.title,
        b.filename,
        b.cover_id,
        b.views,
        b.downloads,
        b.serie_name,
        b.serie_sequence,
        b.labels,
        json_agg(json_build_object('name', a.name)) AS authors
    FROM bookworms.books b
    LEFT JOIN bookworms.authors_books ba ON ba.book_id = b.id
    LEFT JOIN bookworms.authors a        ON a.id = ba.author_id
    WHERE EXISTS (
        SELECT 1
        FROM unnest(labels) AS label
        WHERE similarity(
            lower(label),
            replace(lower(q), '-', ' ')
        ) > threshold
    )
    GROUP BY b.id
    ORDER BY similarity(b.title_normalized, q) DESC
    OFFSET (from_index - 1)
    LIMIT  (to_index - from_index + 1)
$$;

-- Count functions

-- Books
CREATE OR REPLACE FUNCTION bookworms.count_books_similar(
    q          TEXT,
    threshold  REAL DEFAULT 0.3
)
RETURNS INT
LANGUAGE SQL AS $$
    SELECT count(DISTINCT b.id)
    FROM bookworms.books b
    WHERE similarity(b.title_normalized, q) > threshold
$$;

-- Books by label
CREATE OR REPLACE FUNCTION bookworms.count_books_by_label(
    q          TEXT,
    threshold  REAL DEFAULT 0.3
)
RETURNS INT
LANGUAGE SQL AS $$
    SELECT count(DISTINCT b.id)
    FROM bookworms.books b
    WHERE EXISTS (
        SELECT 1
        FROM unnest(labels) AS label
        WHERE similarity(lower(label), lower(q)) > threshold
    )
$$;

-- Authors
CREATE OR REPLACE FUNCTION bookworms.count_authors_similar(
    q          TEXT,
    threshold  REAL DEFAULT 0.3
)
RETURNS INT
LANGUAGE SQL AS $$
    SELECT count(DISTINCT a.id)
    FROM bookworms.authors a
    WHERE similarity(a.name_normalized, q) > threshold
$$;

-- Series
CREATE OR REPLACE FUNCTION bookworms.count_series_similar(
    q          TEXT,
    threshold  REAL DEFAULT 0.3
)
RETURNS INT
LANGUAGE SQL AS $$
    SELECT count(DISTINCT s.id)
    FROM bookworms.series s
    WHERE similarity(s.name_normalized, q) > threshold
$$;

-- Increment functions

CREATE OR REPLACE FUNCTION bookworms.increment_field(
    target_table   TEXT,
    target_column  TEXT,
    target_id      INT
)
RETURNS VOID AS $$
DECLARE
    sql TEXT;
BEGIN
    sql := FORMAT(
        'UPDATE bookworms.%I SET %I = %I + 1 WHERE id = $1',
        target_table, target_column, target_column
    );
    EXECUTE sql USING target_id;
END;
$$ LANGUAGE plpgsql;

-- Settings

CREATE SCHEMA IF NOT EXISTS bookworms;

CREATE TABLE IF NOT EXISTS bookworms.settings (
    key         TEXT        PRIMARY KEY,
    value       JSONB       NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION bookworms.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_updated_at
BEFORE UPDATE ON bookworms.settings
FOR EACH ROW EXECUTE FUNCTION bookworms.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_settings_value_gin
ON bookworms.settings
USING GIN (value);

COMMENT ON TABLE bookworms.settings IS 'Stores system-wide key-value configuration settings as JSONB';

INSERT INTO bookworms.settings (key, value)
VALUES
    ('bucket.status',        'false'::jsonb),
    ('bucket.offline_until', 'null'::jsonb);
