-- CreateTable
CREATE TABLE "public"."session" (
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

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."setting" (
    "shop" TEXT NOT NULL,
    "doubleDraftOrdersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "discount1" DOUBLE PRECISION DEFAULT 0,
    "discount2" DOUBLE PRECISION DEFAULT 0,
    "tag1" TEXT DEFAULT '',
    "tag2" TEXT DEFAULT '',
    "singleDiscount" DOUBLE PRECISION DEFAULT 0,
    "singleTag" TEXT DEFAULT '',

    CONSTRAINT "setting_pkey" PRIMARY KEY ("shop")
);
