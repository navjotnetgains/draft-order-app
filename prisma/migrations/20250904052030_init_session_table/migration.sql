/*
  Warnings:

  - You are about to drop the `session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `setting` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."session";

-- DropTable
DROP TABLE "public"."setting";

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Setting" (
    "shop" TEXT NOT NULL,
    "doubleDraftOrdersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "discount1" DOUBLE PRECISION DEFAULT 0,
    "discount2" DOUBLE PRECISION DEFAULT 0,
    "tag1" TEXT DEFAULT '',
    "tag2" TEXT DEFAULT '',
    "singleDiscount" DOUBLE PRECISION DEFAULT 0,
    "singleTag" TEXT DEFAULT '',

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("shop")
);
