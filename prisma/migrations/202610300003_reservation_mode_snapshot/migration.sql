-- Impact reporting must not change when a merchant later edits the listing mode.
ALTER TABLE "Reservation" ADD COLUMN "productMode" TEXT NOT NULL DEFAULT 'REGULAR';
UPDATE "Reservation" r SET "productMode" = p.mode FROM "Product" p WHERE p.id=r."productId";
