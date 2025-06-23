-- chinaorder_cart 테이블에 테스트 데이터 추가
-- 일단 option_id 컬럼이 없다면 추가
ALTER TABLE chinaorder_cart ADD COLUMN IF NOT EXISTS option_id TEXT;

-- 테스트 데이터 삽입 (option_id 포함)
INSERT INTO chinaorder_cart (
    user_id, 
    option_id,
    item_name, 
    option_name, 
    barcode, 
    quantity,
    image_url,
    china_option1,
    china_option2,
    china_price,
    china_total_price,
    remark,
    china_link
) VALUES 
('test-user-id', 'OPT001', '테스트 상품 1', '빨강/M', 'BC001', 2, 'https://example.com/image1.jpg', '红色', 'M', '50', '100', '면 100%', 'https://china-link1.com'),
('test-user-id', 'OPT002', '테스트 상품 2', '파랑/L', 'BC002', 1, 'https://example.com/image2.jpg', '蓝色', 'L', '75', '75', '폴리 80%', 'https://china-link2.com'),
('test-user-id', 'OPT003', '테스트 상품 3', '검정/S', 'BC003', 3, 'https://example.com/image3.jpg', '黑色', 'S', '40', '120', '면 90%', 'https://china-link3.com'); 