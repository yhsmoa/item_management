import React, { useState, useRef, useEffect } from 'react';
import './CoupangOrders.css';
import { processPersonalOrderExcelUpload } from '../../services/excelUploadService';
import { supabase } from '../../config/supabase';
import * as XLSX from 'xlsx';

/**
 * 쿠팡 주문 데이터 타입
 */
interface CoupangOrderData {
  id: string;
  order_number: string;
  product_id: string;
  option_id: string;
  separate_shipping: string;
  order_date: string;
  order_expected_shipping_date: string;
  item_name: string;
  option_name: string;
  qty: number;
  recipient_name: string;
  recipient_phone: string;
  postal_code: string;
  recipient_address: string;
  delivery_message: string;
  user_id: string;
  // 엑셀 다운로드용 전체 필드들
  number?: string;
  bundle_shipping_number?: string;
  delivery_company?: string;
  tracking_number?: string;
  separate_shipping_expected_date?: string;
  shipping_date?: string;
  product_name?: string;
  initial_registered_product_option?: string;
  vendor_product_code?: string;
  barcode?: string;
  payment_amount?: number;
  shipping_fee_type?: string;
  shipping_fee?: number;
  remote_area_additional_fee?: string;
  option_sale_price?: number;
  buyer?: string;
  buyer_phone?: string;
  product_additional_message?: string;
  orderer_additional_message?: string;
  delivery_completion_date?: string;
  purchase_confirmation_date?: string;
  PCCC?: string;
  customs_recipient_phone?: string;
  etc?: string;
  payment_location?: string;
  delivery_type?: string;
}

/**
 * 현재 로그인한 사용자 ID를 가져오는 함수
 */
function getCurrentUserId(): string | null {
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return currentUser.id || currentUser.user_id || null;
  } catch (error) {
    return null;
  }
}

/**
 * 날짜 포맷팅 함수 (YYYY-MM-DD HH:MM:SS+00 -> YYYY-MM-DD)
 */
function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD 형태로 변환
  } catch (error) {
    return dateString.split(' ')[0] || dateString.split('T')[0] || dateString;
  }
}

/**
 * 쿠팡 주문 관리 페이지
 * - 쿠팡에서 들어온 주문들을 관리하는 페이지
 */
const CoupangOrders: React.FC = () => {
  // State 정의
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchCategory, setSearchCategory] = useState('등록상품명');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [orderData, setOrderData] = useState<CoupangOrderData[]>([]);
  const [filteredOrderData, setFilteredOrderData] = useState<CoupangOrderData[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ stage: '', current: 0, total: 100 });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<CoupangOrderData | null>(null);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 데이터 로드 함수
  const loadOrderData = async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      console.error('사용자 ID를 찾을 수 없습니다.');
      return;
    }

    setIsLoading(true);
    try {
      // Supabase 1000개 제한을 해제하고 모든 데이터 가져오기
      const { data, error } = await supabase
        .from('coupang_personal_order')
        .select('*')
        .eq('user_id', userId)
        .order('order_date', { ascending: false });

      if (error) {
        console.error('데이터 로드 실패:', error);
        alert('주문 데이터를 불러오는데 실패했습니다.');
        return;
      }

      setOrderData(data || []);
      setFilteredOrderData(data || []);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
      alert('주문 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadOrderData();
  }, []);

  // 수취인 정보 모달 열기
  const handleRecipientClick = (order: CoupangOrderData) => {
    setSelectedRecipient(order);
    setShowRecipientModal(true);
  };
  
  // 검색 핸들러
  const handleSearch = () => {
    if (!searchKeyword.trim()) {
      setFilteredOrderData(orderData);
      return;
    }

    const filtered = orderData.filter(order => {
      const keyword = searchKeyword.toLowerCase().trim();
      switch (searchCategory) {
        case '등록상품명':
          return order.item_name.toLowerCase().includes(keyword);
        case '주문번호':
          return order.order_number.toLowerCase().includes(keyword);
        case '수취인정보':
          return order.recipient_name.toLowerCase().includes(keyword);
        default:
          return false;
      }
    });

    setFilteredOrderData(filtered);
  };

  // xlsx 다운로드 핸들러
  const handleXlsxDownload = () => {
    // 체크된 데이터가 있으면 체크된 데이터만, 없으면 전체 데이터
    let dataToDownload = filteredOrderData;
    if (selectedOrders.size > 0) {
      dataToDownload = filteredOrderData.filter(order => selectedOrders.has(order.id));
    }

    if (dataToDownload.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    try {
      // 컬럼 헤더를 A~AN 순서로 정의
      const headers = [
        '번호', // A
        '묶음배송번호', // B
        '주문번호', // C
        '택배사', // D
        '운송장번호', // E
        '분리배송 Y/N', // F
        '분리배송 출고예정일', // G
        '주문시 출고예정일', // H
        '출고일(발송일)', // I
        '주문일', // J
        '등록상품명', // K
        '등록옵션명', // L
        '노출상품명(옵션명)', // M
        '노출상품ID', // N
        '옵션ID', // O
        '최초등록등록상품명/옵션명', // P
        '업체상품코드', // Q
        '바코드', // R
        '결제액', // S
        '배송비구분', // T
        '배송비', // U
        '도서산간 추가배송비', // V
        '구매수(수량)', // W
        '옵션판매가(판매단가)', // X
        '구매자', // Y
        '구매자전화번호', // Z
        '수취인이름', // AA
        '수취인전화번호', // AB
        '우편번호', // AC
        '수취인 주소', // AD
        '배송메세지', // AE
        '상품별 추가메시지', // AF
        '주문자 추가메시지', // AG
        '배송완료일', // AH
        '구매확정일자', // AI
        '개인통관번호(PCCC)', // AJ
        '통관용수취인전화번호', // AK
        '기타', // AL
        '결제위치', // AM
        '배송유형' // AN
      ];

      // 데이터 준비 (각 행마다 A~AN 컬럼 순서대로)
      const excelData = dataToDownload.map(order => [
        order.number || '', // A
        order.bundle_shipping_number || '', // B
        order.order_number || '', // C
        order.delivery_company || '', // D
        order.tracking_number || '', // E
        order.separate_shipping || '', // F
        order.separate_shipping_expected_date || '', // G
        order.order_expected_shipping_date || '', // H
        order.shipping_date || '', // I
        order.order_date || '', // J
        order.item_name || '', // K
        order.option_name || '', // L
        order.product_name || '', // M
        order.product_id || '', // N
        order.option_id || '', // O
        order.initial_registered_product_option || '', // P
        order.vendor_product_code || '', // Q
        order.barcode || '', // R
        order.payment_amount || '', // S
        order.shipping_fee_type || '', // T
        order.shipping_fee || '', // U
        order.remote_area_additional_fee || '', // V
        order.qty || 0, // W
        order.option_sale_price || '', // X
        order.buyer || '', // Y
        order.buyer_phone || '', // Z
        order.recipient_name || '', // AA
        order.recipient_phone || '', // AB
        order.postal_code || '', // AC
        order.recipient_address || '', // AD
        order.delivery_message || '', // AE
        order.product_additional_message || '', // AF
        order.orderer_additional_message || '', // AG
        order.delivery_completion_date || '', // AH
        order.purchase_confirmation_date || '', // AI
        order.PCCC || '', // AJ
        order.customs_recipient_phone || '', // AK
        order.etc || '', // AL
        order.payment_location || '', // AM
        order.delivery_type || '' // AN
      ]);

      // 헤더를 첫 번째 행으로 추가
      const worksheetData = [headers, ...excelData];

      // 워크시트 생성
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // 헤더 행에 회색 배경 스타일 적용
      const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellAddress]) ws[cellAddress] = { v: '', t: 's' };
        
        ws[cellAddress].s = {
          fill: {
            fgColor: { rgb: "D3D3D3" } // 회색 배경
          }
        };
      }
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

      // 파일명 생성 (deliveryList_YYYY-MM-DD-HH-MM-SS)
      const now = new Date();
      const fileName = `deliveryList_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}.xlsx`;
      
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('다운로드 실패:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 체크박스 핸들러
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredOrderData.map(order => order.id));
      setSelectedOrders(allIds);
    } else {
      setSelectedOrders(new Set());
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const newSelected = new Set(selectedOrders);
    if (checked) {
      newSelected.add(orderId);
    } else {
      newSelected.delete(orderId);
    }
    setSelectedOrders(newSelected);
  };

  // 바코드 조회 핸들러 (추후 구현)
  const handleBarcodeSearch = () => {
    // 기능은 추후에 구현
    console.log('바코드 조회 버튼 클릭');
  };

  // Excel 업로드 핸들러
  const handleXlsxUpload = () => {
    setShowUploadModal(true);
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 확장자 검증
    const allowedExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      alert('Excel 파일(.xlsx, .xls)만 업로드 가능합니다.');
      return;
    }

    setIsUploading(true);
    setUploadProgress({ stage: '업로드 시작...', current: 0, total: 100 });

    try {
      const result = await processPersonalOrderExcelUpload(file, (stage, current, total) => {
        setUploadProgress({ stage, current: current || 0, total: total || 100 });
      });

      if (result.success) {
        alert(`업로드 완료! ${result.processedCount}개의 주문 데이터가 저장되었습니다.`);
        setShowUploadModal(false);
        // 주문 데이터를 다시 로드
        await loadOrderData();
      } else {
        alert(`업로드 실패: ${result.error}`);
      }
    } catch (error) {
      alert(`업로드 중 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsUploading(false);
      setUploadProgress({ stage: '', current: 0, total: 100 });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  return (
    <div className="coupang-orders-container">
      {/* 페이지 헤더 */}
      <div className="coupang-orders-page-header">
        <h1 className="coupang-orders-page-title">쿠팡 주문 관리</h1>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
          <button 
            className="coupang-orders-button coupang-orders-button-secondary"
            onClick={handleXlsxDownload}
            disabled={isUploading || isLoading}
          >
            xlsx 다운로드
          </button>
          <button 
            className="coupang-orders-button coupang-orders-button-primary"
            onClick={handleXlsxUpload}
            disabled={isUploading}
          >
            {isUploading ? '업로드 중...' : 'xlsx 업로드'}
          </button>
        </div>
      </div>

      {/* 검색 섹션 */}
      <div className="coupang-orders-filter-section">
        <div className="coupang-orders-search-container">
          <label className="coupang-orders-label">검색</label>
          <div className="coupang-orders-search-wrapper">
            <select
              value={searchCategory}
              onChange={(e) => setSearchCategory(e.target.value)}
              className="coupang-orders-search-select"
            >
              <option value="등록상품명">등록상품명</option>
              <option value="주문번호">주문번호</option>
              <option value="수취인정보">수취인정보</option>
            </select>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="검색어를 입력하세요..."
              className="coupang-orders-search-input"
            />
            <button 
              onClick={handleSearch}
              className="coupang-orders-search-button"
            >
              🔍
            </button>
          </div>
        </div>
      </div>

      {/* 바코드 조회 섹션 */}
      <div className="coupang-orders-barcode-section">
        <button 
          className="coupang-orders-button coupang-orders-button-secondary"
          onClick={handleBarcodeSearch}
        >
          바코드 조회
        </button>
      </div>

      {/* 데이터 테이블 */}
      <div className="coupang-orders-table-section">
        {/* 테이블 헤더 */}
        <div className="coupang-orders-table-header-section">
          <div className="coupang-orders-table-info">
            <div className="coupang-orders-data-count">
              총 {filteredOrderData.length}개 주문
            </div>
          </div>
        </div>

        {/* 테이블 컨테이너 */}
        <div className="coupang-orders-table-container">
          <table className="coupang-orders-table">
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedOrders.size === filteredOrderData.length && filteredOrderData.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th style={{ width: '120px', textAlign: 'center' }}>주문번호</th>
                <th style={{ width: '100px', textAlign: 'center' }}>분리배송</th>
                <th style={{ width: '120px', textAlign: 'center' }}>출고예정일</th>
                <th style={{ width: '300px', textAlign: 'left' }}>등록상품명 & 옵션명</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Id</th>
                <th style={{ width: '80px', textAlign: 'center' }}>주문개수</th>
                <th style={{ width: '200px', textAlign: 'center' }}>수취인정보</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ 
                    textAlign: 'center', 
                    padding: '40px', 
                    color: '#666',
                    fontSize: '16px' 
                  }}>
                    데이터를 불러오는 중...
                  </td>
                </tr>
              ) : filteredOrderData.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ 
                    textAlign: 'center', 
                    padding: '40px', 
                    color: '#666',
                    fontSize: '16px' 
                  }}>
                    {searchKeyword ? '검색 결과가 없습니다.' : '주문 데이터가 없습니다.'}
                  </td>
                </tr>
              ) : (
                filteredOrderData.map((order, index) => (
                  <tr key={order.id || index}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedOrders.has(order.id)}
                        onChange={(e) => handleSelectOrder(order.id, e.target.checked)}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {order.order_number}<br/>
                      {order.product_id}<br/>
                      {order.option_id}
                    </td>
                    <td style={{ textAlign: 'center' }}>{order.separate_shipping}</td>
                    <td style={{ textAlign: 'center' }}>
                      {formatDate(order.order_date)}<br/>
                      {order.order_expected_shipping_date}
                    </td>
                    <td style={{ textAlign: 'left' }}>
                      {order.item_name}<br/>
                      {order.option_name}
                    </td>
                    <td style={{ textAlign: 'center' }}>{order.barcode || ''}</td>
                    <td style={{ textAlign: 'center' }}>{order.qty}</td>
                    <td 
                      style={{ 
                        textAlign: 'center', 
                        cursor: 'pointer', 
                        color: '#000000'
                      }}
                      onClick={() => handleRecipientClick(order)}
                    >
                      {order.recipient_name}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Excel 업로드 모달 */}
      {showUploadModal && (
        <div className="coupang-orders-modal-overlay" onClick={() => !isUploading && setShowUploadModal(false)}>
          <div className="coupang-orders-modal" onClick={(e) => e.stopPropagation()}>
            <div className="coupang-orders-modal-header">
              <h3>쿠팡 주문 Excel 업로드</h3>
              {!isUploading && (
                <button 
                  className="coupang-orders-modal-close"
                  onClick={() => setShowUploadModal(false)}
                >
                  ×
                </button>
              )}
            </div>
            
            <div className="coupang-orders-modal-content">
              {!isUploading ? (
                <>
                  <div className="coupang-orders-upload-area" onClick={handleFileSelect}>
                    <div className="coupang-orders-upload-icon">📁</div>
                    <p>Excel 파일을 선택하세요</p>
                    <p className="coupang-orders-upload-hint">
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
                </>
              ) : (
                <div className="coupang-orders-upload-progress">
                  <div className="coupang-orders-progress-info">
                    <p>{uploadProgress.stage}</p>
                    <div className="coupang-orders-progress-bar">
                      <div 
                        className="coupang-orders-progress-fill"
                        style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                      ></div>
                    </div>
                    <p>{uploadProgress.current}% 완료</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 수취인 정보 모달 */}
      {showRecipientModal && selectedRecipient && (
        <div className="coupang-orders-modal-overlay" onClick={() => setShowRecipientModal(false)}>
          <div className="coupang-orders-modal coupang-orders-recipient-modal" onClick={(e) => e.stopPropagation()}>
            <div className="coupang-orders-modal-header">
              <h3>수취인 정보</h3>
              <button 
                className="coupang-orders-modal-close"
                onClick={() => setShowRecipientModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="coupang-orders-modal-content">
              <div className="coupang-orders-recipient-info">
                <div className="coupang-orders-recipient-field">
                  <label>수취인명:</label>
                  <span>{selectedRecipient.recipient_name}</span>
                </div>
                <div className="coupang-orders-recipient-field">
                  <label>연락처:</label>
                  <span>{selectedRecipient.recipient_phone}</span>
                </div>
                <div className="coupang-orders-recipient-field">
                  <label>우편번호:</label>
                  <span>{selectedRecipient.postal_code}</span>
                </div>
                <div className="coupang-orders-recipient-field">
                  <label>주소:</label>
                  <span>{selectedRecipient.recipient_address}</span>
                </div>
                <div className="coupang-orders-recipient-field">
                  <label>배송메시지:</label>
                  <span>{selectedRecipient.delivery_message}</span>
                </div>
              </div>
              
              <div className="coupang-orders-recipient-actions">
                <button 
                  className="coupang-orders-button coupang-orders-button-secondary"
                  onClick={() => setShowRecipientModal(false)}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoupangOrders; 