-- CreateTable
CREATE TABLE "sso_configurations" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "client_id" TEXT,
    "client_secret" TEXT,
    "discovery_url" TEXT,
    "ldap_server" TEXT,
    "ldap_port" INTEGER,
    "ldap_base_dn" TEXT,
    "ldap_bind_dn" TEXT,
    "ldap_bind_password" TEXT,
    "ldap_user_filter" TEXT,
    "saml_metadata_url" TEXT,
    "saml_cert" TEXT,
    "saml_private_key" TEXT,
    "custom_config" JSONB,
    "test_result" JSONB,
    "last_tested_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sso_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sso_configurations_provider_name_key" ON "sso_configurations"("provider", "name");
