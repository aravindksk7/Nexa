-- CreateEnum
CREATE TYPE "ColumnTransformationType" AS ENUM ('DIRECT', 'DERIVED', 'AGGREGATED', 'FILTERED', 'JOINED', 'CASE', 'COALESCED');

-- CreateEnum
CREATE TYPE "BusinessTermStatus" AS ENUM ('DRAFT', 'APPROVED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "MappingType" AS ENUM ('EXACT', 'CONTAINS', 'DERIVES', 'RELATED');

-- CreateTable
CREATE TABLE "column_lineage_edges" (
    "id" TEXT NOT NULL,
    "source_asset_id" TEXT NOT NULL,
    "source_column" TEXT NOT NULL,
    "target_asset_id" TEXT NOT NULL,
    "target_column" TEXT NOT NULL,
    "transformation_type" "ColumnTransformationType" NOT NULL,
    "transformation_expression" TEXT,
    "lineage_edge_id" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "column_lineage_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_domains" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_terms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "domain_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "status" "BusinessTermStatus" NOT NULL DEFAULT 'DRAFT',
    "synonyms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "related_terms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semantic_mappings" (
    "id" TEXT NOT NULL,
    "business_term_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "column_name" TEXT,
    "mapping_type" "MappingType" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "description" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semantic_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "column_lineage_edges_source_asset_id_source_column_idx" ON "column_lineage_edges"("source_asset_id", "source_column");

-- CreateIndex
CREATE INDEX "column_lineage_edges_target_asset_id_target_column_idx" ON "column_lineage_edges"("target_asset_id", "target_column");

-- CreateIndex
CREATE INDEX "column_lineage_edges_lineage_edge_id_idx" ON "column_lineage_edges"("lineage_edge_id");

-- CreateIndex
CREATE UNIQUE INDEX "column_lineage_edges_source_asset_id_source_column_target_a_key" ON "column_lineage_edges"("source_asset_id", "source_column", "target_asset_id", "target_column");

-- CreateIndex
CREATE UNIQUE INDEX "business_domains_name_key" ON "business_domains"("name");

-- CreateIndex
CREATE INDEX "business_domains_parent_id_idx" ON "business_domains"("parent_id");

-- CreateIndex
CREATE INDEX "business_terms_domain_id_idx" ON "business_terms"("domain_id");

-- CreateIndex
CREATE INDEX "business_terms_owner_id_idx" ON "business_terms"("owner_id");

-- CreateIndex
CREATE INDEX "business_terms_status_idx" ON "business_terms"("status");

-- CreateIndex
CREATE UNIQUE INDEX "business_terms_name_domain_id_key" ON "business_terms"("name", "domain_id");

-- CreateIndex
CREATE INDEX "semantic_mappings_business_term_id_idx" ON "semantic_mappings"("business_term_id");

-- CreateIndex
CREATE INDEX "semantic_mappings_asset_id_idx" ON "semantic_mappings"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "semantic_mappings_business_term_id_asset_id_column_name_key" ON "semantic_mappings"("business_term_id", "asset_id", "column_name");

-- AddForeignKey
ALTER TABLE "column_lineage_edges" ADD CONSTRAINT "column_lineage_edges_source_asset_id_fkey" FOREIGN KEY ("source_asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "column_lineage_edges" ADD CONSTRAINT "column_lineage_edges_target_asset_id_fkey" FOREIGN KEY ("target_asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "column_lineage_edges" ADD CONSTRAINT "column_lineage_edges_lineage_edge_id_fkey" FOREIGN KEY ("lineage_edge_id") REFERENCES "lineage_edges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_domains" ADD CONSTRAINT "business_domains_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "business_domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_terms" ADD CONSTRAINT "business_terms_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "business_domains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_terms" ADD CONSTRAINT "business_terms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semantic_mappings" ADD CONSTRAINT "semantic_mappings_business_term_id_fkey" FOREIGN KEY ("business_term_id") REFERENCES "business_terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semantic_mappings" ADD CONSTRAINT "semantic_mappings_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semantic_mappings" ADD CONSTRAINT "semantic_mappings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
