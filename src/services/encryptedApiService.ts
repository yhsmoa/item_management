/**
 * 암호화된 API 서비스
 * React → AWS Lightsail 백엔드 → 암호화 → Supabase
 */

// 백엔드 서버 URL 설정
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

/**
 * 사용자 API 정보 인터페이스
 */
export interface UserApiData {
  user_id: string;
  coupang_name: string;
  coupang_code: string;
  coupang_access_key: string;
  coupang_secret_key: string;
  googlesheet_id?: string;
  googlesheet_name?: string;
}

/**
 * API 응답 인터페이스
 */
export interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

/**
 * 백엔드 API 호출을 위한 공통 함수
 */
async function apiCall(endpoint: string, options: RequestInit = {}): Promise<ApiResponse> {
  try {
    console.log(`🌐 백엔드 API 호출: ${BACKEND_URL}${endpoint}`);
    
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ API 응답 에러:', data);
      return {
        success: false,
        error: data.error || `HTTP ${response.status}: ${response.statusText}`
      };
    }

    console.log('✅ API 호출 성공:', data);
    return data;

  } catch (error: any) {
    console.error('❌ API 호출 에러:', error);
    return {
      success: false,
      error: `네트워크 오류: ${error.message}`
    };
  }
}

/**
 * 사용자 API 정보 저장 (암호화)
 * @param apiData - 저장할 API 정보
 * @returns Promise<ApiResponse>
 */
export const saveUserApiInfoEncrypted = async (apiData: UserApiData): Promise<ApiResponse> => {
  try {
    console.log('🔐 암호화된 API 정보 저장 시작:', { user_id: apiData.user_id });

    const result = await apiCall('/api/user-api-info', {
      method: 'POST',
      body: JSON.stringify(apiData)
    });

    if (result.success) {
      console.log('✅ 암호화된 API 정보 저장 성공');
    } else {
      console.error('❌ 암호화된 API 정보 저장 실패:', result.error);
    }

    return result;

  } catch (error: any) {
    console.error('❌ saveUserApiInfoEncrypted 예외 발생:', error);
    return {
      success: false,
      error: `예기치 못한 오류: ${error.message}`
    };
  }
};

/**
 * 사용자 API 정보 조회 (복호화)
 * @param userId - 사용자 ID
 * @returns Promise<ApiResponse>
 */
export const getUserApiInfoEncrypted = async (userId: string): Promise<ApiResponse> => {
  try {
    console.log(`🔍 사용자 ${userId} 암호화된 API 정보 조회 시작`);

    const result = await apiCall(`/api/user-api-info/${userId}`, {
      method: 'GET'
    });

    if (result.success) {
      console.log('✅ 암호화된 API 정보 조회 성공');
    } else {
      console.error('❌ 암호화된 API 정보 조회 실패:', result.error);
    }

    return result;

  } catch (error: any) {
    console.error('❌ getUserApiInfoEncrypted 예외 발생:', error);
    return {
      success: false,
      error: `예기치 못한 오류: ${error.message}`
    };
  }
};

/**
 * 백엔드 서버 헬스 체크
 * @returns Promise<ApiResponse>
 */
export const checkBackendHealth = async (): Promise<ApiResponse> => {
  try {
    console.log('🏥 백엔드 서버 헬스 체크');

    const result = await apiCall('/health', {
      method: 'GET'
    });

    return result;

  } catch (error: any) {
    console.error('❌ 백엔드 헬스 체크 실패:', error);
    return {
      success: false,
      error: `헬스 체크 실패: ${error.message}`
    };
  }
};

/**
 * 암호화 테스트
 * @param text - 테스트할 텍스트
 * @returns Promise<ApiResponse>
 */
export const testEncryption = async (text: string): Promise<ApiResponse> => {
  try {
    console.log('🧪 암호화 테스트 시작');

    const result = await apiCall('/api/test-encryption', {
      method: 'POST',
      body: JSON.stringify({ text })
    });

    return result;

  } catch (error: any) {
    console.error('❌ 암호화 테스트 실패:', error);
    return {
      success: false,
      error: `테스트 실패: ${error.message}`
    };
  }
}; 