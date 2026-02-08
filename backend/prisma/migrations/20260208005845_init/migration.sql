-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER', 'TRAINEE');

-- CreateEnum
CREATE TYPE "Diretorias" AS ENUM ('COMERCIAL');

-- CreateEnum
CREATE TYPE "Eixos" AS ENUM ('CONEXOES', 'VENDAS', 'EXPERIENCIA');

-- CreateEnum
CREATE TYPE "Cargo" AS ENUM ('GERENTEVENDAS', 'GERENTECONEXOES', 'GERENTEXP');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TRAINEE',
    "diretorias" "Diretorias" NOT NULL DEFAULT 'COMERCIAL',
    "eixo" "Eixos",
    "cargo" "Cargo",
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
