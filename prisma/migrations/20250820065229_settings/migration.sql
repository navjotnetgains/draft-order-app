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
    "id" TEXT NOT NULL,
    "doubleDraftOrdersEnabled" BOOLEAN NOT NULL,
    "discount1" DOUBLE PRECISION,
    "discount2" DOUBLE PRECISION,
    "singleDiscount" DOUBLE PRECISION,
    "tag1" TEXT,
    "tag2" TEXT,
    "singleTag" TEXT,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);
