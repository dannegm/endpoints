CREATE TABLE didntread.fingerprints (
    id serial PRIMARY KEY,
    fingerprint text UNIQUE NOT NULL,
    tokens integer NOT NULL DEFAULT 5,
    created_at timestamp with time zone DEFAULT current_timestamp
);

CREATE TABLE didntread.transactions (
    id serial PRIMARY KEY,
    fingerprint text NOT NULL,
    tokens integer NOT NULL,
    type text NOT NULL CHECK (type IN ('spent', 'earned', 'failed')),
    source text NOT NULL,  -- Este campo almacena el endpoint o el motivo de la transacción
    payload json,  -- Este campo almacenará el cuerpo completo en formato JSON
    created_at timestamp with time zone DEFAULT current_timestamp
);

CREATE TABLE didntread.abstracts (
    id SERIAL PRIMARY KEY,
    author TEXT,
    date TIMESTAMPTZ,
    description TEXT,
    image TEXT,
    logo TEXT,
    publisher TEXT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    resume TEXT NOT NULL,
    lang TEXT NOT NULL,
    hash TEXT NOT NULL UNIQUE
);

CREATE TABLE didntread.fingerprint_abstracts (
    id SERIAL PRIMARY KEY,
    fingerprint TEXT REFERENCES didntread.fingerprints(fingerprint) ON DELETE CASCADE,
    hash TEXT REFERENCES didntread.abstracts(hash) ON DELETE CASCADE,
    UNIQUE(fingerprint, hash)
);
