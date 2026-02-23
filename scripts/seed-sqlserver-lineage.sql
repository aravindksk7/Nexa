USE nexa_mock_catalog;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('sales.order_items', 'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_order_items_orders'
  )
  BEGIN
    ALTER TABLE sales.order_items
      ADD CONSTRAINT FK_order_items_orders
      FOREIGN KEY (order_id) REFERENCES sales.orders(order_id);
  END

  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_order_items_products'
  )
  BEGIN
    ALTER TABLE sales.order_items
      ADD CONSTRAINT FK_order_items_products
      FOREIGN KEY (product_id) REFERENCES sales.products(product_id);
  END
END
GO

IF OBJECT_ID('sales.orders', 'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_orders_customers'
  )
  BEGIN
    ALTER TABLE sales.orders
      ADD CONSTRAINT FK_orders_customers
      FOREIGN KEY (customer_id) REFERENCES sales.customers(customer_id);
  END
END
GO

IF OBJECT_ID('ops.sync_jobs', 'U') IS NULL
BEGIN
  CREATE TABLE ops.sync_jobs (
    job_id INT IDENTITY(1,1) PRIMARY KEY,
    source_system NVARCHAR(80) NOT NULL,
    target_system NVARCHAR(80) NOT NULL,
    started_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    completed_at DATETIME2 NULL,
    status NVARCHAR(20) NOT NULL,
    run_by NVARCHAR(120) NOT NULL
  );
END
GO

IF OBJECT_ID('ops.sync_job_assets', 'U') IS NULL
BEGIN
  CREATE TABLE ops.sync_job_assets (
    job_asset_id INT IDENTITY(1,1) PRIMARY KEY,
    job_id INT NOT NULL,
    asset_type NVARCHAR(40) NOT NULL,
    asset_name NVARCHAR(120) NOT NULL,
    rows_processed INT NOT NULL,
    status NVARCHAR(20) NOT NULL,
    CONSTRAINT FK_sync_job_assets_job FOREIGN KEY (job_id) REFERENCES ops.sync_jobs(job_id)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM ops.sync_jobs)
BEGIN
  INSERT INTO ops.sync_jobs (source_system, target_system, status, run_by, completed_at)
  VALUES
    ('SQLSERVER', 'CATALOG', 'SUCCESS', 'admin@dataplatform.com', DATEADD(minute, 2, SYSUTCDATETIME())),
    ('SQLSERVER', 'CATALOG', 'SUCCESS', 'admin@dataplatform.com', DATEADD(minute, 5, SYSUTCDATETIME()));
END
GO

IF NOT EXISTS (SELECT 1 FROM ops.sync_job_assets)
BEGIN
  INSERT INTO ops.sync_job_assets (job_id, asset_type, asset_name, rows_processed, status)
  VALUES
    (1, 'TABLE', 'sales.customers', 5, 'SUCCESS'),
    (1, 'TABLE', 'sales.orders', 5, 'SUCCESS'),
    (1, 'TABLE', 'sales.order_items', 11, 'SUCCESS'),
    (2, 'TABLE', 'sales.products', 5, 'SUCCESS'),
    (2, 'TABLE', 'hr.employees', 5, 'SUCCESS');
END
GO

IF OBJECT_ID('sales.vw_order_lineage_demo', 'V') IS NULL
BEGIN
  EXEC('CREATE VIEW sales.vw_order_lineage_demo AS
    SELECT
      o.order_id,
      o.order_date,
      c.customer_code,
      c.full_name AS customer_name,
      p.sku AS product_sku,
      p.product_name,
      oi.quantity,
      oi.unit_price,
      oi.line_amount
    FROM sales.orders o
    INNER JOIN sales.customers c ON c.customer_id = o.customer_id
    INNER JOIN sales.order_items oi ON oi.order_id = o.order_id
    INNER JOIN sales.products p ON p.product_id = oi.product_id');
END
GO

PRINT 'SQL Server lineage demo data and foreign keys are ready.';
GO
