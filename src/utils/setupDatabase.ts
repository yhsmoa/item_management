import { supabase } from '../config/supabase';

/**
 * Supabase 데이터베이스 테이블 자동 생성
 */
export async function setupDatabase(): Promise<boolean> {
  try {
    console.log('🔧 데이터베이스 테이블 생성 시작...');

    // 테이블 생성 SQL
    const createTableSQL = `
      -- 쿠팡 상품 테이블 생성
      CREATE TABLE IF NOT EXISTS coupang_products (
        id BIGSERIAL PRIMARY KEY,
        seller_product_id BIGINT UNIQUE NOT NULL,
        seller_product_name TEXT,
        display_product_name TEXT,
        brand TEXT,
        status_name TEXT,
        category_code BIGINT,
        sale_started_at TIMESTAMP,
        sale_ended_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        -- API에서 가져올 추가 데이터
        image_url TEXT,
        sale_price INTEGER,
        original_price INTEGER,
        coupang_stock INTEGER,
        
        -- 다른 시스템에서 관리할 데이터
        option_name TEXT,
        commission INTEGER,
        stock INTEGER,
        purchase_status TEXT,
        personal_order INTEGER,
        period INTEGER,
        weekly INTEGER,
        monthly INTEGER,
        warehouse_stock INTEGER,
        view1 INTEGER,
        view2 INTEGER,
        view3 INTEGER,
        view4 INTEGER,
        view5 INTEGER,
        shipment INTEGER,
        export_count INTEGER,
        discount_price INTEGER
      );

      -- 인덱스 생성
      CREATE INDEX IF NOT EXISTS idx_coupang_products_seller_product_id ON coupang_products(seller_product_id);
      CREATE INDEX IF NOT EXISTS idx_coupang_products_status ON coupang_products(status_name);
      CREATE INDEX IF NOT EXISTS idx_coupang_products_brand ON coupang_products(brand);

      -- 업데이트 시간 자동 갱신 함수
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      -- 트리거 생성
      DROP TRIGGER IF EXISTS update_coupang_products_updated_at ON coupang_products;
      CREATE TRIGGER update_coupang_products_updated_at 
      BEFORE UPDATE ON coupang_products 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `;

    // SQL 실행
    const { error } = await supabase.rpc('exec_sql', { query: createTableSQL });

    if (error) {
      console.error('❌ 테이블 생성 오류:', error);
      
      // RPC가 없다면 직접 쿼리 실행 시도
      const { error: directError } = await supabase
        .from('coupang_products')
        .select('id')
        .limit(1);

      if (directError && directError.code === '42P01') {
        // 테이블이 없으므로 수동으로 생성 필요
        console.log('⚠️ 테이블이 존재하지 않습니다. Supabase 대시보드에서 SQL 편집기로 스키마를 생성해야 합니다.');
        return false;
      }
    }

    console.log('✅ 데이터베이스 테이블 설정 완료!');
    return true;

  } catch (error) {
    console.error('🚨 데이터베이스 설정 오류:', error);
    return false;
  }
}

/**
 * 테이블 존재 여부 확인
 */
export async function checkTableExists(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('coupang_products')
      .select('id')
      .limit(1);

    return !error || error.code !== '42P01';
  } catch (error) {
    console.error('테이블 확인 오류:', error);
    return false;
  }
} 