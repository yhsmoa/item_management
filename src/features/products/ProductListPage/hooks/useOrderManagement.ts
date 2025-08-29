// Custom hook for managing order operations
import { useState, useCallback, useRef } from 'react';
import { appendOrderDataToGoogleSheets } from '../services/googleSheetsOrderService';

interface UseOrderManagementProps {
  data?: any[];
  rocketInventoryData?: {[key: string]: any};
  getCurrentPageData?: () => any[];
}

export const useOrderManagement = (props: UseOrderManagementProps = {}) => {
  const { data = [], rocketInventoryData = {}, getCurrentPageData } = props;

  // State management
  const [inputValues, setInputValues] = useState<{[key: string]: string}>({});
  const [editingCell, setEditingCell] = useState<string | null>(null);

  // Refs for optimization
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get input value helper function
  const getInputValue = useCallback((cellId: string): string => {
    const cellValue = inputValues[cellId];
    // 객체인 경우 quantity 속성 추출, 아니면 그대로 사용
    return (typeof cellValue === 'object' && cellValue !== null && 'quantity' in cellValue) 
      ? String((cellValue as any).quantity || '')
      : String(cellValue || '');
  }, [inputValues]);

  // Render input value
  const renderInputValue = useCallback((row: any, index: number) => {
    const cellId = `input-${row.item_id}-${row.option_id || index}`;
    
    // getInputValue 로직을 직접 인라인으로 처리
    const cellValue = inputValues[cellId];
    const value = (typeof cellValue === 'object' && cellValue !== null && 'quantity' in cellValue) 
      ? String((cellValue as any).quantity || '')
      : String(cellValue || '');
    
    if (value && value !== '0') {
      const numValue = parseFloat(value);
      return isNaN(numValue) ? value : numValue.toLocaleString();
    }
    return value || '-';
  }, [inputValues]);

  // Render pending inbounds
  const renderPendingInbounds = useCallback((row: any) => {
    const value = row.option_id && rocketInventoryData[row.option_id]?.pending_inbounds;
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0);
    return value && numValue > 0 ? value : '-';
  }, [rocketInventoryData]);

  // Handle cell click
  const handleCellClick = useCallback((cellId: string) => {
    setEditingCell(cellId);
  }, []);

  // Handle input change
  const handleInputChange = useCallback((cellId: string, value: string, productInfo?: any) => {
    console.log('📝 [INPUT] 입력 변경:', { cellId, value, valueLength: value.length });
    
    // 즉시 상태 업데이트 (빠른 UI 반응)
    if (!value || value.trim() === '' || value === '0') {
      const newInputValues = { ...inputValues };
      delete newInputValues[cellId];
      setInputValues(newInputValues);
      console.log('🗑️ [INPUT] 빈 값으로 인한 삭제:', cellId);
    } else {
      // 상태에는 단순 값만 저장 (기존 로직 유지)
      const newInputValues = {
        ...inputValues,
        [cellId]: value
      };
      setInputValues(newInputValues);
      console.log('💾 [INPUT] 상태 업데이트:', { cellId, value });
    }
  }, [inputValues]);

  // Handle input key press
  const handleInputKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>, currentRowIndex: number) => {
    if (e.key === 'Enter') {
      setEditingCell(null);
      
      // 다음 행의 입력 셀로 이동
      const nextRowIndex = currentRowIndex + 1;
      if (getCurrentPageData) {
        const currentPageData = getCurrentPageData();
        if (nextRowIndex < currentPageData.length) {
          const nextRow = currentPageData[nextRowIndex];
          const nextCellId = `input-${nextRow.item_id}-${nextRow.option_id || nextRowIndex}`;
          
          setTimeout(() => {
            const nextInput = document.querySelector(`input[value="${getInputValue(nextCellId)}"]`) as HTMLInputElement;
            if (nextInput) {
              nextInput.focus();
              setEditingCell(nextCellId);
            }
          }, 50);
        }
      }
    }
  }, [getCurrentPageData, getInputValue]);

  // Handle enter key and save
  const handleEnterKeyAndSave = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>, row: any, cellId: string, currentRowIndex: number) => {
    if (e.key === 'Enter') {
      // 다음 행으로 이동만 (DB 저장 안함)
      handleInputKeyPress(e, currentRowIndex);
    }
  }, [handleInputKeyPress]);

  // Handle blur and save
  const handleBlurAndSave = useCallback(async (row: any, cellId: string) => {
    setEditingCell(null);
  }, []);

  // Batch order submission
  const handleBatchOrderSubmission = useCallback(async () => {
    const operationStartTime = performance.now();
    
    try {
      // 1. 입력 검증 및 전처리
      console.log('🚀 [BATCH_ORDER] 배치 주문 처리 시작');
      console.log('📊 [BATCH_ORDER] 성능 측정 시작:', operationStartTime);
      
      // 현재 로그인한 사용자 ID 가져오기
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id || currentUser.user_id;
      
      if (!userId) {
        alert('로그인 정보를 찾을 수 없습니다.');
        return;
      }

      // 2. localStorage에서 입력 데이터 추출
      console.log('📋 [BATCH_ORDER] 입력 데이터 추출 중...');
      console.log('🔍 [DEBUG] inputValues 전체:', inputValues);
      console.log('🔍 [DEBUG] inputValues 키 개수:', Object.keys(inputValues).length);
      
      const inputEntries = Object.entries(inputValues)
        .filter(([cellId, quantity]) => {
          const numQuantity = Number(quantity);
          const isValid = !isNaN(numQuantity) && numQuantity > 0;
          if (!isValid) {
            console.log('❌ [BATCH_ORDER] 유효하지 않은 입력 제외:', { cellId, quantity, numQuantity });
          }
          return isValid;
        });

      if (inputEntries.length === 0) {
        alert('주문할 상품이 없습니다. 수량을 입력해주세요.');
        return;
      }

      console.log('✅ [BATCH_ORDER] 유효한 입력:', inputEntries.length + '개');
      inputEntries.slice(0, 3).forEach(([cellId, quantity]) => {
        console.log('📦 [BATCH_ORDER] 입력 샘플:', { cellId, quantity });
      });

      // 3. Google Sheets에 주문 데이터 추가
      console.log('📋 [BATCH_ORDER] Google Sheets에 주문 데이터 추가 중...');
      
      const result = await appendOrderDataToGoogleSheets(userId, inputValues, data);
      
      if (result.success) {
        const endTime = performance.now();
        const duration = ((endTime - operationStartTime) / 1000).toFixed(2);
        
        // 주문 완료 메시지와 함께 입력 데이터 초기화 여부 확인
        const shouldClearData = window.confirm(
          `✅ Google Sheets 주문 처리 완료!\n` +
          `• 추가된 주문: ${result.addedCount}개\n` +
          `• 처리 시간: ${duration}초\n\n` +
          `입력한 수량 데이터를 초기화하시겠습니까?\n` +
          `(확인: 데이터 초기화, 취소: 데이터 유지)`
        );
        
        if (shouldClearData) {
          // 입력 데이터 초기화
          setInputValues({});
          console.log('🗑️ [BATCH_ORDER] 입력 데이터 초기화 완료');
          
          // localStorage에서도 제거 (있는 경우)
          localStorage.removeItem('productInputValues');
        } else {
          console.log('📋 [BATCH_ORDER] 입력 데이터 유지');
        }
        
        console.log('✅ [BATCH_ORDER] Google Sheets 주문 처리 완료:', {
          addedCount: result.addedCount,
          duration: duration + 's',
          dataCleared: shouldClearData
        });
      } else {
        console.error('❌ [BATCH_ORDER] Google Sheets 주문 처리 실패:', result.error);
        alert(`❌ Google Sheets 주문 처리 실패\n\n${result.error}`);
      }
      
    } catch (error) {
      console.error('❌ [BATCH_ORDER] 배치 주문 처리 실패:', error);
      alert('배치 주문 처리 중 오류가 발생했습니다.');
    }
  }, [inputValues, data]);

  return {
    // State
    inputValues,
    editingCell,
    
    // Setters
    setInputValues,
    setEditingCell,
    
    // Functions
    getInputValue,
    renderInputValue,
    renderPendingInbounds,
    handleCellClick,
    handleInputChange,
    handleInputKeyPress,
    handleEnterKeyAndSave,
    handleBlurAndSave,
    handleBatchOrderSubmission
  };
};