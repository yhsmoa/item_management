// Custom hook for managing order operations
import { useState, useCallback, useRef } from 'react';
import { appendOrderDataToGoogleSheets } from '../services/googleSheetsOrderService';
import { ShipmentManagerService } from '../services/shipmentManagerService';

interface UseOrderManagementProps {
  data?: any[];
  rocketInventoryData?: {[key: string]: any};
  getCurrentPageData?: () => any[];
  shipmentStockData?: {[key: string]: number};
  onShipmentDataChange?: () => void;
}

export const useOrderManagement = (props: UseOrderManagementProps = {}) => {
  const { data = [], rocketInventoryData = {}, getCurrentPageData, shipmentStockData = {}, onShipmentDataChange } = props;

  // State management
  const [inputValues, setInputValues] = useState<{[key: string]: string}>({});
  const [shippingValues, setShippingValues] = useState<{[key: string]: string}>({});
  const [returnValues, setReturnValues] = useState<{[key: string]: string}>({});
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

  // Get shipping value helper function
  const getShippingValue = useCallback((cellId: string): string => {
    // 편집 중인 값이 있으면 사용, 없으면 빈 문자열 반환 (편집 시작 시 기본값 설정은 handleCellClick에서)
    const cellValue = shippingValues[cellId];
    return String(cellValue || '');
  }, [shippingValues]);

  // Get return value helper function
  const getReturnValue = useCallback((cellId: string): string => {
    const cellValue = returnValues[cellId];
    return String(cellValue || '');
  }, [returnValues]);

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

  // Render shipping value
  const renderShippingValue = useCallback((row: any, index: number) => {
    const cellId = `shipping-${row.item_id}-${row.option_id || index}`;
    
    // 편집 중이면 shippingValues 사용, 아니면 실제 저장된 데이터 사용
    const editingValue = shippingValues[cellId];
    const savedValue = row.barcode ? shipmentStockData[row.barcode] : 0;
    
    const value = editingValue !== undefined ? editingValue : savedValue;
    
    if (value && value !== '0' && value !== 0) {
      const numValue = parseFloat(String(value));
      return isNaN(numValue) ? String(value) : numValue.toLocaleString();
    }
    return '-';
  }, [shippingValues, shipmentStockData]);

  // Render return value
  const renderReturnValue = useCallback((row: any, index: number) => {
    const cellId = `return-${row.item_id}-${row.option_id || index}`;
    const value = returnValues[cellId];
    
    if (value && value !== '0') {
      const numValue = parseFloat(value);
      return isNaN(numValue) ? value : numValue.toLocaleString();
    }
    return value || '-';
  }, [returnValues]);

  // Render pending inbounds
  const renderPendingInbounds = useCallback((row: any) => {
    const value = row.option_id && rocketInventoryData[row.option_id]?.pending_inbounds;
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0);
    return value && numValue > 0 ? value : '-';
  }, [rocketInventoryData]);

  // Handle cell click
  const handleCellClick = useCallback((cellId: string, row?: any) => {
    setEditingCell(cellId);
    
    // 출고 셀 클릭 시 현재 저장된 값을 편집 필드에 설정
    if (cellId.startsWith('shipping-') && row && row.barcode) {
      const currentValue = shipmentStockData[row.barcode] || 0;
      setShippingValues(prev => ({
        ...prev,
        [cellId]: String(currentValue)
      }));
    }
  }, [shipmentStockData]);

  // Handle input change
  const handleInputChange = useCallback((cellId: string, value: string, productInfo?: any) => {
    console.log('📝 [INPUT] 입력 변경:', { cellId, value, valueLength: value.length });
    
    // 셀 타입에 따라 다른 state 업데이트
    if (cellId.startsWith('shipping-')) {
      // 출고 관련 입력
      if (!value || value.trim() === '' || value === '0') {
        const newShippingValues = { ...shippingValues };
        delete newShippingValues[cellId];
        setShippingValues(newShippingValues);
      } else {
        setShippingValues(prev => ({ ...prev, [cellId]: value }));
      }
    } else if (cellId.startsWith('return-')) {
      // 반출 관련 입력
      if (!value || value.trim() === '' || value === '0') {
        const newReturnValues = { ...returnValues };
        delete newReturnValues[cellId];
        setReturnValues(newReturnValues);
      } else {
        setReturnValues(prev => ({ ...prev, [cellId]: value }));
      }
    } else {
      // 기존 입력 로직
      if (!value || value.trim() === '' || value === '0') {
        const newInputValues = { ...inputValues };
        delete newInputValues[cellId];
        setInputValues(newInputValues);
        console.log('🗑️ [INPUT] 빈 값으로 인한 삭제:', cellId);
      } else {
        const newInputValues = {
          ...inputValues,
          [cellId]: value
        };
        setInputValues(newInputValues);
        console.log('💾 [INPUT] 상태 업데이트:', { cellId, value });
      }
    }
  }, [inputValues, shippingValues, returnValues]);

  // Handle input key press
  const handleInputKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>, currentRowIndex: number, cellType: string = 'input') => {
    if (e.key === 'Enter') {
      setEditingCell(null);
      
      // 다음 행의 같은 타입 셀로 이동
      const nextRowIndex = currentRowIndex + 1;
      if (getCurrentPageData) {
        const currentPageData = getCurrentPageData();
        if (nextRowIndex < currentPageData.length) {
          const nextRow = currentPageData[nextRowIndex];
          let nextCellId: string;
          
          // 셀 타입에 따라 다음 행의 같은 타입 셀로 이동
          if (cellType === 'shipping') {
            nextCellId = `shipping-${nextRow.item_id}-${nextRow.option_id || nextRowIndex}`;
          } else if (cellType === 'return') {
            nextCellId = `return-${nextRow.item_id}-${nextRow.option_id || nextRowIndex}`;
          } else {
            nextCellId = `input-${nextRow.item_id}-${nextRow.option_id || nextRowIndex}`;
          }
          
          setTimeout(() => {
            setEditingCell(nextCellId);
          }, 50);
        }
      }
    }
  }, [getCurrentPageData]);

  // Handle enter key and save
  const handleEnterKeyAndSave = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>, row: any, cellId: string, currentRowIndex: number) => {
    if (e.key === 'Enter') {
      // 셀 타입 결정
      let cellType = 'input';
      if (cellId.startsWith('shipping-')) {
        cellType = 'shipping';
      } else if (cellId.startsWith('return-')) {
        cellType = 'return';
      }
      
      // 다음 행으로 이동만 (DB 저장 안함)
      handleInputKeyPress(e, currentRowIndex, cellType);
    }
  }, [handleInputKeyPress]);

  // Handle blur and save
  const handleBlurAndSave = useCallback(async (row: any, cellId: string) => {
    setEditingCell(null);
    
    // 출고 셀인 경우 실제 수량 업데이트 처리
    if (cellId.startsWith('shipping-') && onShipmentDataChange) {
      await handleShipmentUpdate(row, cellId);
    }
  }, [onShipmentDataChange]);

  // Handle shipment update
  const handleShipmentUpdate = useCallback(async (row: any, cellId: string) => {
    try {
      if (!row.barcode) {
        console.log('❌ [SHIPMENT_UPDATE] 바코드 없음:', row);
        return;
      }

      // 현재 로그인한 사용자 ID 가져오기
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id || currentUser.user_id;
      
      if (!userId) {
        console.error('❌ [SHIPMENT_UPDATE] 사용자 ID를 찾을 수 없습니다.');
        return;
      }

      const newValue = shippingValues[cellId];
      const newAmount = Number(newValue) || 0;
      const currentAmount = shipmentStockData[row.barcode] || 0;

      if (newAmount === currentAmount) {
        console.log('📋 [SHIPMENT_UPDATE] 변경사항 없음:', { barcode: row.barcode, amount: newAmount });
        return;
      }

      console.log('🔄 [SHIPMENT_UPDATE] 출고 수량 업데이트 시작:', {
        barcode: row.barcode,
        current: currentAmount,
        new: newAmount
      });

      const result = await ShipmentManagerService.updateShipmentAmount(
        userId,
        row.barcode,
        currentAmount,
        newAmount
      );

      if (result.success) {
        console.log('✅ [SHIPMENT_UPDATE] 업데이트 완료:', result.message);
        // 데이터 새로고침
        if (onShipmentDataChange) {
          onShipmentDataChange();
        }
      } else {
        console.error('❌ [SHIPMENT_UPDATE] 업데이트 실패:', result.message);
        alert(`출고 수량 업데이트 실패: ${result.message}`);
        // 실패 시 원래 값으로 복원
        setShippingValues(prev => ({
          ...prev,
          [cellId]: String(currentAmount)
        }));
      }

    } catch (error) {
      console.error('❌ [SHIPMENT_UPDATE] 예외 발생:', error);
      alert('출고 수량 업데이트 중 오류가 발생했습니다.');
    }
  }, [shippingValues, shipmentStockData, onShipmentDataChange]);

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
    shippingValues,
    returnValues,
    editingCell,
    
    // Setters
    setInputValues,
    setShippingValues,
    setReturnValues,
    setEditingCell,
    
    // Functions
    getInputValue,
    getShippingValue,
    getReturnValue,
    renderInputValue,
    renderShippingValue,
    renderReturnValue,
    renderPendingInbounds,
    handleCellClick,
    handleInputChange,
    handleInputKeyPress,
    handleEnterKeyAndSave,
    handleBlurAndSave,
    handleBatchOrderSubmission
  };
};