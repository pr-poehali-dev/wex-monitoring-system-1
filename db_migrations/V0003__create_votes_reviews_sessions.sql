CREATE TABLE votes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  server_id INTEGER REFERENCES servers(id),
  voted_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_votes_unique ON votes(user_id, server_id, DATE(voted_at));

CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  server_id INTEGER REFERENCES servers(id),
  stars INTEGER CHECK (stars BETWEEN 1 AND 5),
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
  id VARCHAR(128) PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX idx_servers_category ON servers(category);
CREATE INDEX idx_servers_version ON servers(version);
CREATE INDEX idx_votes_server ON votes(server_id);
CREATE INDEX idx_reviews_server ON reviews(server_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);