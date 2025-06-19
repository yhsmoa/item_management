-- UPSERT 함수만 생성하는 스크립트
-- Supabase SQL Editor에서 실행하세요

-- UPSERT 함수 생성 (재고 추가/업데이트)
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

-- 함수 생성 확인
SELECT 'UPSERT 함수가 성공적으로 생성되었습니다!' as message; 