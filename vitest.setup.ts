// Mock Next.js "server-only" module for Vitest
import { vi } from "vitest";

vi.mock("server-only", () => ({}));