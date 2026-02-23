SET NOCOUNT ON;
SELECT COUNT(*) AS customers FROM nexa_mock_catalog.sales.customers;
SELECT COUNT(*) AS products FROM nexa_mock_catalog.sales.products;
SELECT COUNT(*) AS orders_count FROM nexa_mock_catalog.sales.orders;
SELECT COUNT(*) AS order_items FROM nexa_mock_catalog.sales.order_items;
SELECT COUNT(*) AS employees FROM nexa_mock_catalog.hr.employees;
SELECT COUNT(*) AS system_events FROM nexa_mock_catalog.ops.system_events;
GO
