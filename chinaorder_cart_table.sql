-- 중국 주문 카트 테이블 생성
CREATE TABLE IF NOT EXISTS chinaorder_cart (
    -- 기본 필드
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    
    -- 주문 정보 (요청된 매핑 필드)
    china_order_number TEXT,                   -- 주문번호
    date TEXT,                                 -- 날짜
    item_name TEXT,                           -- 등록상품명
    option_name TEXT,                         -- 옵션명
    barcode TEXT,                             -- 바코드
    quantity INTEGER,                         -- 주문수량
    
    -- 추가 정보 (ChinaOrderListPage와 호환)
    image_url TEXT,                           -- 상품 이미지
    china_link TEXT,                          -- 중국 상품 링크
    china_option1 TEXT,                       -- 중국 옵션 1
    china_option2 TEXT,                       -- 중국 옵션 2
    china_price TEXT,                         -- 중국 가격
    china_total_price TEXT,                   -- 중국 총 가격
    
    -- 주문 상태
    order_status_ordering TEXT,               -- 진행 상태
    order_status_check TEXT,                  -- 확인 상태
    order_status_cancel TEXT,                 -- 취소 상태
    order_status_shipment TEXT,               -- 출고 상태
    
    -- 기타
    remark TEXT,                              -- 비고
    confirm_order_id TEXT,                    -- 확인 주문번호
    confirm_shipment_id TEXT,                 -- 출고번호
    
    -- 시스템 필드
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_chinaorder_cart_user_id ON chinaorder_cart(user_id);
CREATE INDEX IF NOT EXISTS idx_chinaorder_cart_china_order_number ON chinaorder_cart(china_order_number);
CREATE INDEX IF NOT EXISTS idx_chinaorder_cart_created_at ON chinaorder_cart(created_at);
CREATE INDEX IF NOT EXISTS idx_chinaorder_cart_item_name ON chinaorder_cart(item_name);
CREATE INDEX IF NOT EXISTS idx_chinaorder_cart_barcode ON chinaorder_cart(barcode);

-- RLS (Row Level Security) 정책 활성화
ALTER TABLE chinaorder_cart ENABLE ROW LEVEL SECURITY;

-- 사용자별 데이터 접근 정책 생성
CREATE POLICY "사용자는 자신의 주문 카트만 조회 가능" ON chinaorder_cart
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "사용자는 자신의 주문 카트만 삽입 가능" ON chinaorder_cart
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "사용자는 자신의 주문 카트만 수정 가능" ON chinaorder_cart
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "사용자는 자신의 주문 카트만 삭제 가능" ON chinaorder_cart
    FOR DELETE USING (auth.uid()::text = user_id);

-- updated_at 자동 업데이트 트리거 함수 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at 트리거 생성
CREATE TRIGGER update_chinaorder_cart_updated_at
    BEFORE UPDATE ON chinaorder_cart
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 테스트 데이터 삽입 (선택사항)
-- INSERT INTO chinaorder_cart (
--     user_id, china_order_number, date, item_name, option_name, barcode, quantity,
--     image_url, china_option1, china_price, remark
-- ) VALUES 
-- ('test-user-id', 'CN001', '2024-01-15', '테스트 상품', '색상: 빨강', 'BC001', 2,
--  'https://example.com/image.jpg', '红色', '100', '테스트 주문입니다'),
-- ('test-user-id', 'CN002', '2024-01-16', '테스트 상품 2', '사이즈: L', 'BC002', 1,
--  'https://example.com/image2.jpg', '大号', '150', '두 번째 테스트 주문');

-- 코멘트 추가
COMMENT ON TABLE chinaorder_cart IS '중국 주문 카트 테이블';
COMMENT ON COLUMN chinaorder_cart.china_order_number IS '중국 주문 번호';
COMMENT ON COLUMN chinaorder_cart.date IS '주문 날짜';
COMMENT ON COLUMN chinaorder_cart.item_name IS '상품명';
COMMENT ON COLUMN chinaorder_cart.option_name IS '옵션명';
COMMENT ON COLUMN chinaorder_cart.barcode IS '바코드';
COMMENT ON COLUMN chinaorder_cart.quantity IS '주문 수량'; 