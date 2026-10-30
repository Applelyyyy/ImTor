-- Genuine marketplace categories are infrastructure, not fictional demo records.
INSERT INTO "ProductCategory" (id,name,food) VALUES
 ('meals','อาหารจานหลัก',true),
 ('snacks','ขนมและของว่าง',true),
 ('drinks','เครื่องดื่ม',true),
 ('bakery','เบเกอรี',true),
 ('groceries','ของสดและผลไม้',true),
 ('goods','สินค้าทั่วไป',false),
 ('other','อื่น ๆ',false)
ON CONFLICT (id) DO NOTHING;
