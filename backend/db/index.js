import Database from "better-sqlite3";

const db = new Database("sage.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS registrations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    phone           TEXT    NOT NULL UNIQUE,
    registered_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);

export const getRegistration    = db.prepare("SELECT * FROM registrations WHERE phone = ?");
export const insertRegistration = db.prepare("INSERT INTO registrations (phone) VALUES (?)");

export default db;
