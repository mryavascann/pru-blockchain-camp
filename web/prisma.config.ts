// ============================================================================
// Prisma CLI yapılandırması
//
// Not: Prisma CLI (migrate, generate, studio) Next.js'in ortam değişkeni
// yükleyicisini kullanmaz. Bu yüzden `.env.local` dosyasını burada AÇIKÇA
// yüklüyoruz — böylece projede tek bir sır dosyası olur ve `DATABASE_URL`
// iki yerde tutulmak zorunda kalmaz.
// ============================================================================
import {config} from "dotenv";
import {defineConfig} from "prisma/config";

config({path: ".env.local"});

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
