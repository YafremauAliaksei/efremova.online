-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "archivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_variants" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "format" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,

    CONSTRAINT "media_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_sourceHash_key" ON "media_assets"("sourceHash");

-- CreateIndex
CREATE INDEX "media_assets_archivedAt_createdAt_idx" ON "media_assets"("archivedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "media_variants_hash_key" ON "media_variants"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "media_variants_assetId_format_width_key" ON "media_variants"("assetId", "format", "width");

-- AddForeignKey
ALTER TABLE "media_variants" ADD CONSTRAINT "media_variants_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
