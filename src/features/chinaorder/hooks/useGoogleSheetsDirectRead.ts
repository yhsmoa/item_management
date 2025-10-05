import { useState } from 'react';

/**
 * 구글 시트 '신규' 시트를 직접 읽어서 화면에 표시하는 훅
 * Supabase에 저장하지 않고 직접 표시만 함
 */
export const useGoogleSheetsDirectRead = (onSuccess?: (data: any[]) => void) => {
  const [isLoading, setIsLoading] = useState(false);

  const getCurrentUserId = (): string | null => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      return currentUser.id || null;
    } catch (error) {
      console.error('❌ 사용자 정보 읽기 오류:', error);
      return null;
    }
  };

  const readGoogleSheetsData = async (userId: string): Promise<{success: boolean, error?: string, data?: any[]}> => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/googlesheets/read-new-sheet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.message || '백엔드 API 호출 실패' };
      }

      const responseData = await response.json();
      return {
        success: responseData.success,
        error: responseData.message,
        data: responseData.data || []
      };
    } catch (error: any) {
      console.error('❌ 백엔드 API 호출 오류:', error);
      return { success: false, error: `네트워크 오류: ${error.message}`, data: [] };
    }
  };

  const handleGoogleSheetsDirectRead = async (): Promise<void> => {
    const userId = getCurrentUserId();
    if (!userId) {
      alert('로그인 정보를 찾을 수 없습니다.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await readGoogleSheetsData(userId);

      if (result.success) {
        const dataCount = result.data?.length || 0;
        alert(`구글 시트에서 ${dataCount}개의 데이터를 불러왔습니다.`);

        // 성공 시 콜백 실행 (데이터 전달)
        if (onSuccess && result.data) {
          onSuccess(result.data);
        }
      } else {
        alert(`구글 시트 데이터 가져오기 실패:\n${result.error}`);
      }
    } catch (error: any) {
      console.error('❌ 구글 시트 읽기 에러:', error);
      alert(`오류가 발생했습니다:\n${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    handleGoogleSheetsDirectRead
  };
};
