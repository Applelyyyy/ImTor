-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "demoBatchId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'MARKET',
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "open" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "demoBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreMember" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',

    CONSTRAINT "StoreMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketVenue" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ตลาดนัด',
    "description" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "entrance" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "layoutImage" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "demoBatchId" TEXT,

    CONSTRAINT "MarketVenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketZone" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "MarketZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketStall" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "directions" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MarketStall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketScheduleRule" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "opens" TEXT NOT NULL,
    "closes" TEXT NOT NULL,
    "intervalWeeks" INTEGER NOT NULL DEFAULT 1,
    "anchorDate" TEXT NOT NULL DEFAULT '2026-01-05',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MarketScheduleRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketScheduleException" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "opens" TEXT,
    "closes" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MarketScheduleException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSession" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "demoBatchId" TEXT,

    CONSTRAINT "MarketSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreAttendance" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "expectedArrival" TEXT,
    "sellingUntil" TEXT,
    "authorized" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StoreAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StallAssignment" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "stallId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StallAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceTemplate" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "preferredCode" TEXT,

    CONSTRAINT "AttendanceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "food" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sessionId" TEXT,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'REGULAR',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "reservable" BOOLEAN NOT NULL DEFAULT false,
    "stock" INTEGER,
    "pickupStart" TIMESTAMP(3),
    "pickupEnd" TIMESTAMP(3),
    "allergens" TEXT,
    "storage" TEXT,
    "demoBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountRule" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "kind" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "repeatStart" TEXT,
    "repeatEnd" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DiscountRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "originalPrice" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "pickupCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "demoBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "reservationId" TEXT,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoBatch" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "approvedKey" TEXT,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_demoBatchId_idx" ON "User"("demoBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");

-- CreateIndex
CREATE INDEX "Store_demoBatchId_idx" ON "Store"("demoBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreMember_storeId_userId_key" ON "StoreMember"("storeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketVenue_slug_key" ON "MarketVenue"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MarketZone_marketId_name_key" ON "MarketZone"("marketId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MarketStall_marketId_code_key" ON "MarketStall"("marketId", "code");

-- CreateIndex
CREATE INDEX "MarketScheduleRule_marketId_weekday_idx" ON "MarketScheduleRule"("marketId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "MarketScheduleException_marketId_date_key" ON "MarketScheduleException"("marketId", "date");

-- CreateIndex
CREATE INDEX "MarketSession_startsAt_endsAt_idx" ON "MarketSession"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketSession_marketId_date_key" ON "MarketSession"("marketId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StoreAttendance_storeId_sessionId_key" ON "StoreAttendance"("storeId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "StallAssignment_attendanceId_key" ON "StallAssignment"("attendanceId");

-- CreateIndex
CREATE INDEX "StallAssignment_stallId_startsAt_endsAt_idx" ON "StallAssignment"("stallId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceTemplate_storeId_marketId_weekday_key" ON "AttendanceTemplate"("storeId", "marketId", "weekday");

-- CreateIndex
CREATE INDEX "Product_published_archived_createdAt_idx" ON "Product"("published", "archived", "createdAt");

-- CreateIndex
CREATE INDEX "Product_storeId_idx" ON "Product"("storeId");

-- CreateIndex
CREATE INDEX "Product_demoBatchId_idx" ON "Product"("demoBatchId");

-- CreateIndex
CREATE INDEX "DiscountRule_productId_startsAt_endsAt_idx" ON "DiscountRule"("productId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_pickupCode_key" ON "Reservation"("pickupCode");

-- CreateIndex
CREATE INDEX "Reservation_status_expiresAt_idx" ON "Reservation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Reservation_userId_createdAt_idx" ON "Reservation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_key_key" ON "Upload"("key");

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreMember" ADD CONSTRAINT "StoreMember_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreMember" ADD CONSTRAINT "StoreMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketZone" ADD CONSTRAINT "MarketZone_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "MarketVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketStall" ADD CONSTRAINT "MarketStall_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "MarketVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketStall" ADD CONSTRAINT "MarketStall_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "MarketZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketScheduleRule" ADD CONSTRAINT "MarketScheduleRule_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "MarketVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketScheduleException" ADD CONSTRAINT "MarketScheduleException_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "MarketVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSession" ADD CONSTRAINT "MarketSession_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "MarketVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreAttendance" ADD CONSTRAINT "StoreAttendance_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreAttendance" ADD CONSTRAINT "StoreAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MarketSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StallAssignment" ADD CONSTRAINT "StallAssignment_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "StoreAttendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StallAssignment" ADD CONSTRAINT "StallAssignment_stallId_fkey" FOREIGN KEY ("stallId") REFERENCES "MarketStall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceTemplate" ADD CONSTRAINT "AttendanceTemplate_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceTemplate" ADD CONSTRAINT "AttendanceTemplate_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "MarketVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MarketSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Invariants are enforced even if an application caller is bypassed.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Product" ADD CONSTRAINT "Product_price_nonnegative" CHECK (price >= 0), ADD CONSTRAINT "Product_stock_nonnegative" CHECK (stock IS NULL OR stock >= 0);
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_quantity_positive" CHECK (quantity > 0), ADD CONSTRAINT "Reservation_price_nonnegative" CHECK ("unitPrice" >= 0 AND "originalPrice" >= 0);
ALTER TABLE "MarketStall" ADD CONSTRAINT "Stall_coordinates_normalized" CHECK (x BETWEEN 0 AND 1 AND y BETWEEN 0 AND 1);
ALTER TABLE "MarketSession" ADD CONSTRAINT "Session_valid_interval" CHECK ("endsAt" > "startsAt");
ALTER TABLE "StallAssignment" ADD CONSTRAINT "Stall_no_overlapping_assignments" EXCLUDE USING gist ("stallId" WITH =, tsrange("startsAt", "endsAt", '[)') WITH &&);
ALTER TABLE "StallAssignment" ADD CONSTRAINT "Assignment_valid_interval" CHECK ("endsAt" > "startsAt");
ALTER TABLE "MarketZone" ADD CONSTRAINT "Zone_id_market_unique" UNIQUE (id,"marketId");
ALTER TABLE "MarketStall" ADD CONSTRAINT "Stall_zone_market_consistent" FOREIGN KEY ("zoneId","marketId") REFERENCES "MarketZone" (id,"marketId");
