import { useState } from 'react';

export const useGoogleSheetsImport = (onSuccess?: () => void) => {
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

  const importGoogleSheetsData = async (userId: string): Promise<{success: boolean, error?: string}> => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/googlesheets/import-data`, {
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

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('❌ 백엔드 API 호출 오류:', error);
      return { success: false, error: `네트워크 오류: ${error.message}` };
    }
  };

  const handleGoogleSheetsImport = async (): Promise<void> => {
    const userId = getCurrentUserId();
    if (!userId) {
      alert('로그인 정보를 찾을 수 없습니다.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await importGoogleSheetsData(userId);
      
      if (result.success) {
        alert('구글 시트 데이터 가져오기 성공!');
        // 성공 시 콜백 실행 또는 페이지 새로고침
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }
      } else {
        alert(`구글 시트 데이터 가져오기 실패:\n${result.error}`);
      }
    } catch (error: any) {
      console.error('❌ 구글 시트 가져오기 에러:', error);
      alert(`오류가 발생했습니다:\n${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    handleGoogleSheetsImport
  };
};