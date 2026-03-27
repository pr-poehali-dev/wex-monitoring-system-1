CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  avatar_url TEXT,
  auth_provider VARCHAR(20) DEFAULT 'email',
  provider_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);