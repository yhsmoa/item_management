import React from 'react';

/**
 * 쿠팡 주문 관리 페이지
 * - 쿠팡에서 들어온 주문들을 관리하는 페이지
 */
const CoupangOrders: React.FC = () => {
  return (
    <div className="coupang-orders-container">
      {/* 페이지 헤더 */}
      <div className="page-header">
        <h1 className="page-title">쿠팡 주문</h1>
        <p className="page-description">쿠팡에서 들어온 주문들을 확인하고 관리할 수 있습니다.</p>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="main-content">
        <div className="empty-state">
          <div className="empty-icon">🛒</div>
          <h2>쿠팡 주문 관리</h2>
          <p>쿠팡 주문 관리 기능이 곧 제공될 예정입니다.</p>
        </div>
      </div>
    </div>
  );
};

export default CoupangOrders; 