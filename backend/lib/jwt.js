import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding:  { type: "spki",  format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

export { publicKey };

export function makeToken(username) {
  return jwt.sign(
    { sub: username },
    privateKey,
    { algorithm: "RS256", expiresIn: "7d", issuer: "sage-app" }
  );
}
