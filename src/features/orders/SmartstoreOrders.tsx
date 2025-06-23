import React from 'react';

/**
 * 스마트스토어 주문 관리 페이지
 * - 네이버 스마트스토어에서 들어온 주문들을 관리하는 페이지
 */
const SmartstoreOrders: React.FC = () => {
  return (
    <div className="smartstore-orders-container">
      {/* 페이지 헤더 */}
      <div className="page-header">
        <h1 className="page-title">스마트스토어 주문</h1>
        <p className="page-description">네이버 스마트스토어에서 들어온 주문들을 확인하고 관리할 수 있습니다.</p>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="main-content">
        <div className="empty-state">
          <div className="empty-icon">🏪</div>
          <h2>스마트스토어 주문 관리</h2>
          <p>스마트스토어 주문 관리 기능이 곧 제공될 예정입니다.</p>
        </div>
      </div>
    </div>
  );
};

export default SmartstoreOrders; 