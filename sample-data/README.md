# Sample Data for File Upload Testing

This folder contains sample CSV files that can be used to test the Nexa file upload functionality.

## Supported File Formats

The file upload feature supports:
- **CSV** (.csv) - Comma-separated values
- **Excel** (.xlsx, .xls) - Microsoft Excel spreadsheets

**Maximum file size:** 100MB

## Sample Files

### 1. products.csv
A product catalog with 10 sample products.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Product ID |
| product_name | STRING | Product name |
| category | STRING | Product category |
| price | DECIMAL | Price in USD |
| quantity | INTEGER | Stock quantity |
| created_date | DATE | Date added (YYYY-MM-DD) |
| in_stock | BOOLEAN | Availability status |
| rating | DECIMAL | Customer rating (1-5) |

### 2. customers.csv
Customer records with 10 sample customers.

| Column | Type | Description |
|--------|------|-------------|
| customer_id | INTEGER | Customer ID |
| first_name | STRING | First name |
| last_name | STRING | Last name |
| email | STRING | Email address |
| phone | STRING | Phone number |
| city | STRING | City |
| state | STRING | State code |
| country | STRING | Country code |
| signup_date | DATE | Registration date |
| total_orders | INTEGER | Number of orders |
| lifetime_value | DECIMAL | Total spending |
| is_premium | BOOLEAN | Premium status |

### 3. sales_orders.csv
Sales transaction data with 10 sample orders.

| Column | Type | Description |
|--------|------|-------------|
| order_id | STRING | Order ID |
| customer_id | INTEGER | Customer ID (FK) |
| product_id | INTEGER | Product ID (FK) |
| order_date | DATE | Order date |
| quantity | INTEGER | Items ordered |
| unit_price | DECIMAL | Price per unit |
| discount_pct | DECIMAL | Discount percentage |
| total_amount | DECIMAL | Final amount |
| payment_method | STRING | Payment type |
| shipping_status | STRING | Delivery status |

## How to Upload

1. Navigate to **File Upload** in the Nexa dashboard
2. Drag and drop a file or click to browse
3. The system will automatically:
   - Parse the file
   - Detect column types
   - Show a preview of the data
4. Click **Create Asset** to register the file in the data catalog

## Type Inference

The file parser automatically infers column types:
- **INTEGER**: Whole numbers (1, 42, -100)
- **DECIMAL**: Floating-point numbers (3.14, 99.99)
- **BOOLEAN**: true/false values (true, false, yes, no, 1, 0)
- **DATE**: ISO format dates (2024-01-15)
- **DATETIME**: ISO format timestamps (2024-01-15T10:30:00)
- **STRING**: Any text value

## CSV Requirements

- Use comma (,), semicolon (;), tab, or pipe (|) as delimiter
- First row must contain column headers
- UTF-8 encoding recommended (UTF-16, ISO-8859-1 also supported)
- Avoid special characters in headers

## Excel Requirements

- First row must contain column headers
- Multiple sheets are supported (each becomes a separate parse result)
- Merged cells should be avoided
- Formula results are used (not formulas themselves)
