import React, { useState, useEffect, useRef } from 'react';
import DashboardStatsCard from '../products/components/DashboardStatsCard';
import ActionButton from '../../components/ActionButton';
import { supabase } from '../../config/supabase';
import './ChinaorderCart.css';

// 임시 인터페이스 정의 (ChinaOrderData와 동일한 구조)
interface ChinaOrderData {
  china_order_number?: string;
  date?: string;
  item_name?: string;
  option_name?: string;
  barcode?: string;
  order_quantity?: number;
  image_url?: string;
  china_link?: string;
  china_option1?: string;
  china_option2?: string;
  china_price?: string;
  china_total_price?: string;
  order_status_ordering?: string;
  order_status_check?: string;
  order_status_cancel?: string;
  order_status_shipment?: string;
  remark?: string;
  confirm_order_id?: string;
  confirm_shipment_id?: string;
  option_id?: string;
}

// 인터페이스 정의
interface TableRow extends ChinaOrderData {
  type: 'order';
  id: string;
}

interface Stats {
  total: number;
  notItemPartner: number;
  outOfStock: number;
  rejected: number;
  selling: number;
  tempSave: number;
}

function ChinaorderCart() {
  // State 정의
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedExposure, setSelectedExposure] = useState('전체');
  const [selectedSaleStatus, setSelectedSaleStatus] = useState('전체');
  const [sortFilter, setSortFilter] = useState('전체');
  
  // 테이블 관련
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false);
  
  // 📝 중복 로딩 방지를 위한 ref
  const loadingRef = useRef(false);
  const initialLoadRef = useRef(false);
  
  // 주문 데이터 - 빈 배열로 초기화 (다른 DB와 연동 예정)
  const [orderData, setOrderData] = useState<ChinaOrderData[]>([]);
  const [filteredOrderData, setFilteredOrderData] = useState<ChinaOrderData[]>([]);

  // 🆕 입력 행 상태 관리
  const [showInputRow, setShowInputRow] = useState(false);
  const [inputData, setInputData] = useState<ChinaOrderData>({
    option_id: '',
    item_name: '',
    option_name: '',
    barcode: '',
    order_quantity: 0,
    china_option1: '',
    china_option2: '',
    china_price: '',
    china_total_price: '',
    remark: '',
    china_link: '',
    image_url: ''
  });

  // 🆕 인라인 편집 상태 관리
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // 컴포넌트 마운트 시 데이터 로드 (한 번만 실행)
  useEffect(() => {
    console.log('🔄 ChinaorderCart 컴포넌트 마운트됨');
    
    // 이미 초기 로드가 완료되었으면 건너뛰기
    if (initialLoadRef.current) {
      console.log('⚠️ 이미 초기 로드가 완료되었으므로 건너뜁니다.');
      return;
    }
    
    initialLoadRef.current = true;
    console.log('🚀 첫 번째 데이터 로드 시작');
    loadOrderData();
    
    // 🧹 cleanup 함수: 컴포넌트 언마운트 시 메모리 정리
    return () => {
      console.log('🧹 ChinaorderCart 컴포넌트 언마운트 - 메모리 정리 중...');
      
      // 대용량 상태 데이터 초기화 (메모리 절약)
      setOrderData([]);
      setFilteredOrderData([]);
      setSelectedItems([]);
      setIsLoading(false);
      setSelectAll(false);
      
      console.log('✅ ChinaorderCart 메모리 정리 완료');
    };
  }, []); // 빈 의존성 배열로 한 번만 실행

  // 🔍 테이블 헤더와 열 너비 측정
  useEffect(() => {
    const measureTableColumns = () => {
      // 테이블이 렌더링될 때까지 잠시 대기
      setTimeout(() => {
        const table = document.querySelector('.product-list-table');
        if (!table) {
          console.log('❌ 테이블을 찾을 수 없습니다.');
          return;
        }

        console.log('📏 ========== 테이블 헤더 및 열 너비 측정 ==========');
        
        // 헤더 셀들 측정
        const headerCells = table.querySelectorAll('thead th.product-list-table-header-cell');
        console.log('📋 총 헤더 개수:', headerCells.length);
        
        headerCells.forEach((cell, index) => {
          const rect = cell.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(cell);
          const textContent = cell.textContent?.trim() || '';
          
          console.log(`📍 헤더 ${index + 1}번째:`, {
            텍스트: textContent,
            너비: `${rect.width.toFixed(1)}px`,
            CSS_width: computedStyle.width,
            CSS_minWidth: computedStyle.minWidth,
            CSS_maxWidth: computedStyle.maxWidth,
            실제_렌더링_너비: `${rect.width}px`
          });
        });

        // 첫 번째 데이터 행의 셀들도 측정 (실제 데이터 셀 크기)
        const firstDataRow = table.querySelector('tbody tr:first-child');
        if (firstDataRow) {
          console.log('📋 ========== 첫 번째 데이터 행 셀 측정 ==========');
          const dataCells = firstDataRow.querySelectorAll('td.product-list-table-cell');
          
          dataCells.forEach((cell, index) => {
            const rect = cell.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(cell);
            
            console.log(`📍 데이터셀 ${index + 1}번째:`, {
              너비: `${rect.width.toFixed(1)}px`,
              CSS_width: computedStyle.width,
              내용_미리보기: cell.textContent?.trim().substring(0, 20) + '...',
              실제_렌더링_너비: `${rect.width}px`
            });
          });
        }

        // 전체 테이블 정보
        const tableRect = table.getBoundingClientRect();
        console.log('📊 ========== 테이블 전체 정보 ==========');
        console.log('전체 테이블 너비:', `${tableRect.width.toFixed(1)}px`);
        console.log('테이블 layout:', window.getComputedStyle(table).tableLayout);
        
        console.log('📏 ========== 측정 완료 ==========');
      }, 1000); // 1초 후 측정 (테이블 렌더링 완료 대기)
    };

    // 데이터가 로드되고 테이블이 렌더링된 후 측정
    if (filteredOrderData.length > 0 && !isLoading) {
      measureTableColumns();
    }
  }, [filteredOrderData, isLoading]); // 데이터가 변경되거나 로딩이 완료될 때 측정

  // 📥 주문 데이터 로드 - chinaorder_cart 테이블에서 데이터 가져오기
  const loadOrderData = async () => {
    // useRef로 중복 호출 방지
    if (loadingRef.current) {
      console.log('⚠️ 이미 로딩 중이므로 중복 호출을 방지합니다.');
      return;
    }

    try {
      loadingRef.current = true;
      setIsLoading(true);
      
      // 실제 로그인한 사용자 ID 가져오기
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        console.log('👤 사용자 ID가 없어 데이터를 로드하지 않습니다.');
        setOrderData([]);
        setFilteredOrderData([]);
        return;
      }

      console.log('📥 주문 데이터 로드 시작 - 사용자 ID:', currentUserId);

      // chinaorder_cart 테이블에서 현재 사용자의 데이터 조회
      const { data, error } = await supabase
        .from('chinaorder_cart')
        .select('*')
        .eq('user_id', currentUserId);

      if (error) {
        console.error('❌ 주문 데이터 로드 오류:', error);
        throw error;
      }

      console.log('✅ 주문 데이터 로드 완료:', data?.length || 0, '개');
              console.log('📋 원본 데이터:', data);
        
        // 📋 DB 컬럼명을 인터페이스에 맞게 변환 - option_id만 우선 표시
        const transformedData = data?.map(item => ({
          option_id: item.option_id || '', // 옵션ID만 확실히 표시
          item_name: item.item_name || '',
          option_name: item.option_name || '',
          barcode: item.barcode || '',
          order_quantity: item.quantity || 0,
          china_option1: item.china_option1 || '',
          china_option2: item.china_option2 || '',
          china_price: item.china_price || '',
          china_total_price: item.china_total_price || '',
          china_link: item.china_link || '',
          image_url: item.image_url || '', // DB의 image_url 필드 직접 사용
          remark: item.composition || '', // DB: composition → Interface: remark
          // 추가 필드들
          china_order_number: item.china_order_number || '',
          date: item.date || ''
        })) || [];

        // 🔄 중복 데이터 제거 (option_id 기준)
        const uniqueData = transformedData.filter((item, index, self) => 
          index === self.findIndex(t => t.option_id === item.option_id)
        );

        console.log('📥 변환된 데이터:', transformedData);
        console.log('🔄 중복 제거된 데이터:', uniqueData);
                console.log('📊 원본 데이터 수:', transformedData.length, '중복 제거 후:', uniqueData.length); // 디버깅용
        
        // 🔄 데이터 완전 교체 (기존 데이터 초기화 후 새 데이터 설정)
        console.log('🔄 기존 데이터 초기화 후 새 데이터 설정');
        setOrderData([]);
        setFilteredOrderData([]);
        
        setTimeout(() => {
          setOrderData(uniqueData);
          setFilteredOrderData(uniqueData);
          console.log('✅ 새 데이터 설정 완료:', uniqueData.length, '개');
        }, 100);

    } catch (error) {
      console.error('❌ 주문 데이터 로드 예외:', error);
      setOrderData([]);
      setFilteredOrderData([]);
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  };

  // 통계 계산
  const stats: Stats = {
    total: filteredOrderData.length,
    notItemPartner: 0,
    outOfStock: 0,
    rejected: 0,
    selling: 0,
    tempSave: 0
  };

  // 데이터를 테이블 행으로 변환
  const transformDataToTableRows = (data: ChinaOrderData[]): TableRow[] => {
    return data.map((order, index) => {
      // 고유한 ID 생성: 주문번호를 기본으로 사용
      const uniqueId = `${order.china_order_number || `order-${currentPage}-${index}`}-${order.option_id || index}`;
      
      return {
        ...order,
        type: 'order' as const,
        id: uniqueId
      };
    });
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      setFilteredOrderData(orderData);
      setCurrentPage(1);
      setSelectedItems([]);
      setSelectAll(false);
      return;
    }

    // 정확한 문자열 매칭을 위해 toLowerCase()를 사용한 포함 검색
    const searchLower = searchKeyword.toLowerCase().trim();
    const filtered = orderData.filter(order => 
      order.china_order_number?.toLowerCase().includes(searchLower) ||
      order.item_name?.toLowerCase().includes(searchLower) ||
      order.option_name?.toLowerCase().includes(searchLower) ||
      order.barcode?.toLowerCase().includes(searchLower)
    );
    
    setFilteredOrderData(filtered);
    setCurrentPage(1);
    // 검색 시 선택된 항목들 초기화
    setSelectedItems([]);
    setSelectAll(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelectAll = () => {
    setSelectAll(!selectAll);
    if (!selectAll) {
      const currentTableRows = transformDataToTableRows(getCurrentPageData());
      setSelectedItems(currentTableRows.map(row => row.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (uniqueId: string) => {
    if (selectedItems.includes(uniqueId)) {
      setSelectedItems(selectedItems.filter(id => id !== uniqueId));
      setSelectAll(false);
    } else {
      setSelectedItems([...selectedItems, uniqueId]);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // 페이지 변경 시 선택된 항목들 초기화
    setSelectedItems([]);
    setSelectAll(false);
  };

  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredOrderData.slice(startIndex, endIndex);
  };

  // 현재 사용자 ID 가져오기
  const getCurrentUserId = () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      console.log('👤 localStorage에서 가져온 사용자 정보:', currentUser);
      console.log('👤 사용자 ID:', currentUser.id);
      return currentUser.id || null;
    } catch (error) {
      console.error('❌ 사용자 정보 읽기 오류:', error);
      return null;
    }
  };

  // 🔧 액션 버튼 핸들러들
  const handleAddOrder = () => {
    console.log('🛒 주문 추가하기 버튼 클릭');
    setShowInputRow(!showInputRow);
    
    // 입력 행이 열릴 때 데이터 초기화
    if (!showInputRow) {
      setInputData({
        option_id: '',
        item_name: '',
        option_name: '',
        barcode: '',
        order_quantity: 0,
        china_option1: '',
        china_option2: '',
        china_price: '',
        china_total_price: '',
        remark: '',
        china_link: '',
        image_url: ''
      });
    }
  };

  const handleLoadInfo = async () => {
    console.log('📥 정보 불러오기 버튼 클릭');
    setIsLoading(true);
    
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        alert('로그인이 필요합니다.');
        return;
      }

      // 1. chinaorder_cart에서 현재 사용자의 모든 데이터 가져오기
      const { data: cartData, error: cartError } = await supabase
        .from('chinaorder_cart')
        .select('*')
        .eq('user_id', currentUserId);

      if (cartError) {
        console.error('❌ 카트 데이터 조회 오류:', cartError);
        throw cartError;
      }

      if (!cartData || cartData.length === 0) {
        console.log('📝 업데이트할 카트 데이터가 없습니다.');
        return;
      }

      console.log(`📊 ${cartData.length}개의 카트 데이터를 처리합니다.`);
      let updatedCount = 0;

      // 2. 각 카트 항목의 barcode로 chinaorder_records에서 최신 정보 검색
      for (const cartItem of cartData) {
        if (!cartItem.barcode) {
          console.log(`⚠️ 바코드가 없는 항목 건너뛰기: ${cartItem.option_id}`);
          continue;
        }

        // chinaorder_records에서 해당 barcode로 검색 (china_order_number 역순)
        const { data: recordsData, error: recordsError } = await supabase
          .from('chinaorder_records')
          .select('image_url, composition, china_option1, china_option2, china_price, remark, china_link')
          .eq('barcode', cartItem.barcode)
          .order('china_order_number', { ascending: false })
          .limit(1); // 가장 최신 데이터 1개만

        if (recordsError) {
          console.error(`❌ 레코드 검색 오류 (barcode: ${cartItem.barcode}):`, recordsError);
          continue;
        }

        if (!recordsData || recordsData.length === 0) {
          console.log(`🔍 barcode ${cartItem.barcode}에 대한 레코드를 찾을 수 없습니다.`);
          continue;
        }

        const latestRecord = recordsData[0];
        
        // 3. china_total_price 계산 (china_price * quantity)
        const chinaPriceNum = parseFloat(latestRecord.china_price || '0');
        const quantity = cartItem.quantity || 0;
        const calculatedTotalPrice = chinaPriceNum * quantity;

        // 4. 카트 데이터 업데이트
        const updateData = {
          image_url: latestRecord.image_url || cartItem.image_url || '',
          composition: latestRecord.composition || cartItem.composition || '', // DB 컬럼명
          china_option1: latestRecord.china_option1 || cartItem.china_option1 || '',
          china_option2: latestRecord.china_option2 || cartItem.china_option2 || '',
          china_price: latestRecord.china_price || cartItem.china_price || '',
          china_total_price: calculatedTotalPrice.toString(),
          china_link: latestRecord.china_link || cartItem.china_link || ''
        };

        const { error: updateError } = await supabase
          .from('chinaorder_cart')
          .update(updateData)
          .eq('user_id', currentUserId)
          .eq('option_id', cartItem.option_id)
          .eq('date', cartItem.date);

        if (updateError) {
          console.error(`❌ 업데이트 오류 (option_id: ${cartItem.option_id}):`, updateError);
          continue;
        }

        updatedCount++;
        console.log(`✅ 업데이트 완료: ${cartItem.option_id} (barcode: ${cartItem.barcode})`);
      }

      console.log(`🎉 정보 불러오기 완료: ${updatedCount}개 항목 업데이트`);
      
      // 5. 업데이트된 데이터 다시 로드
      await loadOrderData();
      
      if (updatedCount > 0) {
        alert(`${updatedCount}개 항목의 정보가 업데이트되었습니다.`);
      } else {
        alert('업데이트할 정보가 없습니다.');
      }

    } catch (error) {
      console.error('❌ 정보 불러오기 실패:', error);
      alert('정보 불러오기에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    console.log('🗑️ 삭제 버튼 클릭');
    console.log('선택된 항목들:', selectedItems);
    
    if (selectedItems.length === 0) {
      alert('삭제할 항목을 선택해주세요.');
      return;
    }

    // 삭제 확인 다이얼로그
    const isConfirmed = window.confirm(`선택한 ${selectedItems.length}개 항목을 삭제하시겠습니까?`);
    if (!isConfirmed) return;

    try {
      setIsLoading(true);
      console.log('🔥 삭제 실행 시작');

      // 선택된 항목들의 option_id 추출
      const optionIdsToDelete = selectedItems.map(itemId => {
        const row = currentTableRows.find(r => r.id === itemId);
        return row?.option_id;
      }).filter(Boolean);

      console.log('삭제할 옵션ID들:', optionIdsToDelete);

      // DB에서 삭제
      const { error } = await supabase
        .from('chinaorder_cart')
        .delete()
        .in('option_id', optionIdsToDelete);

      if (error) {
        throw error;
      }

      console.log('✅ DB 삭제 완료');

      // 로컬 상태에서도 제거
      setOrderData(prevData => 
        prevData.filter(item => !optionIdsToDelete.includes(item.option_id))
      );
      
      setFilteredOrderData(prevData => 
        prevData.filter(item => !optionIdsToDelete.includes(item.option_id))
      );

      // 선택 상태 초기화
      setSelectedItems([]);
      setSelectAll(false);

      console.log('✅ 삭제 완료:', optionIdsToDelete.length, '개 항목');
      alert(`${optionIdsToDelete.length}개 항목이 삭제되었습니다.`);

    } catch (error) {
      console.error('❌ 삭제 실패:', error);
      alert('삭제에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔄 입력 데이터 업데이트 핸들러
  const handleInputChange = (field: keyof ChinaOrderData, value: string | number) => {
    setInputData(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      
      // china_price나 order_quantity가 변경되면 china_total_price 자동 계산
      if (field === 'china_price' || field === 'order_quantity') {
        const priceNum = parseFloat(String(field === 'china_price' ? value : updated.china_price || 0));
        const quantityNum = Number(field === 'order_quantity' ? value : updated.order_quantity || 0);
        const totalPrice = priceNum * quantityNum;
        updated.china_total_price = totalPrice > 0 ? totalPrice.toString() : '';
      }
      
      return updated;
    });
  };

  // 💾 UPSERT 저장 로직 - 올바른 DB 컬럼명으로 매핑
  const handleSaveInputData = async () => {
    try {
      setIsLoading(true);
      
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        alert('로그인이 필요합니다.');
        return;
      }

      // 필수 필드 검증
      if (!inputData.option_id?.trim()) {
        alert('옵션ID를 입력해주세요.');
        return;
      }

      const today = new Date();
      const dateString = String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');

      // UPSERT 로직: option_id로 기존 데이터 확인
      const { data: existingData, error: checkError } = await supabase
        .from('chinaorder_cart')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('option_id', inputData.option_id)
        .eq('date', dateString);

      if (checkError) {
        console.error('❌ 기존 데이터 확인 오류:', checkError);
        throw checkError;
      }

      // 📋 인터페이스 → DB 컬럼명으로 변환하여 저장
      const saveData = {
        user_id: currentUserId,
        date: dateString,
        option_id: inputData.option_id,
        item_name: inputData.item_name || '',
        option_name: inputData.option_name || '',
        barcode: inputData.barcode || '',
        quantity: inputData.order_quantity || 0, // 인터페이스: order_quantity → DB: quantity
        china_option1: inputData.china_option1 || '',
        china_option2: inputData.china_option2 || '',
        china_price: inputData.china_price || '',
        china_total_price: inputData.china_total_price || '',
        china_link: inputData.china_link || '',
        image_url: inputData.image_url || '', // 인터페이스: image_url → DB: image_url
        composition: inputData.remark || '' // 인터페이스: remark → DB: composition (혼용률)
      };

      let result;

      if (existingData && existingData.length > 0) {
        // UPDATE: 기존 데이터가 있으면 업데이트
        console.log('🔄 기존 데이터 업데이트');
        result = await supabase
          .from('chinaorder_cart')
          .update(saveData)
          .eq('user_id', currentUserId)
          .eq('option_id', inputData.option_id)
          .eq('date', dateString);
      } else {
        // INSERT: 새로운 데이터 삽입
        console.log('➕ 새로운 데이터 삽입');
        result = await supabase
          .from('chinaorder_cart')
          .insert([saveData]);
      }

      if (result.error) {
        console.error('❌ 저장 오류:', result.error);
        throw result.error;
      }

      console.log('✅ 데이터 저장 완료');
      
      // 저장 완료 후 초기화 및 새로고침
      setShowInputRow(false);
      setInputData({
        option_id: '',
        item_name: '',
        option_name: '',
        barcode: '',
        order_quantity: 0,
        china_option1: '',
        china_option2: '',
        china_price: '',
        china_total_price: '',
        remark: '',
        china_link: '',
        image_url: ''
      });
      
      // 데이터 새로고침
      await loadOrderData();

    } catch (error) {
      console.error('❌ 저장 실패:', error);
      alert('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 🚫 입력 취소 핸들러
  const handleCancelInput = () => {
    setShowInputRow(false);
    setInputData({
      option_id: '',
      item_name: '',
      option_name: '',
      barcode: '',
      order_quantity: 0,
      china_option1: '',
      china_option2: '',
      china_price: '',
      china_total_price: '',
      remark: '',
      china_link: '',
      image_url: ''
    });
  };

  const totalPages = Math.ceil(filteredOrderData.length / itemsPerPage);
  const currentTableRows = transformDataToTableRows(getCurrentPageData());

  // 🆕 인라인 편집 관련 함수들
  const handleCellClick = (rowId: string, field: string, currentValue: any) => {
    if (field === 'image_url') return; // 이미지 셀은 편집 불가
    
    setEditingCell({ rowId, field });
    setEditValue(String(currentValue || ''));
  };

  const handleEditKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleEditBlur = () => {
    handleSaveEdit();
  };

  const handleSaveEdit = async () => {
    if (!editingCell) return;

    const { rowId, field } = editingCell;
    
    try {
      // DB 필드명 매핑 (인터페이스 → DB)
      const dbFieldMap: Record<string, string> = {
        'order_quantity': 'quantity',
        'remark': 'composition'
      };
      
      const dbField = dbFieldMap[field] || field;
      
      const { error } = await supabase
        .from('chinaorder_cart')
        .update({ [dbField]: editValue })
        .eq('option_id', rowId);

      if (error) {
        throw error;
      }

      // 로컬 데이터 업데이트
      setOrderData(prevData => 
        prevData.map(item => 
          item.option_id === rowId 
            ? { ...item, [field]: editValue }
            : item
        )
      );

      // 필터된 데이터도 업데이트
      setFilteredOrderData(prevData => 
        prevData.map(item => 
          item.option_id === rowId 
            ? { ...item, [field]: editValue }
            : item
        )
      );

      console.log('✅ 셀 업데이트 완료:', { rowId, field, dbField, value: editValue });

    } catch (error) {
      console.error('❌ 셀 업데이트 오류:', error);
      alert('데이터 업데이트에 실패했습니다.');
    } finally {
      setEditingCell(null);
      setEditValue('');
    }
  };

  return (
    <div className="product-list-container chinaorder-cart-container">
      {/* 페이지 헤더 */}
      <div className="product-list-page-header">
        <h1 className="product-list-page-title">요청 목록</h1>
      </div>

      {/* 통계 카드 섹션 */}
      <div className="product-list-stats-grid">
        <DashboardStatsCard title="전체" value={stats.total} color="default" />
        <DashboardStatsCard title="아이템파너 아님" value={stats.notItemPartner} hasInfo={true} subtitle="쿠팡 배송 성장 20% 상품 中" color="orange" />
        <DashboardStatsCard title="품절" value={stats.outOfStock} color="red" />
        <DashboardStatsCard title="승인반려" value={stats.rejected} hasInfo={true} color="red" />
        <DashboardStatsCard title="판매중" value={stats.selling} color="blue" />
        <DashboardStatsCard title="임시저장" value={stats.tempSave} color="default" />
      </div>

      {/* 검색 및 필터 섹션 */}
      <div className="product-list-filter-section">
        <div className="product-list-filter-grid-improved">
          {/* 판매방식 필터 */}
          <div>
            <label className="product-list-label">판매방식</label>
            <select 
              value={sortFilter}
              onChange={(e) => setSortFilter(e.target.value)}
              className="product-list-select"
            >
              <option value="전체">전체</option>
              <option value="로켓그로스">로켓그로스</option>
              <option value="일반판매">일반판매</option>
            </select>
          </div>

          {/* 노출상태 */}
          <div>
            <label className="product-list-label">노출상태</label>
            <select 
              value={selectedExposure}
              onChange={(e) => setSelectedExposure(e.target.value)}
              className="product-list-select"
            >
              <option value="전체">전체</option>
              <option value="APPROVAL">승인</option>
              <option value="ON_SALE">판매중</option>
              <option value="REJECT">반려</option>
              <option value="SUSPENSION">일시중단</option>
            </select>
          </div>

          {/* 판매상태 */}
          <div>
            <label className="product-list-label">판매상태</label>
            <select 
              value={selectedSaleStatus}
              onChange={(e) => setSelectedSaleStatus(e.target.value)}
              className="product-list-select"
            >
              <option value="전체">전체</option>
              <option value="ONSALE">판매중</option>
              <option value="OUTOFSTOCK">품절</option>
              <option value="SUSPENSION">판매중단</option>
            </select>
          </div>

          {/* 카테고리 */}
          <div>
            <label className="product-list-label">카테고리</label>
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="product-list-select"
            >
              <option value="전체">전체</option>
            </select>
          </div>

          {/* 검색창 */}
          <div className="product-list-search-container">
            <label className="product-list-label">검색</label>
            <div className="product-list-search-wrapper">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="검색어를 입력하세요... (Enter 키로 검색)"
                className="product-list-search-input"
              />
              <button 
                onClick={handleSearch}
                className="product-list-search-button"
              >
                🔍
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 데이터 테이블 */}
      <div className="product-list-table-section">
        {/* 테이블 헤더 - 데이터 개수와 액션 버튼들 */}
        <div className="product-list-table-header-section">
          <div className="product-list-table-info">
            <div className="product-list-data-count">
              총 {filteredOrderData.length}개 주문
            </div>
            <div className="product-list-selected-info">
              선택된 주문: {selectedItems.length}개 / 총 {currentTableRows.length}개
            </div>
          </div>
          
          <div className="product-list-action-buttons">
            <ActionButton
              variant="primary"
              onClick={handleAddOrder}
              disabled={isLoading}
            >
              주문 추가하기
            </ActionButton>
            
            <ActionButton
              variant="info"
              onClick={handleLoadInfo}
              loading={isLoading}
              loadingText="불러오는 중..."
            >
              정보 불러오기
            </ActionButton>

            <ActionButton
              variant="danger"
              onClick={handleDelete}
              disabled={selectedItems.length === 0 || isLoading}
            >
              삭제
            </ActionButton>
          </div>
        </div>

        {/* 테이블 컨테이너 */}
        <div className="product-list-table-container">
          <table className="product-list-table chinaorder-cart-table" key={`table-page-${currentPage}`}>
            <thead className="product-list-table-header">
              <tr>
                <th className="product-list-table-header-cell product-list-table-header-checkbox" style={{ width: '40px', padding: '1px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="product-list-checkbox-large"
                  />
                </th>
                <th className="product-list-table-header-cell" style={{ width: '50px' }}>이미지</th>
                <th className="product-list-table-header-cell" style={{ width: '60px' }}>옵션ID</th>
                <th className="product-list-table-header-cell" style={{ width: '400px' }}>등록상품명</th>
                <th className="product-list-table-header-cell" style={{ width: '120px' }}>옵션명</th>
                <th className="product-list-table-header-cell" style={{ width: '80px' }}>바코드</th>
                <th className="product-list-table-header-cell" style={{ width: '50px' }}>개수</th>
                <th className="product-list-table-header-cell" style={{ width: '60px' }}>혼용률</th>
                <th className="product-list-table-header-cell" style={{ width: '80px' }}>중국옵션1</th>
                <th className="product-list-table-header-cell" style={{ width: '80px' }}>중국옵션2</th>
                <th className="product-list-table-header-cell" style={{ width: '50px' }}>위안</th>
                <th className="product-list-table-header-cell" style={{ width: '60px' }}>총위안</th>
                <th className="product-list-table-header-cell" style={{ width: '80px' }}>비고</th>
                <th className="product-list-table-header-cell" style={{ width: '100px' }}>주문링크</th>
              </tr>
            </thead>
            <tbody className="product-list-table-body">
              {currentTableRows.length === 0 && (
                <tr>
                  <td colSpan={14} style={{ 
                    textAlign: 'center', 
                    padding: '40px', 
                    color: '#666',
                    fontSize: '16px' 
                  }}>
                    {isLoading ? '데이터를 불러오는 중...' : '데이터가 없습니다.'}
                  </td>
                </tr>
              )}
{currentTableRows.map((row, index) => {
                // 편집 가능한 셀을 렌더링하는 함수
                const renderEditableCell = (field: string, value: any, style: any, isNumeric = false) => {
                  const isEditing = editingCell?.rowId === row.option_id && editingCell?.field === field;
                  
                  if (isEditing) {
                    return (
                      <input
                        type={isNumeric ? "number" : "text"}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyPress={handleEditKeyPress}
                        onBlur={handleEditBlur}
                        autoFocus
                        style={{
                          width: '100%',
                          height: '100%',
                          padding: '2px 4px',
                          border: 'none',
                          outline: 'none',
                          fontSize: style.fontSize,
                          textAlign: 'center',
                          backgroundColor: 'transparent',
                          fontFamily: 'inherit'
                        }}
                      />
                    );
                  }
                  
                  return (
                    <div
                      onClick={() => handleCellClick(row.option_id!, field, value)}
                      style={{
                        cursor: 'pointer',
                        minHeight: '30px',
                        width: '100%',
                        height: '100%',
                        boxSizing: 'border-box',
                        padding: '4px 6px',
                        display: 'block',
                        fontSize: style.fontSize,
                        textAlign: 'center',
                        lineHeight: '1.2',
                        wordBreak: 'break-all',
                        whiteSpace: 'pre-wrap'
                      }}
                      title="클릭하여 편집"
                    >
                      {value || '-'}
                    </div>
                  );
                };

                return (
                  <tr key={row.id} className="product-list-table-row">
                    <td className="product-list-table-cell">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(row.id)}
                        onChange={() => handleSelectItem(row.id)}
                        className="product-list-checkbox-large"
                      />
                    </td>
                    <td className="product-list-table-cell">
                      {row.image_url ? (
                        <div style={{ width: '60px', height: '60px', position: 'relative', backgroundColor: '#f5f5f5', borderRadius: '4px', overflow: 'hidden' }}>
                          <img 
                            src={row.image_url} 
                            alt="상품 이미지" 
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: 'cover',
                              display: 'block'
                            }}
                            onError={(e) => {
                              // 에러 시 이미지 숨기고 대체 텍스트 표시
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent && !parent.querySelector('.error-text')) {
                                const errorDiv = document.createElement('div');
                                errorDiv.className = 'error-text';
                                errorDiv.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999;';
                                errorDiv.textContent = '이미지 없음';
                                parent.appendChild(errorDiv);
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div style={{ width: '60px', height: '60px', backgroundColor: '#f5f5f5', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#999' }}>
                          이미지 없음
                        </div>
                      )}
                    </td>
                    <td className="product-list-table-cell">
                      {renderEditableCell('option_id', row.option_id, { fontSize: '11px' })}
                    </td>
                    <td className="product-list-table-cell">
                      {renderEditableCell('item_name', row.item_name, { fontSize: '13px' })}
                    </td>
                    <td className="product-list-table-cell">
                      {renderEditableCell('option_name', row.option_name, { fontSize: '12px' })}
                    </td>
                    <td className="product-list-table-cell">
                      {renderEditableCell('barcode', row.barcode, { fontSize: '11px' })}
                    </td>
                    <td className="product-list-table-cell">
                      {renderEditableCell('order_quantity', row.order_quantity, { fontSize: '12px' }, true)}
                    </td>
                    <td className="product-list-table-cell">
                      {renderEditableCell('remark', row.remark, { fontSize: '11px' })}
                    </td>
                    <td className="product-list-table-cell">
                      {renderEditableCell('china_option1', row.china_option1, { fontSize: '12px' })}
                    </td>
                    <td className="product-list-table-cell">
                      {renderEditableCell('china_option2', row.china_option2, { fontSize: '12px' })}
                    </td>
                    <td className="product-list-table-cell">
                      {renderEditableCell('china_price', row.china_price, { fontSize: '11px' })}
                    </td>
                    <td className="product-list-table-cell">
                      {renderEditableCell('china_total_price', row.china_total_price, { fontSize: '11px' })}
                    </td>
                    <td className="product-list-table-cell">-</td>
                    <td className="product-list-table-cell">
                      {row.china_link ? (
                        <a 
                          href={row.china_link} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{ 
                            color: '#3b82f6', 
                            textDecoration: 'underline',
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '100px'
                          }}
                          title={row.china_link}
                        >
                          주문링크
                        </a>
                      ) : '-'}
                    </td>
                  </tr>
                );
              })}
              
              {/* 🆕 입력 행 */}
              {showInputRow && (
                <tr className="product-list-table-row" style={{ backgroundColor: '#f8f9fa', border: '2px solid #007bff' }}>
                  <td className="product-list-table-cell" style={{ textAlign: 'center', padding: '4px' }}>
                    <ActionButton
                      variant="success"
                      onClick={handleSaveInputData}
                      disabled={isLoading || !inputData.option_id?.trim()}
                      loading={isLoading}
                      loadingText="저장 중..."
                    >
                      💾
                    </ActionButton>
                  </td>
                  <td className="product-list-table-cell" style={{ padding: '4px', textAlign: 'center' }}>
                    <input
                      type="text"
                      value={inputData.image_url || ''}
                      onChange={(e) => handleInputChange('image_url', e.target.value)}
                      placeholder="이미지 URL"
                      style={{ 
                        width: '100%', 
                        fontSize: '11px', 
                        padding: '2px', 
                        border: '1px solid #ddd',
                        borderRadius: '2px'
                      }}
                    />
                  </td>
                  <td className="product-list-table-cell" style={{ padding: '4px' }}>
                    <input
                      type="text"
                      value={inputData.option_id || ''}
                      onChange={(e) => handleInputChange('option_id', e.target.value)}
                      placeholder="옵션ID*"
                      style={{ 
                        width: '100%', 
                        fontSize: '11px', 
                        padding: '2px', 
                        border: inputData.option_id?.trim() ? '1px solid #ddd' : '2px solid #ff6b6b',
                        borderRadius: '2px'
                      }}
                    />
                  </td>
                  <td className="product-list-table-cell" style={{ padding: '4px' }}>
                    <input
                      type="text"
                      value={inputData.item_name || ''}
                      onChange={(e) => handleInputChange('item_name', e.target.value)}
                      placeholder="등록상품명"
                      style={{ 
                        width: '100%', 
                        fontSize: '12px', 
                        padding: '2px', 
                        border: '1px solid #ddd',
                        borderRadius: '2px',
                        textAlign: 'center'
                      }}
                    />
                  </td>
                  <td className="product-list-table-cell" style={{ padding: '4px' }}>
                    <input
                      type="text"
                      value={inputData.option_name || ''}
                      onChange={(e) => handleInputChange('option_name', e.target.value)}
                      placeholder="옵션명"
                      style={{ 
                        width: '100%', 
                        fontSize: '12px', 
                        padding: '2px', 
                        border: '1px solid #ddd',
                        borderRadius: '2px',
                        textAlign: 'center'
                      }}
                    />
                  </td>
                  <td className="product-list-table-cell" style={{ padding: '4px' }}>
                    <input
                      type="text"
                      value={inputData.barcode || ''}
                      onChange={(e) => handleInputChange('barcode', e.target.value)}
                      placeholder="바코드"
                      style={{ 
                        width: '100%', 
                        fontSize: '11px', 
                        padding: '2px', 
                        border: '1px solid #ddd',
                        borderRadius: '2px',
                        textAlign: 'center'
                      }}
                    />
                  </td>
                  <td className="product-list-table-cell" style={{ padding: '4px' }}>
                    <input
                      type="number"
                      value={inputData.order_quantity || ''}
                      onChange={(e) => handleInputChange('order_quantity', parseInt(e.target.value) || 0)}
                      placeholder="개수"
                      min="0"
                      style={{ 
                        width: '100%', 
                        fontSize: '11px', 
                        padding: '2px', 
                        border: '1px solid #ddd',
                        borderRadius: '2px'
                      }}
                    />
                  </td>
                  <td className="product-list-table-cell" style={{ padding: '4px' }}>
                    <input
                      type="text"
                      value={inputData.remark || ''}
                      onChange={(e) => handleInputChange('remark', e.target.value)}
                      placeholder="혼용률"
                      style={{ 
                        width: '100%', 
                        fontSize: '11px', 
                        padding: '2px', 
                        border: '1px solid #ddd',
                        borderRadius: '2px'
                      }}
                    />
                  </td>
                  <td className="product-list-table-cell" style={{ padding: '4px' }}>
                    <input
                      type="text"
                      value={inputData.china_option1 || ''}
                      onChange={(e) => handleInputChange('china_option1', e.target.value)}
                      placeholder="중국옵션1"
                      style={{ 
                        width: '100%', 
                        fontSize: '12px', 
                        padding: '2px', 
                        border: '1px solid #ddd',
                        borderRadius: '2px'
                      }}
                    />
                  </td>
                  <td className="product-list-table-cell" style={{ padding: '4px' }}>
                    <input
                      type="text"
                      value={inputData.china_option2 || ''}
                      onChange={(e) => handleInputChange('china_option2', e.target.value)}
                      placeholder="중국옵션2"
                      style={{ 
                        width: '100%', 
                        fontSize: '12px', 
                        padding: '2px', 
                        border: '1px solid #ddd',
                        borderRadius: '2px'
                      }}
                    />
                  </td>
                  <td className="product-list-table-cell" style={{ padding: '4px' }}>
                    <input
                      type="text"
                      value={inputData.china_price || ''}
                      onChange={(e) => handleInputChange('china_price', e.target.value)}
                      placeholder="위안"
                      style={{ 
                        width: '100%', 
                        fontSize: '11px', 
                        padding: '2px', 
                        border: '1px solid #ddd',
                        borderRadius: '2px'
                      }}
                    />
                  </td>
                  <td className="product-list-table-cell" style={{ padding: '4px' }}>
                    <input
                      type="text"
                      value={inputData.china_total_price || ''}
                      onChange={(e) => handleInputChange('china_total_price', e.target.value)}
                      placeholder="총위안"
                      style={{ 
                        width: '100%', 
                        fontSize: '11px', 
                        padding: '2px', 
                        border: '1px solid #ddd',
                        borderRadius: '2px'
                      }}
                    />
                  </td>
                  <td className="product-list-table-cell" style={{ padding: '4px', textAlign: 'center', fontSize: '11px' }}>
                    -
                  </td>
                  <td className="product-list-table-cell" style={{ padding: '4px' }}>
                    <input
                      type="text"
                      value={inputData.china_link || ''}
                      onChange={(e) => handleInputChange('china_link', e.target.value)}
                      placeholder="주문링크"
                      style={{ 
                        width: '100%', 
                        fontSize: '11px', 
                        padding: '2px', 
                        border: '1px solid #ddd',
                        borderRadius: '2px'
                      }}
                    />
                  </td>
                </tr>
              )}
              
              {/* 🆕 입력 행 조작 버튼들 */}
              {showInputRow && (
                <tr>
                  <td colSpan={14} style={{ padding: '8px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                      <ActionButton
                        variant="success"
                        onClick={handleSaveInputData}
                        disabled={isLoading || !inputData.option_id?.trim()}
                        loading={isLoading}
                        loadingText="저장 중..."
                      >
                        💾 저장
                      </ActionButton>
                      
                      <ActionButton
                        variant="default"
                        onClick={handleCancelInput}
                        disabled={isLoading}
                      >
                        ❌ 취소
                      </ActionButton>
                      
                      <span style={{ fontSize: '12px', color: '#666', marginLeft: '12px' }}>
                        * 옵션ID는 필수 입력 항목입니다
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="product-list-pagination">
          <div className="product-list-pagination-controls">
            <button 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="product-list-pagination-button"
            >
              이전
            </button>
            
            <div className="product-list-pagination-info">
              {currentPage} / {totalPages}
            </div>
            
            <button 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="product-list-pagination-button"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChinaorderCart; 