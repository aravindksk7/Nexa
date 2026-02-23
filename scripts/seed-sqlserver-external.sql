IF DB_ID('nexa_external') IS NULL
BEGIN
  CREATE DATABASE nexa_external;
END;
GO

USE nexa_external;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF SCHEMA_ID('crm') IS NULL EXEC('CREATE SCHEMA crm');
IF SCHEMA_ID('finance') IS NULL EXEC('CREATE SCHEMA finance');
GO

IF OBJECT_ID('crm.accounts', 'U') IS NULL
BEGIN
  CREATE TABLE crm.accounts (
    account_id INT IDENTITY(1,1) PRIMARY KEY,
    account_code NVARCHAR(20) NOT NULL UNIQUE,
    account_name NVARCHAR(120) NOT NULL,
    region NVARCHAR(60) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF OBJECT_ID('crm.contacts', 'U') IS NULL
BEGIN
  CREATE TABLE crm.contacts (
    contact_id INT IDENTITY(1,1) PRIMARY KEY,
    account_id INT NOT NULL,
    full_name NVARCHAR(120) NOT NULL,
    email NVARCHAR(200) NULL,
    title NVARCHAR(80) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_contacts_accounts FOREIGN KEY (account_id) REFERENCES crm.accounts(account_id)
  );
END;
GO

IF OBJECT_ID('finance.invoices', 'U') IS NULL
BEGIN
  CREATE TABLE finance.invoices (
    invoice_id INT IDENTITY(1,1) PRIMARY KEY,
    account_id INT NOT NULL,
    invoice_date DATE NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    status NVARCHAR(30) NOT NULL,
    CONSTRAINT FK_invoices_accounts FOREIGN KEY (account_id) REFERENCES crm.accounts(account_id)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM crm.accounts)
BEGIN
  INSERT INTO crm.accounts (account_code, account_name, region)
  VALUES
    ('ACC-1001', 'Aurora Retail', 'APAC'),
    ('ACC-1002', 'Summit Health', 'NA'),
    ('ACC-1003', 'BlueJet Logistics', 'EMEA');
END;
GO

IF NOT EXISTS (SELECT 1 FROM crm.contacts)
BEGIN
  INSERT INTO crm.contacts (account_id, full_name, email, title)
  VALUES
    (1, 'Elena Torres', 'elena.torres@aurora.example.com', 'Procurement Lead'),
    (1, 'Raj Nair', 'raj.nair@aurora.example.com', 'Data Manager'),
    (2, 'Harper Reed', 'harper.reed@summit.example.com', 'Finance Director'),
    (3, 'Noa Fischer', 'noa.fischer@bluejet.example.com', 'Operations VP');
END;
GO

IF NOT EXISTS (SELECT 1 FROM finance.invoices)
BEGIN
  INSERT INTO finance.invoices (account_id, invoice_date, amount, status)
  VALUES
    (1, '2026-01-18', 12500.00, 'PAID'),
    (2, '2026-01-22', 8900.00, 'OPEN'),
    (3, '2026-01-28', 15120.00, 'PAID'),
    (1, '2026-02-05', 6400.00, 'OVERDUE');
END;
GO

PRINT 'External SQL Server demo database nexa_external is ready.';
GO
