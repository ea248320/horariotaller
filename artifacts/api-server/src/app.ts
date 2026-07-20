import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";

const app: Express = express();

app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Keep-alive ping — prevents Railway from sleeping
app.get("/api/ping", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use("/api", router);

export default app;
