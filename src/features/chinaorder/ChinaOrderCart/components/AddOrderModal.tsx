import React, { useState } from 'react';
import ActionButton from '../../../../components/ActionButton';
import { supabase } from '../../../../config/supabase';
import './AddOrderModal.css';

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  mode?: 'add' | 'backup' | 'edit'; // add: 주문 추가하기, backup: 주문 데이터베이스, edit: 수정
  title?: string; // 모달 타이틀 (선택적)
  editData?: any; // 수정할 데이터
}

type TabType = 'single' | 'bulk' | 'coupang';

const AddOrderModal: React.FC<AddOrderModalProps> = ({ isOpen, onClose, onSave, mode = 'add', title, editData }) => {
  // mode가 'backup'이면 'bulk' 탭으로 시작, 아니면 'single'
  const [activeTab, setActiveTab] = useState<TabType>(mode === 'backup' ? 'bulk' : 'single');
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
      linkUrl: '',
      remark: ''
    }
  ]);

  // editData가 변경될 때 폼 데이터 초기화
  React.useEffect(() => {
    if (mode === 'edit' && editData) {
      // editData가 배열인 경우 (여러 항목 수정)
      if (Array.isArray(editData)) {
        // 첫 번째 항목의 상품명 사용
        setProductName(editData[0]?.item_name || '');
        setOrderItems(editData.map((item, index) => ({
          id: index + 1,
          image: item.image_url || '',
          optionName: item.option_name || '',
          barcode: item.barcode || '',
          quantity: item.order_quantity || 0,
          chinaOption1: item.china_option1 || '',
          chinaOption2: item.china_option2 || '',
          unitPrice: item.china_price || '',
          imageUrl: item.image_url || '',
          linkUrl: item.china_link || '',
          remark: item.remark || ''
        })));
      } else {
        // 단일 항목 수정
        setProductName(editData.item_name || '');
        setOrderItems([{
          id: 1,
          image: editData.image_url || '',
          optionName: editData.option_name || '',
          barcode: editData.barcode || '',
          quantity: editData.order_quantity || 0,
          chinaOption1: editData.china_option1 || '',
          chinaOption2: editData.china_option2 || '',
          unitPrice: editData.china_price || '',
          imageUrl: editData.image_url || '',
          linkUrl: editData.china_link || '',
          remark: editData.remark || ''
        }]);
      }
    } else if (mode === 'add') {
      // add 모드일 때는 초기화
      setProductName('');
      setOrderItems([{
        id: 1,
        image: '',
        optionName: '',
        barcode: '',
        quantity: 0,
        chinaOption1: '',
        chinaOption2: '',
        unitPrice: '',
        imageUrl: '',
        linkUrl: '',
        remark: ''
      }]);
    }
  }, [mode, editData]);

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
        linkUrl: '',
        remark: ''
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
      // 단건 저장
      try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const userId = currentUser.id || currentUser.user_id;

        if (!userId) {
          alert('사용자 정보를 찾을 수 없습니다.');
          return;
        }

        // 데이터 검증
        if (!productName) {
          alert('등록상품명을 입력해주세요.');
          return;
        }

        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/googlesheets/add-single-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userId,
            productName: productName,
            orderItems: orderItems
          }),
        });

        const result = await response.json();

        if (result.success) {
          alert(`구글시트에 ${result.data.rows_count}개 주문이 저장되었습니다!`);
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
    import('xlsx').then((XLSX) => {
      const wb = XLSX.utils.book_new();

      const wsData = [
        ['주문날짜', '주문번호', '상품명', '옵션명', '수량', '바코드', '중국옵션 1', '중국옵션 2', '단가', '총금액', '이미지 url', '사이트 url']
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);

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

      // 스타일 적용 (A, B열 진한 회색, 나머지 헤더 연한 회색)
      const headerCells = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1', 'L1'];
      headerCells.forEach(cell => {
        if (!ws[cell]) ws[cell] = { t: 's', v: '' };

        // A1, B1은 진한 회색 (A9A9A9), 나머지는 연한 회색 (D3D3D3)
        const isDarkGray = cell === 'A1' || cell === 'B1';
        ws[cell].s = {
          fill: {
            patternType: 'solid',
            fgColor: { rgb: isDarkGray ? 'A9A9A9' : 'D3D3D3' }
          },
          font: {
            bold: true
          },
          alignment: {
            horizontal: 'center',
            vertical: 'center'
          }
        };
      });

      XLSX.utils.book_append_sheet(wb, ws, '신규');
      XLSX.writeFile(wb, '템플릿.xlsx', { cellStyles: true });
    });
  };

  const handleDownloadCoupangTemplate = () => {
    import('xlsx').then((XLSX) => {
      const wb = XLSX.utils.book_new();

      const wsData = [
        ['주문날짜', '주문번호', '상품명', '옵션명', '수량', '바코드', '중국옵션 1', '중국옵션 2', '단가', '총금액', '이미지 url', '사이트 url']
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // 열 너비 설정
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

      // 스타일 적용 (A, B열 진한 회색, 나머지 헤더 연한 회색)
      const headerCells = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1', 'L1'];
      headerCells.forEach(cell => {
        if (!ws[cell]) ws[cell] = { t: 's', v: '' };

        // A1, B1은 진한 회색 (A9A9A9), 나머지는 연한 회색 (D3D3D3)
        const isDarkGray = cell === 'A1' || cell === 'B1';
        ws[cell].s = {
          fill: {
            patternType: 'solid',
            fgColor: { rgb: isDarkGray ? 'A9A9A9' : 'D3D3D3' }
          },
          font: {
            bold: true
          },
          alignment: {
            horizontal: 'center',
            vertical: 'center'
          }
        };
      });

      XLSX.utils.book_append_sheet(wb, ws, '신규');
      XLSX.writeFile(wb, '템플릿.xlsx', { cellStyles: true });
    });
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setSelectedFileName(file.name);

    try {
      // 엑셀 파일 읽기
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      // '신규' 시트 읽기
      const worksheet = workbook.Sheets['신규'];
      if (!worksheet) {
        alert('엑셀 파일에 "신규" 시트가 없습니다.');
        return;
      }

      // 시트 데이터를 배열로 변환 (헤더 포함)
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // 1행(헤더) 제외하고 데이터만 추출
      const dataRows = jsonData.slice(1).filter((row: any) => {
        // 빈 행 제외 (모든 셀이 비어있는 행)
        return row && row.some((cell: any) => cell !== undefined && cell !== null && cell !== '');
      });

      if (dataRows.length === 0) {
        alert('엑셀 파일에 데이터가 없습니다.');
        return;
      }

      console.log('📊 엑셀 데이터 로드:', {
        total_rows: jsonData.length,
        data_rows: dataRows.length,
        sample: dataRows[0],
        '헤더(0행)': jsonData[0],
        '첫번째 데이터(1행)': dataRows[0],
        '각 열 값': {
          'A(0)': dataRows[0]?.[0],
          'B(1)': dataRows[0]?.[1],
          'C(2)-item_name': dataRows[0]?.[2],
          'D(3)-option_name': dataRows[0]?.[3],
          'E(4)-order_qty': dataRows[0]?.[4],
          'F(5)-barcode': dataRows[0]?.[5],
          'G(6)-china_option1': dataRows[0]?.[6],
          'H(7)-china_option2': dataRows[0]?.[7],
          'I(8)-china_price': dataRows[0]?.[8],
          'J(9)': dataRows[0]?.[9],
          'K(10)-img_url': dataRows[0]?.[10],
          'L(11)-china_link': dataRows[0]?.[11]
        }
      });

      // 사용자 확인
      const confirmed = window.confirm(`${dataRows.length}개 행을 Supabase에 저장하시겠습니까?`);
      if (!confirmed) return;

      // 현재 사용자 정보 가져오기
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id || currentUser.user_id;

      if (!userId) {
        alert('사용자 정보를 찾을 수 없습니다.');
        return;
      }

      // 엑셀 데이터를 Supabase 형식으로 변환
      const supabaseData = dataRows.map((row: any) => {
        const barcode = row[5] ? String(row[5]).trim() : null;

        return {
          user_id: userId,
          item_name: row[2] || null,        // C열
          option_name: row[3] || null,      // D열
          order_qty: row[4] || null,        // E열
          barcode: barcode,                 // F열 (Primary Key)
          china_option1: row[6] || null,    // G열
          china_option2: row[7] || null,    // H열
          china_price: row[8] || null,      // I열
          img_url: row[10] || null,         // K열
          china_link: row[11] || null       // L열
        };
      });

      // barcode가 없는 행이 있는지 확인
      const missingBarcodes = supabaseData.filter((item: any) => !item.barcode);
      if (missingBarcodes.length > 0) {
        alert(`바코드가 없는 행이 ${missingBarcodes.length}개 있습니다. 모든 행에 바코드(F열)가 필요합니다.`);
        return;
      }

      // 중복 barcode 제거 (같은 barcode는 마지막 행만 유지)
      const barcodeMap = new Map();
      supabaseData.forEach((item: any) => {
        barcodeMap.set(item.barcode, item);
      });
      const uniqueData = Array.from(barcodeMap.values());

      const duplicateCount = supabaseData.length - uniqueData.length;
      if (duplicateCount > 0) {
        const confirmed = window.confirm(
          `중복된 바코드가 ${duplicateCount}개 발견되었습니다.\n` +
          `중복 제거 후 ${uniqueData.length}개 데이터를 저장하시겠습니까?\n\n` +
          `(같은 바코드는 마지막 행만 저장됩니다)`
        );
        if (!confirmed) return;
      }

      console.log('💾 Supabase 저장 데이터:', {
        original: supabaseData.length,
        unique: uniqueData.length,
        duplicates: duplicateCount
      });

      // Supabase에 데이터 삽입 (upsert: 중복 barcode 시 업데이트)
      const { data: insertedData, error } = await supabase
        .from('chinaorder_googlesheet_DB')
        .upsert(uniqueData, { onConflict: 'barcode' })
        .select();

      if (error) {
        console.error('❌ Supabase 저장 오류:', error);
        console.error('오류 상세:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });

        // 중복 barcode 오류 처리
        if (error.code === '23505') {
          alert(`저장 실패: 이미 존재하는 바코드입니다.\n\n같은 바코드가 이미 데이터베이스에 있습니다. 바코드를 확인해주세요.`);
        } else {
          alert(`저장 실패: ${error.message}`);
        }
        return;
      }

      console.log('✅ Supabase 저장 성공:', insertedData);
      alert(`${dataRows.length}개 행이 성공적으로 저장되었습니다!`);
      setSelectedFileName('');
      onClose();

    } catch (error) {
      console.error('❌ 파일 처리 오류:', error);
      alert('파일 처리 중 오류가 발생했습니다.');
    }
  };

  const handleCoupangFileSelect = () => {
    coupangFileInputRef.current?.click();
  };

  const handleCoupangFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setSelectedCoupangFileName(file.name);

    try {
      // 엑셀 파일 읽기
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      // 첫 번째 시트 읽기 (쿠팡 엑셀은 보통 첫 시트 사용)
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      if (!worksheet) {
        alert('엑셀 파일에 시트가 없습니다.');
        return;
      }

      // 시트 데이터를 배열로 변환 (헤더 포함)
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // 1행(헤더) 제외하고 데이터만 추출
      const dataRows = jsonData.slice(1).filter((row: any) => {
        // 빈 행 제외 (모든 셀이 비어있는 행)
        return row && row.some((cell: any) => cell !== undefined && cell !== null && cell !== '');
      });

      if (dataRows.length === 0) {
        alert('엑셀 파일에 데이터가 없습니다.');
        return;
      }

      console.log('🛒 쿠팡 엑셀 데이터 로드:', {
        total_rows: jsonData.length,
        data_rows: dataRows.length,
        sample: dataRows[0]
      });

      // 사용자 확인
      const confirmed = window.confirm(`${dataRows.length}개 쿠팡 주문을 구글시트에 추가하시겠습니까?`);
      if (!confirmed) return;

      // 백엔드로 데이터 전송
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id || currentUser.user_id;

      if (!userId) {
        alert('사용자 정보를 찾을 수 없습니다.');
        return;
      }

      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/googlesheets/upload-coupang-excel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          excelData: dataRows
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`구글시트에 ${result.data.rows_count}개 쿠팡 주문이 저장되었습니다!`);
        setSelectedCoupangFileName('');
        onClose();
      } else {
        alert(`저장 실패: ${result.message}`);
      }

    } catch (error) {
      console.error('쿠팡 파일 처리 오류:', error);
      alert('파일 처리 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* 상단 버튼 영역 */}
        <div className="modal-header">
          {/* 모달 타이틀 */}
          {mode === 'add' && (
            <div style={{ fontSize: '22px', fontWeight: 600, color: '#333' }}>
              주문 추가하기
            </div>
          )}
          {mode === 'backup' && (
            <div style={{ fontSize: '22px', fontWeight: 600, color: '#333' }}>
              백업할 주문 엑셀 추가
            </div>
          )}
          {mode === 'edit' && (
            <div style={{ fontSize: '22px', fontWeight: 600, color: '#333' }}>
              수정
            </div>
          )}
          <div className="modal-header-buttons">
            <ActionButton variant="default" onClick={onClose} className="cancel-button">
              취소
            </ActionButton>
            <ActionButton variant="success" onClick={handleSave}>
              저장
            </ActionButton>
          </div>
        </div>

        {/* 탭 버튼 영역 - mode가 'add'일 때만 모든 탭 표시, 'backup'이면 대량엑셀만, 'edit'이면 탭 숨김 */}
        {mode === 'add' ? (
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
        ) : mode === 'backup' ? (
          <div className="modal-tabs">
            <button
              className={`modal-tab active`}
              onClick={() => setActiveTab('bulk')}
            >
              대량엑셀
            </button>
          </div>
        ) : null}

        {/* 단건 탭 내용 - edit 모드일 때도 표시 */}
        {(activeTab === 'single' || mode === 'edit') && (
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
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.setAttribute('style', 'display: flex');
                          }}
                        />
                      ) : null}
                      <div
                        className="image-placeholder"
                        style={{ display: item.imageUrl ? 'none' : 'flex' }}
                      >
                        이미지
                      </div>
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

                    {/* 비고 */}
                    <input
                      type="text"
                      className="order-item-input-full"
                      placeholder="비고"
                      value={item.remark}
                      onChange={(e) => handleItemChange(item.id, 'remark', e.target.value)}
                    />
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
