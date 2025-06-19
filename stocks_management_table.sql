-- stocks_management 테이블 완전 재생성
-- Supabase SQL Editor에서 실행하세요

-- 1. 기존 테이블과 관련 요소들 완전 삭제
DROP TABLE IF EXISTS stocks_management CASCADE;
DROP POLICY IF EXISTS "Enable all operations for stocks_management" ON stocks_management;
DROP FUNCTION IF EXISTS update_stocks_management_updated_at() CASCADE;

-- 2. UUID extension 활성화 (필요한 경우)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. stocks_management 테이블 생성 (UUID primary key)
CREATE TABLE stocks_management (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  barcode TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT 'A-1-001',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 인덱스 생성
CREATE INDEX idx_stocks_management_user_id ON stocks_management(user_id);
CREATE INDEX idx_stocks_management_barcode ON stocks_management(barcode);
CREATE INDEX idx_stocks_management_user_barcode ON stocks_management(user_id, barcode);
CREATE INDEX idx_stocks_management_created_at ON stocks_management(created_at);

-- 5. 복합 유니크 제약조건 (동일 사용자, 동일 바코드, 동일 위치는 하나만 허용)
CREATE UNIQUE INDEX idx_stocks_management_unique_user_barcode_location 
ON stocks_management(user_id, barcode, location);

-- 6. RLS 정책 설정
ALTER TABLE stocks_management ENABLE ROW LEVEL SECURITY;

-- 7. 개발용 전체 권한 정책
CREATE POLICY "Enable all operations for stocks_management" ON stocks_management
FOR ALL USING (true);

-- 8. 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_stocks_management_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 9. 업데이트 트리거
CREATE TRIGGER trigger_update_stocks_management_updated_at
    BEFORE UPDATE ON stocks_management
    FOR EACH ROW
    EXECUTE FUNCTION update_stocks_management_updated_at();

-- 10. UPSERT 함수 생성 (재고 추가/업데이트)
CREATE OR REPLACE FUNCTION upsert_stock(
    p_user_id TEXT,
    p_item_name TEXT,
    p_barcode TEXT,
    p_location TEXT,
    p_quantity_to_add INTEGER
)
RETURNS TABLE(
    action TEXT,
    old_stock INTEGER,
    new_stock INTEGER,
    item_id UUID
) AS $$
DECLARE
    existing_record stocks_management%ROWTYPE;
    result_action TEXT;
    result_old_stock INTEGER;
    result_new_stock INTEGER;
    result_item_id UUID;
BEGIN
    -- 기존 데이터 조회
    SELECT * INTO existing_record
    FROM stocks_management
    WHERE user_id = p_user_id
      AND barcode = p_barcode
      AND location = p_location;

    IF FOUND THEN
        -- 기존 데이터가 있으면 업데이트
        result_action := 'updated';
        result_old_stock := existing_record.stock;
        result_new_stock := existing_record.stock + p_quantity_to_add;
        result_item_id := existing_record.id;

        UPDATE stocks_management
        SET stock = result_new_stock,
            updated_at = NOW()
        WHERE id = existing_record.id;
    ELSE
        -- 새로운 데이터 삽입
        result_action := 'inserted';
        result_old_stock := 0;
        result_new_stock := p_quantity_to_add;
        result_item_id := gen_random_uuid();

        INSERT INTO stocks_management (id, user_id, item_name, barcode, stock, location)
        VALUES (result_item_id, p_user_id, p_item_name, p_barcode, p_quantity_to_add, p_location);
    END IF;

    -- 결과 반환
    RETURN QUERY SELECT result_action, result_old_stock, result_new_stock, result_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. 테스트 데이터 (선택사항) - 주석 해제 후 사용
-- INSERT INTO stocks_management (user_id, item_name, barcode, stock, location) VALUES
-- ('temp_user', '테스트 상품 1', 'TEST001', 10, 'A-1-001'),
-- ('temp_user', '테스트 상품 2', 'TEST002', 20, 'A-1-002'),
-- ('temp_user', '테스트 상품 1', 'TEST001', 5, 'B-2-001'); -- 동일 바코드, 다른 위치

-- 12. 테이블 정보 확인
SELECT 
    'stocks_management 테이블이 성공적으로 생성되었습니다!' as message,
    'Primary Key: id (UUID)' as primary_key,
    'Unique Constraint: user_id + barcode + location' as unique_constraint; 