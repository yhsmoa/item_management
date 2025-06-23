import { createClient } from '@supabase/supabase-js';

// Supabase 프로젝트 정보 (.env 파일에서 로드)
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY;

// 🔍 환경변수 상태 확인
console.log('🔍 Supabase 환경변수 확인:');
console.log('- URL:', supabaseUrl ? '✅ 로드됨' : '❌ 없음');
console.log('- Key:', supabaseKey ? `✅ 로드됨 (길이: ${supabaseKey.length})` : '❌ 없음');

// JWT 토큰 형식 검증
if (supabaseKey) {
  const jwtParts = supabaseKey.split('.');
  console.log('- JWT 형식:', jwtParts.length === 3 ? '✅ 올바름' : `❌ 잘못됨 (${jwtParts.length}개 부분)`);
  
  if (jwtParts.length !== 3) {
    console.error('🚨 JWT 토큰이 잘렸습니다! .env 파일에서 토큰을 한 줄로 확인하세요');
  }
}

// 환경변수 필수 검사
if (!supabaseUrl || !supabaseKey) {
  console.error(`
🚨 Supabase 환경변수 누락!
- URL: ${supabaseUrl ? '✅' : '❌ 누락'}
- Key: ${supabaseKey ? '✅' : '❌ 누락'}
`);
  throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
}



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