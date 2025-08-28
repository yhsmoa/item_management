-- stocks_management 테이블에 note 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

-- note 컬럼 추가 (이미 있으면 오류 발생하므로 IF NOT EXISTS 사용)
ALTER TABLE stocks_management 
ADD COLUMN IF NOT EXISTS note TEXT;

-- 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'stocks_management' 
ORDER BY ordinal_position;