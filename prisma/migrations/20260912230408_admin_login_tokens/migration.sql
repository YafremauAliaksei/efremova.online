-- CreateTable
CREATE TABLE "admin_login_tokens" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "issuedBy" TEXT NOT NULL DEFAULT 'cli',
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "usedAt" TIMESTAMPTZ,
    "usedIp" INET,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_login_tokens_tokenHash_key" ON "admin_login_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "admin_login_tokens_expiresAt_idx" ON "admin_login_tokens"("expiresAt");
