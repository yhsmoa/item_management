import { useState } from 'react';
import { importGoogleSheetsDataAll } from '../../../services/googleSheetsServiceAll';

export const useGoogleSheetsImportAll = (onSuccess?: () => void) => {
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

  const handleGoogleSheetsImport = async (): Promise<void> => {
    const userId = getCurrentUserId();
    if (!userId) {
      alert('로그인 정보를 찾을 수 없습니다.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await importGoogleSheetsDataAll(userId);

      if (result.success) {
        alert('구글 시트 데이터 가져오기 성공!');
        // 성공 시 콜백 실행
        if (onSuccess) {
          onSuccess();
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
