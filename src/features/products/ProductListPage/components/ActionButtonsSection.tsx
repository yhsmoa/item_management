// Action buttons section component
import React from 'react';
import ActionButton from '../../../../components/ActionButton';

interface ActionButtonsSectionProps {
  onDeleteAllData: () => void;
  onExcelUpload: () => void;
  onSalesExcelUpload: () => void;
  onRocketInventoryExcelUpload: () => void;
  isLoadingApi: boolean;
  isLoadingSalesExcel: boolean;
  isUploadingRocketInventory: boolean;
  inputValues: {[key: string]: string};
  onBatchOrderSubmission: () => void;
}

export const ActionButtonsSection: React.FC<ActionButtonsSectionProps> = ({
  onDeleteAllData,
  onExcelUpload,
  onSalesExcelUpload,
  onRocketInventoryExcelUpload,
  isLoadingApi,
  isLoadingSalesExcel,
  isUploadingRocketInventory,
  inputValues,
  onBatchOrderSubmission
}) => {
  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      <ActionButton
        onClick={onDeleteAllData}
        variant="danger"
      >
        전체삭제
      </ActionButton>
      
      <ActionButton
        onClick={onExcelUpload}
        loading={isLoadingApi}
        variant="success"
        loadingText="업로드 중..."
      >
        상품등록 xlsx
      </ActionButton>
      
      <ActionButton
        onClick={onSalesExcelUpload}
        loading={isLoadingSalesExcel}
        variant="success"
        loadingText="업로드 중..."
      >
        판매량 xlsx
      </ActionButton>
      
      <ActionButton
        onClick={onRocketInventoryExcelUpload}
        loading={isUploadingRocketInventory}
        variant="warning"
        loadingText="업로드 중..."
      >
        로켓그로스 xlsx
      </ActionButton>

      <ActionButton
        onClick={() => {
          console.log('🔍 [진단] 현재 상태 확인:');
          console.log('inputValues:', inputValues);
          console.log('localStorage:', localStorage.getItem('productInputValues'));
          console.log('테이블 input 필드들:', document.querySelectorAll('input[type="number"]').length);
          
          const inputFields = Array.from(document.querySelectorAll('input[type="text"]'));
          const fieldValues = inputFields.map(input => ({
            id: (input as HTMLInputElement).id || 'no-id',
            value: (input as HTMLInputElement).value
          }));
          
          console.log('실제 input 필드 값들:', fieldValues.filter(f => f.value));
          
          alert(`진단 결과:\n- inputValues 개수: ${Object.keys(inputValues).length}\n- localStorage 있음: ${!!localStorage.getItem('productInputValues')}\n- 입력 필드 개수: ${inputFields.length}\n- 값 있는 필드: ${fieldValues.filter(f => f.value).length}`);
        }}
        variant="info"
      >
        진단
      </ActionButton>
      
      <ActionButton
        onClick={onBatchOrderSubmission}
        variant="primary"
      >
        주문
      </ActionButton>
    </div>
  );
};

export default ActionButtonsSection;