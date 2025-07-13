import { supabase } from '../config/supabase';
import { getUserApiInfo } from '../services/userApiService';

/**
 * Google Sheets API 환경 변수 로드 및 검증
 */
const googleSheetsApiKey = process.env.REACT_APP_GOOGLE_SHEETS_API_KEY;
const googleOAuthClientId = process.env.REACT_APP_GOOGLE_OAUTH_CLIENT_ID;

// 🔍 Google API 환경변수 확인
console.log('🔍 Google API 환경변수 확인:');
console.log('- API_KEY:', googleSheetsApiKey ? '✅ 로드됨' : '❌ 없음');
console.log('- CLIENT_ID:', googleOAuthClientId ? '✅ 로드됨' : '❌ 없음');

// 환경변수 필수 검사
if (!googleSheetsApiKey || !googleOAuthClientId) {
  console.error(`
🚨 Google API 환경변수 누락!
- API_KEY: ${googleSheetsApiKey ? '✅' : '❌ 누락'}
- CLIENT_ID: ${googleOAuthClientId ? '✅' : '❌ 누락'}

.env 파일을 확인하세요.
`);
  throw new Error('Google API 환경변수가 설정되지 않았습니다.');
}

// Google API 설정 (환경변수 검증 후 타입 안전한 상수 생성)
const GOOGLE_SHEETS_API_KEY = googleSheetsApiKey;
const GOOGLE_OAUTH_CLIENT_ID = googleOAuthClientId;

/**
 * 중국 주문 데이터 타입 정의 (chinaorder_googlesheet 테이블 구조에 맞춤)
 */
export interface ChinaOrderData {
  user_id: string;                    // 사용자 ID
  china_order_number?: string;        // G열
  order_number?: string;              // E열
  option_id?: string;                 // D열
  date?: string;                      // H열
  item_name?: string;                 // I열
  option_name?: string;               // J열
  barcode?: string;                   // K열
  composition?: string;               // L열
  order_quantity?: string;            // M열
  china_option1?: string;             // N열
  china_option2?: string;             // O열
  china_price?: string;               // P열
  china_total_price?: string;         // Q열
  image_url?: string;                 // R열
  china_link?: string;                // S열
  order_status_ordering?: string;     // T열
  order_status_check?: string;        // U열
  order_status_cancel?: string;       // V열
  order_status_shipment?: string;     // W열
  remark?: string;                    // Y열
  confirm_order_id?: string;          // AB열
  confirm_shipment_id?: string;       // AC열
}

/**
 * 현재 로그인한 사용자 ID 가져오기
 */
function getCurrentUserId(): string | null {
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return currentUser.id || null;
  } catch (error) {
    console.error('❌ 사용자 정보 읽기 오류:', error);
    return null;
  }
}

/**
 * Google OAuth 인증 및 토큰 가져오기
 */
async function getGoogleAuthToken(): Promise<string | null> {
  return new Promise((resolve) => {
    // Google OAuth 팝업 열기
    const authUrl = `https://accounts.google.com/oauth/authorize?` +
      `client_id=${GOOGLE_OAUTH_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent('urn:ietf:wg:oauth:2.0:oob')}&` +
      `scope=${encodeURIComponent('https://www.googleapis.com/auth/spreadsheets.readonly')}&` +
      `response_type=token`;

    const popup = window.open(authUrl, 'Google OAuth', 'width=500,height=600');
    
    // 팝업에서 토큰 가져오기
    const checkPopup = setInterval(() => {
      try {
        if (popup?.closed) {
          clearInterval(checkPopup);
          resolve(null);
          return;
        }

        const url = popup?.location.href;
        if (url && url.includes('access_token=')) {
          const token = url.split('access_token=')[1].split('&')[0];
          popup?.close();
          clearInterval(checkPopup);
          resolve(token);
          return;
        }
      } catch (e) {
        // Cross-origin 에러는 무시 (정상적인 동작)
      }
    }, 1000);

    // 10분 후 타임아웃
    setTimeout(() => {
      clearInterval(checkPopup);
      popup?.close();
      resolve(null);
    }, 600000);
  });
}

/**
 * Google Sheets에서 데이터 가져와서 Supabase에 저장
 * @param userId 사용자 ID
 * @returns Promise<{success: boolean, savedCount: number, error?: string}>
 */
export async function importGoogleSheetsData(userId: string): Promise<{success: boolean, savedCount: number, error?: string}> {
  try {
    console.log('🚀 구글 시트 데이터 가져오기 시작...');

    // 1. 사용자 API 정보에서 구글 시트 정보 가져오기 (Supabase 직접 연결)
    const userApiResult = await getUserApiInfo(userId);
    if (!userApiResult.success || !userApiResult.data) {
      return {
        success: false,
        savedCount: 0,
        error: '사용자 API 정보를 찾을 수 없습니다. 개인정보 입력 페이지에서 구글 시트 정보를 먼저 등록해주세요.'
      };
    }

    const { googlesheet_id, googlesheet_name } = userApiResult.data;
    if (!googlesheet_id || !googlesheet_name) {
      return {
        success: false,
        savedCount: 0,
        error: '구글 시트 ID 또는 시트명이 설정되지 않았습니다. 개인정보 입력 페이지에서 등록해주세요.'
      };
    }

    console.log('📋 구글 시트 정보 (복호화 완료):', { googlesheet_id: googlesheet_id.substring(0, 10) + '...', googlesheet_name });

    // 2. Google Sheets API를 통해 데이터 가져오기 (API 키 사용)
    // D열부터 AC열까지 3행부터 1000행까지 (모든 필요한 데이터 범위)
    const range = `${googlesheet_name}!D3:AC1000`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${googlesheet_id}/values/${encodeURIComponent(range)}?key=${GOOGLE_SHEETS_API_KEY}`;
    
    console.log('🌐 Google Sheets API 호출:', url);

    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Google Sheets API 에러:', response.status, errorText);
      return {
        success: false,
        savedCount: 0,
        error: `구글 시트 API 호출 실패: ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json();
    console.log('📊 구글 시트 응답 데이터:', data);

    if (!data.values || data.values.length === 0) {
      return {
        success: false,
        savedCount: 0,
        error: 'G열에 데이터가 없습니다.'
      };
    }

    // 🔍 첫 번째 데이터 행의 모든 열 값을 콤마로 구분해서 출력
    if (data.values && data.values.length > 0) {
      const firstRow = data.values[0];
      console.log('🔍 첫 번째 데이터 행 (콤마 구분):');
      console.log(firstRow.map((cell: any, index: number) => `[${index}]${cell || '빈값'}`).join(', '));
      console.log('📊 열 매핑 참고:');
      console.log('D열=0, E열=1, F열=2, G열=3, H열=4, I열=5, J열=6, K열=7, L열=8, M열=9');
      console.log('N열=10, O열=11, P열=12, Q열=13, R열=14, S열=15, T열=16, U열=17, V열=18, W열=19');
      console.log('X열=20, Y열=21, Z열=22, AA열=23, AB열=24, AC열=25');
    }

    // 3. 데이터 변환 (열 인덱스는 D열부터 시작하므로 0-based)
    const chinaOrderData: ChinaOrderData[] = data.values.map((row: any[], index: number) => {
      // D열=0, E열=1, F열=2, G열=3, H열=4, I열=5, J열=6, K열=7, L열=8, M열=9, 
      // N열=10, O열=11, P열=12, Q열=13, R열=14, S열=15, T열=16, U열=17, V열=18, W열=19, 
      // X열=20, Y열=21, Z열=22, AA열=23, AB열=24, AC열=25
      
      return {
        user_id: userId,
        option_id: row[0] || '',                    // D열 (인덱스 0)
        order_number: row[1] || '',                 // E열 (인덱스 1)
        // F열 (인덱스 2) - 실제 데이터가 있다면 매핑 필요
        china_order_number: row[3] || '',           // G열 (인덱스 3)
        date: row[4] || '',                         // H열 (인덱스 4)
        item_name: row[5] || '',                    // I열 (인덱스 5)
        option_name: row[6] || '',                  // J열 (인덱스 6)
        barcode: row[7] || '',                      // K열 (인덱스 7)
        composition: row[8] || '',                  // L열 (인덱스 8)
        order_quantity: row[9] ? parseInt(row[9]) || null : null,               // M열 (인덱스 9) - 숫자 변환
        china_option1: row[10] || '',               // N열 (인덱스 10)
        china_option2: row[11] || '',               // O열 (인덱스 11)
        china_price: row[12] ? parseFloat(row[12]) || null : null,                 // P열 (인덱스 12) - 숫자 변환
        china_total_price: row[13] ? parseFloat(row[13]) || null : null,           // Q열 (인덱스 13) - 숫자 변환
        image_url: row[14] || '',                   // R열 (인덱스 14) - 이제 올바른 위치
        china_link: row[15] || '',                  // S열 (인덱스 15)
        order_status_ordering: row[16] || null,       // T열 (인덱스 16)
        order_status_check: row[17] || null,          // U열 (인덱스 17)
        order_status_cancel: row[18] || null,         // V열 (인덱스 18)
        order_status_shipment: row[19] || null,       // W열 (인덱스 19)
        remark: row[21] || '',                      // Y열 (인덱스 21, X열 건너뜀)
        confirm_order_id: row[24] || '',            // AB열 (인덱스 24)
        confirm_shipment_id: row[25] || ''          // AC열 (인덱스 25)
      };
    }).filter((item: ChinaOrderData) => item.china_order_number || item.option_id); // 빈 값 제외 (G열 또는 D열 중 하나라도 있으면 유지)

    console.log(`📝 변환된 데이터: ${chinaOrderData.length}개`);
    console.log('🔍 첫 번째 데이터 샘플:', chinaOrderData[0]);

    if (chinaOrderData.length === 0) {
      return {
        success: false,
        savedCount: 0,
        error: 'G열에 유효한 데이터가 없습니다.'
      };
    }

    // 4. 기존 사용자 데이터 삭제
    console.log('🗑️ 기존 사용자 데이터 삭제 중...');
    const { error: deleteError } = await supabase
      .from('chinaorder_googlesheet')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('❌ 기존 데이터 삭제 오류:', deleteError);
      return {
        success: false,
        savedCount: 0,
        error: `기존 데이터 삭제 실패: ${deleteError.message}`
      };
    }

    console.log('✅ 기존 데이터 삭제 완료');

    // 5. 새 데이터 저장
    console.log('💾 새 데이터 저장 중...');
    const { data: insertData, error: insertError } = await supabase
      .from('chinaorder_googlesheet')
      .insert(chinaOrderData);

    if (insertError) {
      console.error('❌ 데이터 저장 오류:', insertError);
      
      // 🔍 상세 오류 분석 및 문제 데이터 찾기
      let errorDetails = `데이터 저장 실패: ${insertError.message}\n\n`;
      
      // 오류 메시지에서 문제가 되는 필드 추출
      if (insertError.message.includes('invalid input syntax for type integer')) {
        errorDetails += `⚠️ 정수형 컬럼에 잘못된 값이 입력되었습니다.\n\n`;
        
        // 첫 번째 데이터 샘플의 모든 필드 값 표시
        const sampleData = chinaOrderData[0];
        if (sampleData) {
          errorDetails += `📋 첫 번째 데이터 샘플:\n`;
          Object.entries(sampleData).forEach(([key, value]) => {
            errorDetails += `• ${key}: "${value}" (타입: ${typeof value})\n`;
          });
          
          errorDetails += `\n❓ 가능한 문제:\n`;
          errorDetails += `• order_quantity (M열): "${sampleData.order_quantity}" - 숫자여야 함\n`;
          errorDetails += `• china_price (P열): "${sampleData.china_price}" - 숫자일 수 있음\n`;
          errorDetails += `• china_total_price (Q열): "${sampleData.china_total_price}" - 숫자일 수 있음\n`;
        }
      } else {
        // 다른 종류의 오류인 경우
        errorDetails += `🔍 오류 코드: ${insertError.code}\n`;
        errorDetails += `📋 오류 세부사항: ${insertError.details}\n`;
        errorDetails += `💡 힌트: ${insertError.hint}\n\n`;
        
        // 첫 번째 데이터 샘플 표시
        if (chinaOrderData[0]) {
          errorDetails += `📋 첫 번째 저장 시도 데이터:\n`;
          const sampleEntries = Object.entries(chinaOrderData[0]).slice(0, 5); // 처음 5개만
          sampleEntries.forEach(([key, value]) => {
            errorDetails += `• ${key}: "${value}"\n`;
          });
          errorDetails += `... (총 ${Object.keys(chinaOrderData[0]).length}개 필드)\n`;
        }
      }
      
      return {
        success: false,
        savedCount: 0,
        error: errorDetails
      };
    }

    console.log('✅ 데이터 저장 완료:', insertData);

    return {
      success: true,
      savedCount: chinaOrderData.length,
      error: undefined
    };

  } catch (error: any) {
    console.error('❌ importGoogleSheetsData 에러:', error);
    return {
      success: false,
      savedCount: 0,
      error: `예기치 못한 오류: ${error.message}`
    };
  }
} 