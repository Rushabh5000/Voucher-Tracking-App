import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "frontend/src"),
      // Prisma client lives in backend/node_modules — alias so vi.mock("@prisma/client") works
      "@prisma/client": path.resolve(__dirname, "backend/node_modules/@prisma/client"),
    },
  },
});
