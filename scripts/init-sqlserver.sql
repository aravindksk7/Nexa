IF DB_ID('nexa_mock_catalog') IS NULL
BEGIN
  CREATE DATABASE nexa_mock_catalog;
END;
GO

USE nexa_mock_catalog;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF SCHEMA_ID('sales') IS NULL EXEC('CREATE SCHEMA sales');
IF SCHEMA_ID('hr') IS NULL EXEC('CREATE SCHEMA hr');
IF SCHEMA_ID('ops') IS NULL EXEC('CREATE SCHEMA ops');
GO

IF OBJECT_ID('sales.customers', 'U') IS NULL
BEGIN
  CREATE TABLE sales.customers (
    customer_id INT IDENTITY(1,1) PRIMARY KEY,
    customer_code NVARCHAR(20) NOT NULL UNIQUE,
    full_name NVARCHAR(120) NOT NULL,
    email NVARCHAR(200) NULL,
    region NVARCHAR(60) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF OBJECT_ID('sales.products', 'U') IS NULL
BEGIN
  CREATE TABLE sales.products (
    product_id INT IDENTITY(1,1) PRIMARY KEY,
    sku NVARCHAR(30) NOT NULL UNIQUE,
    product_name NVARCHAR(120) NOT NULL,
    category NVARCHAR(80) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    active BIT NOT NULL DEFAULT 1
  );
END;
GO

IF OBJECT_ID('sales.orders', 'U') IS NULL
BEGIN
  CREATE TABLE sales.orders (
    order_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    customer_id INT NOT NULL,
    order_date DATE NOT NULL,
    order_status NVARCHAR(30) NOT NULL,
    total_amount DECIMAL(14,2) NOT NULL,
    CONSTRAINT FK_orders_customer FOREIGN KEY (customer_id) REFERENCES sales.customers(customer_id)
  );
END;
GO

IF OBJECT_ID('sales.order_items', 'U') IS NULL
BEGIN
  CREATE TABLE sales.order_items (
    order_item_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    line_amount AS (quantity * unit_price) PERSISTED,
    CONSTRAINT FK_order_items_order FOREIGN KEY (order_id) REFERENCES sales.orders(order_id),
    CONSTRAINT FK_order_items_product FOREIGN KEY (product_id) REFERENCES sales.products(product_id)
  );
END;
GO

IF OBJECT_ID('hr.employees', 'U') IS NULL
BEGIN
  CREATE TABLE hr.employees (
    employee_id INT IDENTITY(1001,1) PRIMARY KEY,
    employee_code NVARCHAR(20) NOT NULL UNIQUE,
    full_name NVARCHAR(120) NOT NULL,
    department NVARCHAR(80) NOT NULL,
    job_title NVARCHAR(80) NOT NULL,
    hire_date DATE NOT NULL,
    salary DECIMAL(12,2) NOT NULL
  );
END;
GO

IF OBJECT_ID('ops.system_events', 'U') IS NULL
BEGIN
  CREATE TABLE ops.system_events (
    event_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    event_type NVARCHAR(60) NOT NULL,
    severity NVARCHAR(20) NOT NULL,
    source_system NVARCHAR(80) NOT NULL,
    event_time DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    payload NVARCHAR(MAX) NULL
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sales.customers)
BEGIN
  INSERT INTO sales.customers (customer_code, full_name, email, region)
  VALUES
    ('CUST-0001', 'Aarav Shah', 'aarav.shah@example.com', 'APAC'),
    ('CUST-0002', 'Olivia Nguyen', 'olivia.nguyen@example.com', 'ANZ'),
    ('CUST-0003', 'Liam Chen', 'liam.chen@example.com', 'APAC'),
    ('CUST-0004', 'Sophia Patel', 'sophia.patel@example.com', 'EMEA'),
    ('CUST-0005', 'Noah Kim', 'noah.kim@example.com', 'NA');
END;
GO

IF NOT EXISTS (SELECT 1 FROM sales.products)
BEGIN
  INSERT INTO sales.products (sku, product_name, category, unit_price, active)
  VALUES
    ('SKU-LAP-15', 'NexaBook 15', 'Laptop', 1499.00, 1),
    ('SKU-MON-27', 'NexaDisplay 27', 'Monitor', 389.00, 1),
    ('SKU-KBD-MX', 'NexaKeys MX', 'Accessory', 129.00, 1),
    ('SKU-MSE-PR', 'NexaMouse Pro', 'Accessory', 89.00, 1),
    ('SKU-DOCK-8', 'NexaDock 8-in-1', 'Accessory', 179.00, 1);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sales.orders)
BEGIN
  INSERT INTO sales.orders (customer_id, order_date, order_status, total_amount)
  VALUES
    (1, '2026-01-03', 'SHIPPED', 2017.00),
    (2, '2026-01-07', 'DELIVERED', 1499.00),
    (3, '2026-01-12', 'PROCESSING', 647.00),
    (4, '2026-01-15', 'DELIVERED', 2677.00),
    (5, '2026-01-19', 'CANCELLED', 389.00);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sales.order_items)
BEGIN
  INSERT INTO sales.order_items (order_id, product_id, quantity, unit_price)
  VALUES
    (1, 1, 1, 1499.00),
    (1, 3, 2, 129.00),
    (1, 4, 1, 89.00),
    (1, 5, 1, 179.00),
    (2, 1, 1, 1499.00),
    (3, 2, 1, 389.00),
    (3, 3, 2, 129.00),
    (4, 1, 1, 1499.00),
    (4, 2, 2, 389.00),
    (4, 5, 2, 179.00),
    (5, 2, 1, 389.00);
END;
GO

IF NOT EXISTS (SELECT 1 FROM hr.employees)
BEGIN
  INSERT INTO hr.employees (employee_code, full_name, department, job_title, hire_date, salary)
  VALUES
    ('EMP-1001', 'Mia Johnson', 'Engineering', 'Senior Data Engineer', '2021-06-10', 145000.00),
    ('EMP-1002', 'Ethan Brown', 'Sales', 'Account Executive', '2022-02-14', 98000.00),
    ('EMP-1003', 'Isabella Davis', 'Operations', 'Operations Analyst', '2020-09-21', 87000.00),
    ('EMP-1004', 'Lucas Martin', 'Engineering', 'Backend Engineer', '2023-01-30', 122000.00),
    ('EMP-1005', 'Amelia Wilson', 'Finance', 'Financial Analyst', '2019-11-05', 103000.00);
END;
GO

IF NOT EXISTS (SELECT 1 FROM ops.system_events)
BEGIN
  INSERT INTO ops.system_events (event_type, severity, source_system, payload)
  VALUES
    ('LOGIN_SUCCESS', 'INFO', 'auth-service', '{"user":"admin@dataplatform.com","ip":"10.10.1.14"}'),
    ('SYNC_STARTED', 'INFO', 'metadata-sync', '{"source":"sqlserver","jobId":"job-20260223-01"}'),
    ('SCHEMA_CHANGE_DETECTED', 'WARN', 'catalog-monitor', '{"schema":"sales","table":"orders","change":"COLUMN_ADDED"}'),
    ('SYNC_COMPLETED', 'INFO', 'metadata-sync', '{"source":"sqlserver","assetsSynced":12}'),
    ('QUALITY_ALERT', 'ERROR', 'quality-engine', '{"rule":"NOT_NULL","asset":"sales.customers.email","failed":3}');
END;
GO

IF OBJECT_ID('sales.vw_customer_order_summary', 'V') IS NULL
BEGIN
  EXEC('CREATE VIEW sales.vw_customer_order_summary AS
    SELECT
      c.customer_id,
      c.customer_code,
      c.full_name,
      COUNT(DISTINCT o.order_id) AS total_orders,
      SUM(CASE WHEN o.order_status <> ''CANCELLED'' THEN o.total_amount ELSE 0 END) AS net_revenue
    FROM sales.customers c
    LEFT JOIN sales.orders o ON o.customer_id = c.customer_id
    GROUP BY c.customer_id, c.customer_code, c.full_name');
END;
GO

PRINT 'SQL Server mock dataset is ready in database nexa_mock_catalog';
GO
