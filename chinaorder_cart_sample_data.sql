-- 중국 주문 카트 테스트 데이터 삽입
-- 실제 사용자 ID로 변경해서 사용하세요

-- 첫 번째 사용자의 테스트 데이터
INSERT INTO chinaorder_cart (
    user_id, china_order_number, date, item_name, option_name, barcode, quantity,
    image_url, china_link, china_option1, china_option2, china_price, china_total_price,
    order_status_ordering, order_status_check, remark
) VALUES 
-- 주문 1
('test-user-id-1', 'CN20240115001', '2024-01-15', 
 '무선 이어폰 블루투스 5.0', '색상: 화이트', 'BC20240115001', 2,
 'https://img.alicdn.com/imgextra/i1/1234567890/TB2_example1.jpg',
 'https://www.1688.com/product/example1.html',
 '白色', '蓝牙5.0', '89', '178',
 '1', null, '고객 요청으로 화이트 색상만'),

-- 주문 2  
('test-user-id-1', 'CN20240115002', '2024-01-15',
 '스마트워치 피트니스 트래커', '사이즈: M, 색상: 블랙', 'BC20240115002', 1,
 'https://img.alicdn.com/imgextra/i2/1234567890/TB2_example2.jpg',
 'https://www.1688.com/product/example2.html',
 '黑色', 'M码', '156', '156',
 '2', '1', '인기 상품으로 재주문'),

-- 주문 3
('test-user-id-1', 'CN20240116001', '2024-01-16',
 'USB-C 고속 충전 케이블', '길이: 1m', 'BC20240116001', 5,
 'https://img.alicdn.com/imgextra/i3/1234567890/TB2_example3.jpg',
 'https://www.1688.com/product/example3.html',
 '1米', 'USB-C', '23', '115',
 '3', '2', '대량 주문 할인 적용'),

-- 주문 4
('test-user-id-1', 'CN20240116002', '2024-01-16',
 '차량용 핸드폰 거치대', '타입: 송풍구형', 'BC20240116002', 3,
 'https://img.alicdn.com/imgextra/i4/1234567890/TB2_example4.jpg',
 'https://www.1688.com/product/example4.html',
 '出风口型', '磁吸式', '45', '135',
 '1', null, '송풍구 타입으로 확인'),

-- 주문 5
('test-user-id-1', 'CN20240117001', '2024-01-17',
 '무선 충전 패드 10W', '색상: 블랙', 'BC20240117001', 2,
 'https://img.alicdn.com/imgextra/i5/1234567890/TB2_example5.jpg',
 'https://www.1688.com/product/example5.html',
 '黑色', '10W快充', '67', '134',
 null, null, '품질 확인 후 대량 주문 예정'),

-- 주문 6
('test-user-id-1', 'CN20240117002', '2024-01-17',
 '블루투스 스피커 방수', '색상: 레드, 용량: 2000mAh', 'BC20240117002', 1,
 'https://img.alicdn.com/imgextra/i6/1234567890/TB2_example6.jpg',
 'https://www.1688.com/product/example6.html',
 '红色', '2000mAh', '98', '98',
 '1', '1', '방수 기능 필수 확인'),

-- 완료된 주문들
('test-user-id-1', 'CN20240110001', '2024-01-10',
 '게임용 마우스 RGB', '색상: 블랙', 'BC20240110001', 2,
 'https://img.alicdn.com/imgextra/i7/1234567890/TB2_example7.jpg',
 'https://www.1688.com/product/example7.html',
 '黑色', 'RGB灯光', '156', '312',
 '3', '3', '완료된 주문'),

('test-user-id-1', 'CN20240110002', '2024-01-10',
 '기계식 키보드 87키', '축: 청축', 'BC20240110002', 1,
 'https://img.alicdn.com/imgextra/i8/1234567890/TB2_example8.jpg',
 'https://www.1688.com/product/example8.html',
 '青轴', '87键', '234', '234',
 '3', '3', '완료된 주문 - 품질 양호');

-- 두 번째 사용자의 테스트 데이터 (다른 사용자 ID)
INSERT INTO chinaorder_cart (
    user_id, china_order_number, date, item_name, option_name, barcode, quantity,
    image_url, china_option1, china_price, remark
) VALUES 
('test-user-id-2', 'CN20240118001', '2024-01-18',
 '휴대용 보조배터리 20000mAh', '색상: 화이트', 'BC20240118001', 1,
 'https://img.alicdn.com/imgextra/i9/1234567890/TB2_example9.jpg',
 '白色', '267', '다른 사용자 주문'),

('test-user-id-2', 'CN20240118002', '2024-01-18',
 '무선 마우스 2.4GHz', '색상: 실버', 'BC20240118002', 1,
 'https://img.alicdn.com/imgextra/i10/1234567890/TB2_example10.jpg',
 '银色', '89', '다른 사용자 주문 2');

-- 통계 확인 쿼리 (참고용)
-- SELECT 
--     user_id,
--     COUNT(*) as 총주문수,
--     SUM(quantity) as 총수량,
--     COUNT(CASE WHEN order_status_ordering IS NOT NULL THEN 1 END) as 진행중,
--     COUNT(CASE WHEN order_status_check IS NOT NULL THEN 1 END) as 확인됨
-- FROM chinaorder_cart 
-- GROUP BY user_id;

-- 데이터 확인 쿼리 (참고용)
-- SELECT china_order_number, date, item_name, option_name, quantity, 
--        order_status_ordering, order_status_check, created_at
-- FROM chinaorder_cart 
-- WHERE user_id = 'test-user-id-1'
-- ORDER BY created_at DESC; 