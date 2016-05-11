CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  dt TEXT NOT NULL,
  message TEXT NOT NULL,
  sender INTEGER NOT NULL,
  receiver INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  dt TEXT NOT NULL,
  username TEXT NOT NULL,
  pass_hash TEXT NOT NULL
);