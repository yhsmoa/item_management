import React, { useState } from 'react';
import ActionButton from '../../../../components/ActionButton';
import './AddOrderModal.css';

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

type TabType = 'single' | 'bulk' | 'coupang';

const AddOrderModal: React.FC<AddOrderModalProps> = ({ isOpen, onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState<TabType>('single');
  const [productName, setProductName] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const coupangFileInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedCoupangFileName, setSelectedCoupangFileName] = useState<string>('');
  const [orderItems, setOrderItems] = useState([
    {
      id: 1,
      image: '',
      optionName: '',
      barcode: '',
      quantity: 0,
      chinaOption1: '',
      chinaOption2: '',
      unitPrice: '',
      imageUrl: '',
      linkUrl: ''
    }
  ]);

  if (!isOpen) return null;

  const handleAddRow = () => {
    setOrderItems([
      ...orderItems,
      {
        id: orderItems.length + 1,
        image: '',
        optionName: '',
        barcode: '',
        quantity: 0,
        chinaOption1: '',
        chinaOption2: '',
        unitPrice: '',
        imageUrl: '',
        linkUrl: ''
      }
    ]);
  };

  const handleCopyRow = () => {
    if (orderItems.length === 0) return;

    const lastItem = orderItems[orderItems.length - 1];
    setOrderItems([
      ...orderItems,
      {
        ...lastItem,
        id: orderItems.length + 1
      }
    ]);
  };

  const handleItemChange = (id: number, field: string, value: any) => {
    setOrderItems(orderItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleDeleteItem = (id: number) => {
    setOrderItems(orderItems.filter(item => item.id !== id));
  };

  const handleSave = async () => {
    console.log('저장할 데이터:', { productName, orderItems, activeTab });

    if (activeTab === 'single') {
      // 단건 저장 - 테스트: C1 셀에 '입력 완료' 입력
      try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const userId = currentUser.id || currentUser.user_id;

        if (!userId) {
          alert('사용자 정보를 찾을 수 없습니다.');
          return;
        }

        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/googlesheets/test-write`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userId
          }),
        });

        const result = await response.json();

        if (result.success) {
          alert('구글시트에 테스트 입력 완료! (C1 셀)');
          onSave({ productName, orderItems, activeTab });
          onClose();
        } else {
          alert(`저장 실패: ${result.message}`);
        }
      } catch (error) {
        console.error('저장 오류:', error);
        alert('저장 중 오류가 발생했습니다.');
      }
    } else {
      // 대량엑셀, 쿠팡엑셀은 나중에 구현
      onSave({ productName, orderItems, activeTab });
      onClose();
    }
  };

  const handleDownloadTemplate = () => {
    // XLSX 라이브러리 import 필요
    import('xlsx').then((XLSX) => {
      const wb = XLSX.utils.book_new();

      const wsData = [
        ['주문날짜', '주문번호', '상품명', '옵션명', '수량', '바코드', '중국옵션 1', '중국옵션 2', '단가', '총금액', '이미지 url', '사이트 url']
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // 헤더 스타일 설정 (회색 배경)
      const headerStyle = {
        fill: { fgColor: { rgb: "D3D3D3" } }
      };

      // A1부터 L1까지 헤더 셀에 스타일 적용
      const headers = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1', 'L1'];
      headers.forEach(cell => {
        if (!ws[cell]) ws[cell] = {};
        ws[cell].s = headerStyle;
      });

      // 열 너비 설정
      ws['!cols'] = [
        { wch: 12 },  // A - 주문날짜
        { wch: 15 },  // B - 주문번호
        { wch: 25 },  // C - 상품명
        { wch: 20 },  // D - 옵션명
        { wch: 8 },   // E - 수량
        { wch: 15 },  // F - 바코드
        { wch: 15 },  // G - 중국옵션 1
        { wch: 15 },  // H - 중국옵션 2
        { wch: 10 },  // I - 단가
        { wch: 12 },  // J - 총금액
        { wch: 30 },  // K - 이미지 url
        { wch: 30 }   // L - 사이트 url
      ];

      XLSX.utils.book_append_sheet(wb, ws, '신규');
      XLSX.writeFile(wb, '템플릿.xlsx');
    });
  };

  const handleDownloadCoupangTemplate = () => {
    import('xlsx').then((XLSX) => {
      const wb = XLSX.utils.book_new();

      const wsData = [
        ['주문날짜', '주문번호', '상품명', '옵션명', '수량', '바코드', '중국옵션 1', '중국옵션 2', '단가', '총금액', '이미지 url', '사이트 url']
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // 헤더 스타일 설정 (회색 배경)
      const headerStyle = {
        fill: { fgColor: { rgb: "D3D3D3" } }
      };

      const headers = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1', 'L1'];
      headers.forEach(cell => {
        if (!ws[cell]) ws[cell] = {};
        ws[cell].s = headerStyle;
      });

      ws['!cols'] = [
        { wch: 12 },
        { wch: 15 },
        { wch: 25 },
        { wch: 20 },
        { wch: 8 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 10 },
        { wch: 12 },
        { wch: 30 },
        { wch: 30 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, '신규');
      XLSX.writeFile(wb, '템플릿.xlsx');
    });
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setSelectedFileName(files[0].name);
    // TODO: 파일 업로드 처리
    console.log('선택된 파일:', files[0].name);
  };

  const handleCoupangFileSelect = () => {
    coupangFileInputRef.current?.click();
  };

  const handleCoupangFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setSelectedCoupangFileName(files[0].name);
    // TODO: 파일 업로드 처리
    console.log('선택된 쿠팡 파일:', files[0].name);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* 상단 버튼 영역 */}
        <div className="modal-header">
          <div className="modal-header-buttons">
            <ActionButton variant="default" onClick={onClose} className="cancel-button">
              취소
            </ActionButton>
            <ActionButton variant="success" onClick={handleSave}>
              저장
            </ActionButton>
          </div>
        </div>

        {/* 탭 버튼 영역 */}
        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === 'single' ? 'active' : ''}`}
            onClick={() => setActiveTab('single')}
          >
            단건
          </button>
          <button
            className={`modal-tab ${activeTab === 'bulk' ? 'active' : ''}`}
            onClick={() => setActiveTab('bulk')}
          >
            대량엑셀
          </button>
          <button
            className={`modal-tab ${activeTab === 'coupang' ? 'active' : ''}`}
            onClick={() => setActiveTab('coupang')}
          >
            쿠팡엑셀
          </button>
        </div>

        {/* 단건 탭 내용 */}
        {activeTab === 'single' && (
          <div className="modal-content">
            {/* 주문 항목 리스트 */}
            <div className="order-items-list">
              {orderItems.map((item) => (
                <div key={item.id} className="order-item-row">
                  {/* 이미지 영역 */}
                  <div className="order-item-image-section">
                    <div className="order-item-image">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt="상품 이미지"
                          className="product-image"
                        />
                      ) : (
                        <div className="image-placeholder">이미지</div>
                      )}
                    </div>
                    <ActionButton
                      variant="danger"
                      onClick={() => handleDeleteItem(item.id)}
                      className="delete-item-button"
                    >
                      삭제
                    </ActionButton>
                  </div>

                  {/* 입력 폼 영역 */}
                  <div className="order-item-form">
                    {/* 등록상품명 */}
                    <input
                      type="text"
                      className="order-item-input-full"
                      placeholder="등록상품명"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                    />

                    {/* 옵션명, 바코드, 수량 */}
                    <div className="order-item-row-group option-group">
                      <input
                        type="text"
                        className="order-item-input"
                        placeholder="옵션명"
                        value={item.optionName}
                        onChange={(e) => handleItemChange(item.id, 'optionName', e.target.value)}
                      />
                      <input
                        type="text"
                        className="order-item-input"
                        placeholder="바코드"
                        value={item.barcode}
                        onChange={(e) => handleItemChange(item.id, 'barcode', e.target.value)}
                      />
                      <input
                        type="number"
                        className="order-item-input"
                        placeholder="수량"
                        value={item.quantity || ''}
                        onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                      />
                    </div>

                    {/* 중국옵션1, 중국옵션2, 단가 */}
                    <div className="order-item-row-group">
                      <input
                        type="text"
                        className="order-item-input"
                        placeholder="중국 옵션명 1"
                        value={item.chinaOption1}
                        onChange={(e) => handleItemChange(item.id, 'chinaOption1', e.target.value)}
                      />
                      <input
                        type="text"
                        className="order-item-input"
                        placeholder="중국 옵션명 2"
                        value={item.chinaOption2}
                        onChange={(e) => handleItemChange(item.id, 'chinaOption2', e.target.value)}
                      />
                      <input
                        type="text"
                        className="order-item-input"
                        placeholder="단가"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                      />
                    </div>

                    {/* 이미지 URL, 링크 URL */}
                    <div className="order-item-row-group url-group">
                      <input
                        type="text"
                        className="order-item-input"
                        placeholder="이미지 URL"
                        value={item.imageUrl}
                        onChange={(e) => handleItemChange(item.id, 'imageUrl', e.target.value)}
                      />
                      <input
                        type="text"
                        className="order-item-input"
                        placeholder="링크 URL"
                        value={item.linkUrl}
                        onChange={(e) => handleItemChange(item.id, 'linkUrl', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 추가/복사 버튼 */}
            <div className="add-row-buttons">
              <button className="add-row-button" onClick={handleAddRow}>
                + 추가
              </button>
              <button className="copy-row-button" onClick={handleCopyRow}>
                복사
              </button>
            </div>
          </div>
        )}

        {/* 대량엑셀 탭 내용 */}
        {activeTab === 'bulk' && (
          <div className="modal-content bulk-excel-content">
            <div className="bulk-excel-header">
              <ActionButton
                variant="success"
                onClick={handleDownloadTemplate}
                className="template-download-button"
              >
                템플릿.xlsx
              </ActionButton>
            </div>

            <div className="bulk-excel-upload-area" onClick={handleFileSelect}>
              <div className="bulk-excel-upload-icon">📁</div>
              <p>{selectedFileName || 'Excel 파일을 선택하세요'}</p>
              <p className="bulk-excel-upload-hint">
                .xlsx, .xls 파일만 지원됩니다
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {/* 쿠팡엑셀 탭 내용 */}
        {activeTab === 'coupang' && (
          <div className="modal-content bulk-excel-content">
            <div className="bulk-excel-upload-area" onClick={handleCoupangFileSelect}>
              <div className="bulk-excel-upload-icon">📁</div>
              <p>{selectedCoupangFileName || 'Excel 파일을 선택하세요'}</p>
              <p className="bulk-excel-upload-hint">
                .xlsx, .xls 파일만 지원됩니다
              </p>
            </div>

            <input
              type="file"
              ref={coupangFileInputRef}
              accept=".xlsx,.xls"
              onChange={handleCoupangFileChange}
              style={{ display: 'none' }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AddOrderModal;
