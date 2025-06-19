import { createClient } from '@supabase/supabase-js'

/**
 * Supabase 설정
 * - 실제 프로덕션에서는 환경변수(.env)에서 가져와야 합니다
 * - 현재는 개발용으로 더미 값 사용 (임시)
 */

// 임시 더미 값 - 앱 로딩을 위해 사용
const supabaseUrl = 'https://dummy.supabase.co'
const supabaseAnonKey = 'dummy-anon-key-for-development'

/**
 * Supabase 클라이언트 인스턴스 (더미)
 * - 실제 연동 전까지는 더미 클라이언트 사용
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * 회원가입 데이터 타입 정의
 * - 데이터베이스 테이블 구조와 일치해야 함
 */
export interface UserRegistrationData {
  username: string;
  password: string;
  name: string;
  email: string;
  phone: string;
  created_at?: string;
} 