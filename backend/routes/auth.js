import { Router } from "express";
import bcrypt from "bcrypt";
import { getUser, insertUser } from "../db/index.js";
import { makeToken, publicKey } from "../lib/jwt.js";

const router = Router();
const SALT_ROUNDS = 12;

// GET /api/auth/public-key
router.get("/public-key", (_req, res) => {
  res.type("text/plain").send(publicKey);
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password)  return res.status(400).json({ error: "Username and password required." });
  if (username.length < 3)     return res.status(400).json({ error: "Username must be at least 3 characters." });
  if (password.length < 8)     return res.status(400).json({ error: "Password must be at least 8 characters." });
  if (getUser.get(username))   return res.status(409).json({ error: "Username already taken." });

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  insertUser.run(username, passwordHash);

  console.log("Registered:", username);
  res.json({ token: makeToken(username) });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) return res.status(400).json({ error: "Username and password required." });

  const user = getUser.get(username);
  if (!user) return res.status(401).json({ error: "Invalid username or password." });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: "Invalid username or password." });

  console.log("Login:", username);
  res.json({ token: makeToken(username) });
});

export default router;
