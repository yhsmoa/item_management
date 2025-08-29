// Upload service for file operations
import { supabase } from '../../../../config/supabase';
import { processProductExcelUpload, processSalesExcelUpload } from '../../../../services/excelUploadService';
import { processRocketInventoryExcelUpload } from '../../../../services/rocketInventoryService';

interface ProgressCallback {
  (stage: string, current?: number, total?: number): void;
}

interface UploadCallbacks {
  setIsLoadingApi: (loading: boolean) => void;
  setProductInfoProgress: (progress: { current: number; total: number; message: string } | null) => void;
  loadProductsFromDB: () => Promise<void>;
  setData: (data: any[]) => void;
  setFilteredData: (data: any[]) => void;
  setSelectedItems: (items: any[]) => void;
  setSelectAll: (value: boolean) => void;
}

interface RocketInventoryUploadCallbacks {
  setIsUploadingRocketInventory: (loading: boolean) => void;
  setProductInfoProgress: (progress: { current: number; total: number; message: string } | null) => void;
  loadRocketInventoryOptionIds: () => Promise<void>;
}

interface SalesUploadCallbacks {
  setIsLoadingSalesExcel: (loading: boolean) => void;
  setProductInfoProgress: (progress: { current: number; total: number; message: string } | null) => void;
}

export const handleDeleteAllData = async (callbacks: UploadCallbacks): Promise<void> => {
  const confirmMessage = '정말로 모든 상품 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.';
  
  if (!window.confirm(confirmMessage)) {
    return;
  }

  try {
    // 현재 로그인한 사용자 ID 가져오기
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id || currentUser.user_id;
    
    if (!userId) {
      alert('로그인 정보를 찾을 수 없습니다.');
      return;
    }

    // extract_coupang_item_all 테이블에서 해당 user_id 데이터 삭제
    const { error } = await supabase
      .from('extract_coupang_item_all')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('데이터 삭제 실패:', error);
      alert('데이터 삭제 중 오류가 발생했습니다.');
      return;
    }

    // 성공 시 로컬 상태 초기화
    callbacks.setData([]);
    callbacks.setFilteredData([]);
    callbacks.setSelectedItems([]);
    callbacks.setSelectAll(false);
    
    alert('모든 상품 데이터가 성공적으로 삭제되었습니다.');
    
    // 데이터 다시 로드 (빈 상태 확인)
    await callbacks.loadProductsFromDB();
    
  } catch (error) {
    console.error('전체 삭제 실패:', error);
    alert('데이터 삭제 중 오류가 발생했습니다.');
  }
};

export const handleExcelUpload = (callbacks: UploadCallbacks): void => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      callbacks.setIsLoadingApi(true);
      try {
        await processProductExcelUpload(file, (stage, current, total) => {
          if (current !== undefined && total !== undefined) {
            callbacks.setProductInfoProgress({ current, total, message: stage });
          }
        });
        await callbacks.loadProductsFromDB();
        // 검색 상태는 useEffect에서 자동으로 보존됨
        alert('상품등록 엑셀 업로드가 완료되었습니다.');
      } catch (error) {
        console.error('엑셀 업로드 실패:', error);
        alert('엑셀 업로드 중 오류가 발생했습니다.');
      } finally {
        callbacks.setIsLoadingApi(false);
        callbacks.setProductInfoProgress(null);
      }
    }
  };
  input.click();
};

export const handleRocketInventoryExcelUpload = (callbacks: RocketInventoryUploadCallbacks): void => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      callbacks.setIsUploadingRocketInventory(true);
      try {
        await processRocketInventoryExcelUpload(file, (stage, current, total) => {
          if (current !== undefined && total !== undefined) {
            callbacks.setProductInfoProgress({ current, total, message: stage });
          }
        });
        await callbacks.loadRocketInventoryOptionIds();
        // 검색 상태는 useEffect에서 자동으로 보존됨
        alert('로켓그로스 xlsx 업로드가 완료되었습니다.');
      } catch (error) {
        console.error('로켓그로스 업로드 실패:', error);
        alert('로켓그로스 업로드 중 오류가 발생했습니다.');
      } finally {
        callbacks.setIsUploadingRocketInventory(false);
        callbacks.setProductInfoProgress(null);
      }
    }
  };
  input.click();
};

export const handleSalesExcelUpload = (callbacks: SalesUploadCallbacks): void => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      callbacks.setIsLoadingSalesExcel(true);
      try {
        const result = await processSalesExcelUpload(file, (stage, current, total) => {
          if (current !== undefined && total !== undefined) {
            callbacks.setProductInfoProgress({ current, total, message: stage });
          }
        });
        
        if (result.success) {
          alert(`판매량 xlsx 업로드가 완료되었습니다.\n처리된 데이터: ${result.processedCount}개`);
          console.log('📊 판매량 엑셀 업로드 성공:', {
            파일명: file.name,
            처리된행수: result.processedCount,
            전체행수: result.totalRows
          });
        } else {
          throw new Error(result.error || '업로드 실패');
        }
      } catch (error) {
        console.error('판매량 엑셀 업로드 실패:', error);
        alert(`판매량 엑셀 업로드 중 오류가 발생했습니다.\n${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      } finally {
        callbacks.setIsLoadingSalesExcel(false);
        callbacks.setProductInfoProgress(null);
      }
    }
  };
  input.click();
};