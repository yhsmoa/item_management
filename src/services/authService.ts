import { supabase } from '../config/supabase';

// 사용자 데이터 타입 정의
export interface User {
  id: string;
  password: string;
  name: string;
  email: string;
  contact_number: string;
  coupang_name?: string;
  created_at?: string;
  updated_at?: string;
}

// 회원가입 데이터 타입
export interface RegisterData {
  id: string;           // 아이디
  password: string;     // 패스워드
  name: string;         // 이름
  email: string;        // 이메일주소
  contact_number: string; // 연락처
}

// 로그인 데이터 타입
export interface LoginData {
  id: string;
  password: string;
}

/**
 * 사용자 회원가입
 */
export async function registerUser(userData: RegisterData): Promise<{ success: boolean; error?: string; user?: User }> {
  try {
    console.log('🚀 회원가입 시작:', userData);

    // 1. 중복 아이디 검사
    const { data: existingUserById, error: checkIdError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userData.id)
      .single();

    if (checkIdError && checkIdError.code !== 'PGRST116') { // PGRST116은 "no rows found" 에러
      console.error('❌ 아이디 중복 검사 오류:', checkIdError);
      throw checkIdError;
    }

    if (existingUserById) {
      return {
        success: false,
        error: '이미 사용 중인 아이디입니다.'
      };
    }

    // 2. 중복 이메일 검사
    const { data: existingUserByEmail, error: checkEmailError } = await supabase
      .from('users')
      .select('email')
      .eq('email', userData.email)
      .single();

    if (checkEmailError && checkEmailError.code !== 'PGRST116') {
      console.error('❌ 이메일 중복 검사 오류:', checkEmailError);
      throw checkEmailError;
    }

    if (existingUserByEmail) {
      return {
        success: false,
        error: '이미 사용 중인 이메일입니다.'
      };
    }

    // 3. 새 사용자 데이터 저장
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single();

    if (insertError) {
      console.error('❌ 사용자 저장 오류:', insertError);
      throw insertError;
    }

    console.log('✅ 회원가입 성공:', newUser);

    return {
      success: true,
      user: newUser
    };

  } catch (error) {
    console.error('❌ 회원가입 처리 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '회원가입 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 사용자 로그인
 */
export async function loginUser(loginData: LoginData): Promise<{ success: boolean; error?: string; user?: User }> {
  try {
    console.log('🚀 로그인 시작:', { id: loginData.id });

    // 사용자 조회 (아이디와 패스워드 일치 확인)
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', loginData.id)
      .eq('password', loginData.password)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // no rows found
        console.log('❌ 로그인 실패: 아이디 또는 패스워드 불일치');
        return {
          success: false,
          error: '아이디 및 패스워드를 확인해주세요.'
        };
      } else {
        console.error('❌ 로그인 처리 오류:', error);
        throw error;
      }
    }

    console.log('✅ 로그인 성공:', { id: user.id, name: user.name });

    return {
      success: true,
      user: user
    };

  } catch (error) {
    console.error('❌ 로그인 처리 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 사용자 정보 조회 (ID로)
 */
export async function getUserById(userId: string): Promise<{ success: boolean; error?: string; user?: User }> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          success: false,
          error: '사용자를 찾을 수 없습니다.'
        };
      } else {
        throw error;
      }
    }

    return {
      success: true,
      user: user
    };

  } catch (error) {
    console.error('❌ 사용자 조회 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '사용자 조회 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 현재 로그인한 사용자 정보 가져오기 (localStorage에서)
 */
export function getCurrentUser(): { id: string; name: string } | null {
  try {
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) {
      return null;
    }

    const user = JSON.parse(currentUser);
    
    // users 테이블의 id 필드 반환
    if (user.id) {
      return {
        id: user.id,
        name: user.name || ''
      };
    }

    return null;
  } catch (error) {
    console.error('❌ 현재 사용자 정보 조회 오류:', error);
    return null;
  }
}

/**
 * 현재 로그인한 사용자의 ID만 가져오기
 */
export function getCurrentUserId(): string | null {
  const user = getCurrentUser();
  return user?.id || null;
} 