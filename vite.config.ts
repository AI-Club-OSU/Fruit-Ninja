import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  lint: {
    plugins: ["react", "typescript", "oxc"],
    rules: {
      "react/rules-of-hooks": "error",
      "react/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
        },
      ],
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
