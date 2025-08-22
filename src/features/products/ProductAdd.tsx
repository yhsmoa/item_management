import React from 'react';
import './ProductAdd.css';

function ProductAdd() {
  return (
    <div className="product-add-container">
      <div className="product-add-header">
        <h1 className="product-add-title">상품 등록</h1>
      </div>
      
      <div className="product-add-actions">
        <button className="product-list-button product-list-button-success">
          상품 등록 xlsx
        </button>
      </div>
      
      <div className="product-add-boards">
        <div className="product-add-board">
          {/* 첫 번째 보드 내용 */}
        </div>
        <div className="product-add-board">
          {/* 두 번째 보드 내용 */}
        </div>
      </div>
    </div>
  );
}

export default ProductAdd;