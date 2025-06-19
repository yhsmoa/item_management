import { createClient } from '@supabase/supabase-js';

// Supabase 프로젝트 정보 (supabase_env.txt 참고)
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://mkcxpkblohioqboemmah.supabase.co';

// RLS 정책 우회를 위해 service_role 키 사용 (개발 환경용)
// 프로덕션에서는 anon 키와 적절한 RLS 정책 사용 권장
const supabaseKey = process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rY3hwa2Jsb2hpb3Fib2VtbWFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTExMTE2OSwiZXhwIjoyMDY0Njg3MTY5fQ.6MrqlrMqSHwuUpCp5xWJSRCqAeqW4TYwKW38o17Hb0o';



export const supabase = createClient(supabaseUrl, supabaseKey);

// 연결 테스트를 위한 헬퍼 함수
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('coupang_products').select('count').limit(1);
    if (error) {
      console.error('❌ Supabase 연결 오류:', error);
      return false;
    }
    console.log('✅ Supabase 연결 성공');
    return true;
  } catch (err) {
    console.error('❌ Supabase 연결 예외:', err);
    return false;
  }
}; 