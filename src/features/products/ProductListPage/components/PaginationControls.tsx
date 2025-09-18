// Pagination controls component
import React from 'react';
import ActionButton from '../../../../components/ActionButton';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  handlePageChange: (page: number) => void;
  transformedDataLength: number;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  handlePageChange,
  transformedDataLength
}) => {
  // 페이지 변경 시 테이블 상단으로 스크롤하는 함수
  const scrollToTableTop = () => {
    const tableElement = document.querySelector('.product-list-table-section');
    if (tableElement) {
      tableElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  const handlePreviousPage = () => {
    handlePageChange(currentPage - 1);
    scrollToTableTop();
  };

  const handleNextPage = () => {
    handlePageChange(currentPage + 1);
    scrollToTableTop();
  };

  return (
    <div className="product-list-pagination">
      <div className="product-list-pagination-controls">
        <ActionButton
          onClick={handlePreviousPage}
          disabled={currentPage === 1}
          variant="default"
          className="product-list-pagination-button"
        >
          이전
        </ActionButton>
        <span className="product-list-pagination-current">
          {currentPage} / {totalPages || 1}
        </span>
        <ActionButton
          onClick={handleNextPage}
          disabled={currentPage === totalPages || totalPages === 0}
          variant="default"
          className="product-list-pagination-button"
        >
          다음
        </ActionButton>
      </div>
      <div className="product-list-pagination-info">
        {transformedDataLength}개 중 {((currentPage - 1) * 100) + 1}-{Math.min(currentPage * 100, transformedDataLength)}개 표시
      </div>
    </div>
  );
};

export default PaginationControls;