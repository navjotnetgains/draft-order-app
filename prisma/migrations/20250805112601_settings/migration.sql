-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doubleDraftOrdersEnabled" BOOLEAN NOT NULL,
    "discount1" REAL,
    "discount2" REAL,
    "singleDiscount" REAL,
    "tag1" TEXT,
    "tag2" TEXT,
    "singleTag" TEXT
);
