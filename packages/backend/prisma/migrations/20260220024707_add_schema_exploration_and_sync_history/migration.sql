-- CreateTable
CREATE TABLE "schema_explorations" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "database_count" INTEGER NOT NULL,
    "table_count" INTEGER NOT NULL,
    "column_count" INTEGER NOT NULL,
    "schema_data" JSONB NOT NULL,
    "explored_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schema_explorations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_histories" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "assets_created_count" INTEGER NOT NULL DEFAULT 0,
    "assets_updated_count" INTEGER NOT NULL DEFAULT 0,
    "asset_failed_count" INTEGER NOT NULL DEFAULT 0,
    "sync_type" TEXT NOT NULL DEFAULT 'INCREMENTAL',
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "error_message" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schema_explorations_connection_id_idx" ON "schema_explorations"("connection_id");

-- CreateIndex
CREATE INDEX "schema_explorations_explored_at_idx" ON "schema_explorations"("explored_at");

-- CreateIndex
CREATE INDEX "sync_histories_connection_id_idx" ON "sync_histories"("connection_id");

-- CreateIndex
CREATE INDEX "sync_histories_synced_at_idx" ON "sync_histories"("synced_at");

-- AddForeignKey
ALTER TABLE "schema_explorations" ADD CONSTRAINT "schema_explorations_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "data_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_histories" ADD CONSTRAINT "sync_histories_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "data_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
