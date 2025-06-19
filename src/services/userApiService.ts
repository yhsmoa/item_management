import { supabase } from '../config/supabase';

/**
 * 사용자 API 정보 인터페이스
 * - users_api 테이블의 구조와 일치
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
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 사용자 API 정보 저장
 * - users_api 테이블에 사용자 쿠팡 API 정보를 저장/업데이트
 * - UPSERT 방식으로 동작 (INSERT 또는 UPDATE)
 */
export const saveUserApiInfo = async (apiData: UserApiData): Promise<ApiResponse> => {
  try {
    console.log('📡 Supabase에 API 정보 저장 시작:', apiData);

    // users_api 테이블에 UPSERT (INSERT 또는 UPDATE)
    const { data, error } = await supabase
      .from('users_api')
      .upsert([{
        user_id: apiData.user_id,
        coupang_name: apiData.coupang_name,
        coupang_code: apiData.coupang_code,
        coupang_access_key: apiData.coupang_access_key,
        coupang_secret_key: apiData.coupang_secret_key,
        googlesheet_id: apiData.googlesheet_id,
        googlesheet_name: apiData.googlesheet_name
      }], {
        onConflict: 'user_id' // user_id가 중복되면 UPDATE
      });

    if (error) {
      console.error('❌ Supabase API 정보 저장 에러:', error);
      return {
        success: false,
        error: `API 정보 저장 실패: ${error.message}`
      };
    }

    console.log('✅ API 정보 저장 성공:', data);
    return {
      success: true,
      data: data
    };

  } catch (error: any) {
    console.error('❌ saveUserApiInfo 예외 발생:', error);
    return {
      success: false,
      error: `예기치 못한 오류: ${error.message}`
    };
  }
};

/**
 * 사용자 API 정보 조회
 * - users_api 테이블에서 특정 사용자의 API 정보를 조회
 */
export const getUserApiInfo = async (userId: string): Promise<ApiResponse<UserApiData>> => {
  try {
    console.log('📡 Supabase에서 API 정보 조회 시작:', userId);

    // users_api 테이블에서 사용자 API 정보 조회
    const { data, error } = await supabase
      .from('users_api')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // 데이터가 없는 경우는 에러가 아님
      if (error.code === 'PGRST116') {
        console.log('📄 해당 사용자의 API 정보가 없습니다.');
        return {
          success: true,
          data: undefined
        };
      }

      console.error('❌ Supabase API 정보 조회 에러:', error);
      return {
        success: false,
        error: `API 정보 조회 실패: ${error.message}`
      };
    }

    console.log('✅ API 정보 조회 성공:', data);
    return {
      success: true,
      data: data as UserApiData
    };

  } catch (error: any) {
    console.error('❌ getUserApiInfo 예외 발생:', error);
    return {
      success: false,
      error: `예기치 못한 오류: ${error.message}`
    };
  }
};

/**
 * 사용자 API 정보 삭제
 * - users_api 테이블에서 특정 사용자의 API 정보를 삭제
 */
export const deleteUserApiInfo = async (userId: string): Promise<ApiResponse> => {
  try {
    console.log('📡 Supabase에서 API 정보 삭제 시작:', userId);

    // users_api 테이블에서 사용자 API 정보 삭제
    const { data, error } = await supabase
      .from('users_api')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Supabase API 정보 삭제 에러:', error);
      return {
        success: false,
        error: `API 정보 삭제 실패: ${error.message}`
      };
    }

    console.log('✅ API 정보 삭제 성공:', data);
    return {
      success: true,
      data: data
    };

  } catch (error: any) {
    console.error('❌ deleteUserApiInfo 예외 발생:', error);
    return {
      success: false,
      error: `예기치 못한 오류: ${error.message}`
    };
  }
}; 