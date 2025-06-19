-- Supabase RLS 정책 설정 파일
-- 이 파일을 Supabase SQL Editor에서 실행하세요

-- 1. coupang-items 테이블에 대한 SELECT 정책 (모든 사용자 읽기 허용)
CREATE POLICY "Allow public read access" ON "coupang-items"
FOR SELECT TO anon, authenticated
USING (true);

-- 2. coupang-items 테이블에 대한 INSERT 정책 (모든 사용자 삽입 허용)
CREATE POLICY "Allow public insert access" ON "coupang-items"
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- 3. coupang-items 테이블에 대한 UPDATE 정책 (필요시)
CREATE POLICY "Allow public update access" ON "coupang-items"
FOR UPDATE TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 4. coupang-items 테이블에 대한 DELETE 정책 (필요시)
CREATE POLICY "Allow public delete access" ON "coupang-items"
FOR DELETE TO anon, authenticated
USING (true);

-- 5. RLS 활성화 (보안 유지)
ALTER TABLE "coupang-items" ENABLE ROW LEVEL SECURITY;

-- ===== extract-coupang-item-info 테이블 생성 및 정책 =====

-- 6. extract-coupang-item-info 테이블 생성
CREATE TABLE IF NOT EXISTS "extract-coupang-item-info" (
    id BIGSERIAL PRIMARY KEY,
    option_id TEXT NOT NULL UNIQUE,
    item_id TEXT NOT NULL,
    barcode TEXT DEFAULT '',
    price TEXT DEFAULT '',
    item_name TEXT DEFAULT '',
    option_name TEXT DEFAULT '',
    item_image_url TEXT DEFAULT '',
    product_id TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. extract-coupang-item-info 테이블 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_extract_coupang_item_info_option_id ON "extract-coupang-item-info" (option_id);
CREATE INDEX IF NOT EXISTS idx_extract_coupang_item_info_item_id ON "extract-coupang-item-info" (item_id);

-- 8. extract-coupang-item-info 테이블에 대한 SELECT 정책
CREATE POLICY "Allow public read access on extract-coupang-item-info" ON "extract-coupang-item-info"
FOR SELECT TO anon, authenticated
USING (true);

-- 9. extract-coupang-item-info 테이블에 대한 INSERT 정책
CREATE POLICY "Allow public insert access on extract-coupang-item-info" ON "extract-coupang-item-info"
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- 10. extract-coupang-item-info 테이블에 대한 UPDATE 정책
CREATE POLICY "Allow public update access on extract-coupang-item-info" ON "extract-coupang-item-info"
FOR UPDATE TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 11. extract-coupang-item-info 테이블에 대한 DELETE 정책
CREATE POLICY "Allow public delete access on extract-coupang-item-info" ON "extract-coupang-item-info"
FOR DELETE TO anon, authenticated
USING (true);

-- 12. extract-coupang-item-info 테이블 RLS 활성화
ALTER TABLE "extract-coupang-item-info" ENABLE ROW LEVEL SECURITY;

-- 참고: 위 정책들은 개발 환경용입니다.
-- 프로덕션에서는 더 세밀한 권한 제어가 필요합니다.
-- 예: user_id를 기반으로 한 사용자별 데이터 접근 제한

-- 쿠팡 로켓 재고 엑셀 테이블 생성
CREATE TABLE IF NOT EXISTS coupang_rocket_inventory (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'abc',
  inventory_id TEXT NULL,
  option_id TEXT NULL,
  sku_id TEXT NULL,
  product_name TEXT NULL,
  option_name TEXT NULL,
  offer_condition TEXT NULL,
  orderable_quantity INTEGER NULL,
  pending_inbounds INTEGER NULL,
  item_winner INTEGER NULL,
  sales_last_7_days INTEGER NULL,
  sales_last_30_days INTEGER NULL,
  sales_quantity_last_7_days INTEGER NULL,
  sales_quantity_last_30_days INTEGER NULL,
  recommanded_inboundquantity INTEGER NULL,
  monthly_storage_fee DECIMAL(10,2) NULL,
  sku_age_in_30days INTEGER NULL,
  sku_age_in_60days INTEGER NULL,
  product_listing_date DATE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS 정책 설정
ALTER TABLE coupang_rocket_inventory ENABLE ROW LEVEL SECURITY;

-- 모든 작업 허용 정책 (개발용)
CREATE POLICY "Enable all operations for coupang_rocket_inventory" ON coupang_rocket_inventory
FOR ALL USING (true);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_coupang_rocket_inventory_user_id ON coupang_rocket_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_coupang_rocket_inventory_inventory_id ON coupang_rocket_inventory(inventory_id);
CREATE INDEX IF NOT EXISTS idx_coupang_rocket_inventory_option_id ON coupang_rocket_inventory(option_id);
CREATE INDEX IF NOT EXISTS idx_coupang_rocket_inventory_sku_id ON coupang_rocket_inventory(sku_id);

-- 자동 updated_at 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_coupang_rocket_inventory_updated_at BEFORE UPDATE
ON coupang_rocket_inventory FOR EACH ROW EXECUTE PROCEDURE
update_updated_at_column(); 