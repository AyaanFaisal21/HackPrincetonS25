import express from "express";
import cors from "cors";
import "dotenv/config";
import registerRoute from "./routes/register.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/register", registerRoute);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Sage backend on port ${PORT}`));
