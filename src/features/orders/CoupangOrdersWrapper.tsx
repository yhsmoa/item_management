import React from 'react';
import CoupangOrders from './CoupangOrders';
import MainLayout from '../../layouts/MainLayout';
import { useGoogleSheetsImportAll } from './hooks/useGoogleSheetsImportAll';

/**
 * CoupangOrders를 MainLayout으로 감싸는 래퍼 컴포넌트
 * - 구글 시트 가져오기 기능을 TopMenuBar에 통합
 */
const CoupangOrdersWrapper: React.FC = () => {
  const { isLoading, handleGoogleSheetsImport } = useGoogleSheetsImportAll();

  return (
    <MainLayout
      onGoogleSheetsImport={handleGoogleSheetsImport}
      googleSheetsLoading={isLoading}
    >
      <CoupangOrders />
    </MainLayout>
  );
};

export default CoupangOrdersWrapper;
