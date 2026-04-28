import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: "..",
  server: {
    host: true, // <--- DÒNG QUAN TRỌNG NHẤT: Cho phép truy cập từ bên ngoài
    port: 5173, // Đảm bảo chạy đúng port này
    watch: {
      usePolling: true, // Bắt buộc khi chạy trên máy ảo/Docker để hot-reload hoạt động
    },
  },
});
