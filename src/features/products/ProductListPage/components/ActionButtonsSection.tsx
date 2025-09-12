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
        onClick={onBatchOrderSubmission}
        variant="primary"
      >
        주문
      </ActionButton>
    </div>
  );
};

export default ActionButtonsSection;