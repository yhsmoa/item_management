import React, { useState } from 'react';
import DashboardStatsCard from './components/StatsCard';
import { viewsService } from '../../services/viewsService';
import { getCurrentUserId } from '../../services/authService';
import * as XLSX from 'xlsx';
import './ProductListPage/index.css';

function ViewsPage() {
  // Refs for date inputs
  const startDateRef = React.useRef<HTMLInputElement>(null);
  const endDateRef = React.useRef<HTMLInputElement>(null);
  
  // State 정의
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewsData, setViewsData] = useState('');
  const [modalSelectedDate, setModalSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  
  // 날짜 선택 및 데이터 축적
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDateToAdd, setSelectedDateToAdd] = useState('');
  const [accumulatedData, setAccumulatedData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [addedDates, setAddedDates] = useState<string[]>([]);
  
  // 삭제 모달
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [dateToDelete, setDateToDelete] = useState('');
  
  // Excel 업로드 모달
  const [showExcelModal, setShowExcelModal] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // 전체 삭제 모달
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  
  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // 더미 통계 데이터
  const stats = {
    total: 0,
    notItemPartner: 0,
    outOfStock: 0,
    rejected: 0,
    selling: 0,
    tempSave: 0
  };

  // 날짜 범위 생성 함수
  const generateDateRange = (start: string, end: string): string[] => {
    const dates: string[] = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  };
  
  // 시작일/종료일 변경 시 사용 가능한 날짜 업데이트
  const updateAvailableDates = async () => {
    if (startDate && endDate) {
      try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
          setAvailableDates([]);
          setSelectedDateToAdd('');
          return;
        }
        
        const result = await viewsService.getAvailableDates(currentUserId, startDate, endDate);
        
        if (result.success) {
          setAvailableDates(result.data);
          setSelectedDateToAdd(result.data[0] || '');
        } else {
          setAvailableDates([]);
          setSelectedDateToAdd('');
        }
      } catch (error) {
        console.error('사용 가능한 날짜 조회 오류:', error);
        setAvailableDates([]);
        setSelectedDateToAdd('');
      }
    } else {
      setAvailableDates([]);
      setSelectedDateToAdd('');
    }
  };
  
  // 날짜 추가 핸들러
  const handleAddDate = async () => {
    if (!selectedDateToAdd) {
      alert('추가할 날짜를 선택해주세요.');
      return;
    }
    
    // 이미 추가된 날짜인지 확인
    if (addedDates.includes(selectedDateToAdd)) {
      alert('이미 추가된 날짜입니다.');
      return;
    }
    
    // 최대 8개 제한 확인
    if (addedDates.length >= 8) {
      alert('최대 8개의 날짜만 추가할 수 있습니다.');
      return;
    }
    
    setIsLoading(true);
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        alert('로그인이 필요합니다.');
        return;
      }
      
      const result = await viewsService.getViewsData(currentUserId, selectedDateToAdd);
      
      if (result.success && result.data.length > 0) {
        const newData = result.data.map((item: any) => ({
          date: selectedDateToAdd,
          productId: item.productId,
          productViews: item.productViews
        }));
        
        setAccumulatedData(prev => {
          const updated = [...prev, ...newData];
          // 검색어가 있으면 필터링 적용, 없으면 전체 데이터 표시
          if (searchKeyword.trim()) {
            const filtered = updated.filter(item => 
              item.productId && item.productId.toLowerCase().includes(searchKeyword.toLowerCase())
            );
            setFilteredData(filtered);
          } else {
            setFilteredData(updated);
          }
          return updated;
        });
        
        // 추가된 날짜 목록에 추가
        setAddedDates(prev => [...prev, selectedDateToAdd]);
      } else {
        alert(`${selectedDateToAdd} 날짜에 대한 데이터가 없습니다.`);
      }
    } catch (error) {
      console.error('날짜 추가 오류:', error);
      alert('날짜 추가 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 검색 핸들러 - productId 필터링
  const handleSearch = () => {
    if (!searchKeyword.trim()) {
      setFilteredData(accumulatedData);
      return;
    }
    
    const filtered = accumulatedData.filter(item => 
      item.productId && item.productId.toLowerCase().includes(searchKeyword.toLowerCase())
    );
    setFilteredData(filtered);
    setCurrentPage(1); // 검색 후 첫 페이지로 이동
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 날짜 입력 핸들러 - 자동 포커스 이동
  const handleDateInput = (value: string, field: 'start' | 'end', inputRef: React.RefObject<HTMLInputElement | null>) => {
    // YYYY-MM-DD 형식에서 자동 포커스 이동
    if (value.length === 4 && !value.includes('-')) {
      // 4자리 연도 입력 후 자동으로 월로 이동
      const formatted = value + '-';
      if (field === 'start') {
        setStartDate(formatted);
      } else {
        setEndDate(formatted);
      }
      // 커서를 월 위치로 이동
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(5, 5);
        }
      }, 0);
    } else if (value.length === 7 && value.split('-').length === 2) {
      // MM 입력 후 자동으로 일로 이동
      const formatted = value + '-';
      if (field === 'start') {
        setStartDate(formatted);
      } else {
        setEndDate(formatted);
      }
      // 커서를 일 위치로 이동
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(8, 8);
        }
      }, 0);
    } else {
      if (field === 'start') {
        setStartDate(value);
      } else {
        setEndDate(value);
      }
    }
  };
  
  // 날짜 조회 핸들러
  const handleDateSearch = async () => {
    if (!startDate || !endDate) {
      alert('시작일자와 종료일자를 선택해주세요.');
      return;
    }
    
    if (startDate > endDate) {
      alert('시작일자는 종료일자보다 이전이어야 합니다.');
      return;
    }
    
    await updateAvailableDates();
  };
  
  // 날짜 삭제 핸들러
  const handleDeleteDate = () => {
    if (!selectedDateToAdd) {
      alert('삭제할 날짜를 선택해주세요.');
      return;
    }
    
    setDateToDelete(selectedDateToAdd);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };
  
  // 삭제 확인 핸들러
  const handleConfirmDelete = async () => {
    if (deleteConfirmText !== '삭제') {
      alert('삭제를 진행하려면 "삭제"라고 입력해주세요.');
      return;
    }
    
    setIsLoading(true);
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        alert('로그인이 필요합니다.');
        return;
      }
      
      const result = await viewsService.deleteViewsData(currentUserId, dateToDelete);
      
      if (result.success) {
        // 테이블에서 해당 날짜 데이터 제거
        setAccumulatedData(prev => prev.filter(item => item.date !== dateToDelete));
        setFilteredData(prev => prev.filter(item => item.date !== dateToDelete));
        
        // 추가된 날짜 목록에서 제거
        setAddedDates(prev => prev.filter(date => date !== dateToDelete));
        
        alert(`${dateToDelete} 날짜의 조회수 데이터가 삭제되었습니다.`);
        setShowDeleteModal(false);
      } else {
        alert('데이터 삭제 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('날짜 삭제 오류:', error);
      alert('날짜 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 전체 조회수 데이터 삭제 핸들러
  const handleDeleteAllViews = async () => {
    setIsLoading(true);
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        alert('로그인이 필요합니다.');
        return;
      }

      // viewsService를 통해 모든 조회수 데이터 삭제
      const result = await viewsService.deleteAllViewsData(currentUserId);
      
      if (result.success) {
        alert(`총 ${result.deletedCount}개의 조회수 데이터가 삭제되었습니다.`);
        setShowDeleteAllModal(false);
        
        // 현재 화면의 데이터도 초기화
        setAccumulatedData([]);
        setFilteredData([]);
        setAddedDates([]);
      } else {
        alert('전체 조회수 데이터 삭제에 실패했습니다.');
      }
    } catch (error) {
      alert('전체 조회수 데이터 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Excel 파일 업로드 및 MongoDB 저장 핸들러
  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 확장자 검증
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      alert('Excel 파일(.xlsx, .xls)만 업로드 가능합니다.');
      return;
    }

    setIsLoading(true);
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        alert('로그인이 필요합니다.');
        return;
      }

      // Excel 파일 읽기
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // 데이터를 2차원 배열로 변환
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (data.length < 2) {
        alert('유효한 데이터가 없습니다. 최소 2행(헤더 + 데이터) 이상이어야 합니다.');
        return;
      }

      // 헤더 행 (첫 번째 행)에서 날짜들 추출
      const headerRow = data[0];
      const dates = headerRow.slice(1); // A열(productId) 제외하고 B열부터가 날짜들
      
      // 날짜 형식 검증 (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      for (const date of dates) {
        if (date && !dateRegex.test(String(date))) {
          alert(`잘못된 날짜 형식입니다: "${date}"\n날짜는 YYYY-MM-DD 형식이어야 합니다. (예: 2025-08-01)`);
          return;
        }
      }
      
      // 날짜별로 데이터 그룹핑
      const dateGroupedData: { [date: string]: any[] } = {};
      
      // 각 날짜별로 빈 배열 초기화
      dates.forEach(date => {
        if (date) {
          dateGroupedData[String(date)] = [];
        }
      });
      
      // 2행부터 데이터 처리 (1행은 헤더이므로 제외)
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const productId = row[0]; // A열: productId
        
        if (!productId) continue; // productId가 없으면 스킵
        
        // B열부터 각 날짜의 조회수 데이터 처리
        for (let j = 1; j < row.length && j <= dates.length; j++) {
          const date = dates[j - 1];
          const productViews = row[j];
          
          if (date && productViews !== undefined && productViews !== '') {
            dateGroupedData[String(date)].push({
              productId: String(productId),
              productViews: String(productViews)
            });
          }
        }
      }

      // 각 날짜별로 문서 생성 및 저장
      let totalSavedCount = 0;
      
      for (const [date, views] of Object.entries(dateGroupedData)) {
        if (views.length > 0) {
          try {
            const result = await viewsService.saveViewsData(views, date, currentUserId);
            
            if (result.success) {
              totalSavedCount += views.length;
            } else {
              alert(`${date} 날짜 데이터 저장에 실패했습니다.`);
            }
          } catch (error) {
            alert(`${date} 날짜 데이터 저장 중 오류가 발생했습니다.`);
          }
        }
      }

      if (totalSavedCount === 0) {
        alert('저장할 유효한 데이터가 없습니다.');
        return;
      }

      alert(`총 ${totalSavedCount}개의 조회수 데이터가 MongoDB에 저장되었습니다.`);
      setShowExcelModal(false);
      
    } catch (error) {
      alert('Excel 파일 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      // 파일 입력 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 페이지네이션 핸들러
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSaveViews = async () => {
    if (!viewsData.trim()) {
      alert('조회수 데이터를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const parsedData = viewsService.parseViewsData(viewsData);
      
      if (parsedData.length === 0) {
        alert('올바른 형식의 데이터를 입력해주세요.');
        return;
      }

      const currentUserId = getCurrentUserId();
      console.log('현재 사용자 ID:', currentUserId);
      
      if (!currentUserId) {
        alert('로그인이 필요합니다.');
        return;
      }
      
      const result = await viewsService.saveViewsData(parsedData, modalSelectedDate, currentUserId);
      
      if (result.success) {
        alert(`${result.insertedCount}개의 조회수 데이터가 성공적으로 저장되었습니다.`);
        setViewsData('');
        setShowModal(false);
      } else {
        alert('데이터 저장 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('저장 오류:', error);
      alert('데이터 저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 데이터 피벗 변환
  const transformDataToPivot = (data: any[]) => {
    if (!data || data.length === 0) return { pivotData: [], uniqueDates: [] };
    
    // 고유한 날짜들 추출 및 정렬
    const datesSet = new Set<string>();
    data.forEach(item => datesSet.add(item.date));
    const uniqueDates = Array.from(datesSet).sort();
    
    // 상품ID별로 그룹핑
    const groupedByProduct: { [key: string]: { [key: string]: string } } = {};
    data.forEach(item => {
      if (!groupedByProduct[item.productId]) {
        groupedByProduct[item.productId] = {};
      }
      groupedByProduct[item.productId][item.date] = item.productViews;
    });
    
    // 피벗 형태로 변환
    const pivotData = Object.keys(groupedByProduct).map(productId => {
      const row: { [key: string]: string } = { productId };
      uniqueDates.forEach(date => {
        row[date] = groupedByProduct[productId][date] || '-';
      });
      return row;
    });
    
    return { pivotData, uniqueDates };
  };
  
  // 검색어가 있으면 필터링된 데이터, 없으면 전체 데이터 사용
  React.useEffect(() => {
    if (searchKeyword.trim()) {
      const filtered = accumulatedData.filter(item => 
        item.productId && item.productId.toLowerCase().includes(searchKeyword.toLowerCase())
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(accumulatedData);
    }
  }, [accumulatedData, searchKeyword]);
  
  const { pivotData, uniqueDates } = transformDataToPivot(filteredData);
  
  // 페이지네이션 계산
  const totalPages = Math.ceil(pivotData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = pivotData.slice(startIndex, endIndex);

  return (
    <div className="product-list-container">
      {/* 페이지 헤더 */}
      <div className="product-list-page-header">
        <h1 className="product-list-page-title">쿠팡 조회수 관리</h1>
        
        {/* 버튼들을 다음 줄 오른쪽 끝에 배치 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
          <button 
            className="product-list-button product-list-button-info"
            onClick={() => setShowExcelModal(true)}
          >
            조회수 xlsx 저장
          </button>
          <button 
            className="product-list-button"
            onClick={() => setShowDeleteAllModal(true)}
            style={{
              backgroundColor: '#dc2626',
              color: 'white',
              border: '1px solid #dc2626'
            }}
          >
            전체 조회수 제거
          </button>
          <button 
            className="product-list-button product-list-button-warning"
            onClick={async () => {
                // 콘솔 스크립트 복사 기능
                setIsLoading(true);
                try {
                  const currentUserId = getCurrentUserId();
                  if (!currentUserId) {
                    alert('로그인이 필요합니다.');
                    return;
                  }

                  // extract_coupang_item_all 테이블에서 해당 user_id의 모든 item_id 조회 (배치 처리)
                  const { supabase } = await import('../../config/supabase');
                  
                  let allData: any[] = [];
                  let page = 0;
                  const pageSize = 1000;
                  let hasMore = true;

                  while (hasMore) {
                    const from = page * pageSize;
                    const to = from + pageSize - 1;
                    
                    const { data: batch, error } = await supabase
                      .from('extract_coupang_item_all')
                      .select('item_id')
                      .eq('user_id', currentUserId)
                      .not('item_id', 'is', null)
                      .neq('item_id', '')
                      .range(from, to);

                    if (error) {
                      console.error('데이터 조회 오류:', error);
                      alert('데이터 조회 중 오류가 발생했습니다.');
                      return;
                    }

                    if (batch && batch.length > 0) {
                      allData = [...allData, ...batch];
                      hasMore = batch.length === pageSize;
                      page++;
                    } else {
                      hasMore = false;
                    }
                  }

                  // 중복 제거 및 정렬
                  const itemIds = allData.map(item => item.item_id);
                  const uniqueItemIds = Array.from(new Set(itemIds)).sort();
                  
                  if (uniqueItemIds.length > 0) {
                    // 콘솔 스크립트 템플릿
                    const consoleScript = `// 상품 ID 배열
const productIDs = [${uniqueItemIds.map(id => `'${id}'`).join(', ')}]
// Initialize global variables
const allData = [];
let stopScript = false;
// Flag to stop the script

// Function to extract data from the current page
function extractDataFromPage() {
    const rows = document.querySelectorAll('table tbody tr');
    rows.forEach( (row) => {
        const productId = row.querySelector('td:nth-child(2)').textContent.trim();
        const productViews = row.querySelector('td:nth-child(5)').textContent.trim();
        allData.push({
            productId,
            productViews
        });
    }
    );
}

// Function to search IDs in groups of 10
async function searchProductIDs(ids) {
    for (let i = 0; i < ids.length; i += 10) {
        if (stopScript) {
            console.log("Script stopped by user.");
            break;
        }

        // Get the current group of 10 IDs
        const currentIDs = ids.slice(i, i + 10);
        console.log(\`Searching IDs: \${currentIDs.join(', ')}\`);

        // Input the IDs into the textarea
        const textarea = document.querySelector('textarea[placeholder*="등록상품 ID"]');
        if (textarea) {
            textarea.value = currentIDs.join(',');
            textarea.dispatchEvent(new Event('input',{
                bubbles: true
            }));
        }

        // Click the search button
        const searchButton = document.querySelector('button[type="submit"]');
        if (searchButton) {
            searchButton.click();
        }

        // Wait for the page to load and extract data
        await new Promise(resolve => setTimeout(resolve, 3000));
        // Adjust delay as necessary
        extractDataFromPage();
    }

    // Log all collected data
    console.log("All collected data:", allData);
}

// Add a command to stop the script dynamically
window.stopDataExtraction = () => {
    stopScript = true;
    console.log("Stop command received. Finishing current operation...");
}
;

// Start searching and extracting data
searchProductIDs(productIDs);`;

                    // HTTPS 환경과 HTTP 환경 모두 지원하는 Fallback 방식
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      // HTTPS 환경 - Clipboard API 사용
                      navigator.clipboard.writeText(consoleScript).then(() => {
                        alert(`${uniqueItemIds.length}개의 상품ID를 포함한 콘솔 스크립트가 복사되었습니다.`);
                      }).catch(() => {
                        alert('복사에 실패했습니다.');
                      });
                    } else {
                      // HTTP 환경 - 구식 방법 사용
                      const textarea = document.createElement('textarea');
                      textarea.value = consoleScript;
                      textarea.style.position = 'fixed';
                      textarea.style.top = '-999px';
                      textarea.style.left = '-999px';
                      document.body.appendChild(textarea);
                      textarea.focus();
                      textarea.select();
                      
                      try {
                        const successful = document.execCommand('copy');
                        if (successful) {
                          alert(`${uniqueItemIds.length}개의 상품ID를 포함한 콘솔 스크립트가 복사되었습니다.`);
                        } else {
                          alert('복사에 실패했습니다.');
                        }
                      } catch (err) {
                        console.error('복사 실패:', err);
                        alert('복사에 실패했습니다.');
                      } finally {
                        document.body.removeChild(textarea);
                      }
                    }
                  } else {
                    alert('복사할 상품ID가 없습니다.');
                  }
                } catch (error) {
                  console.error('콘솔 스크립트 복사 오류:', error);
                  alert('콘솔 스크립트 복사 중 오류가 발생했습니다.');
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
            >
              콘솔 복사
            </button>
          <button 
            className="product-list-button product-list-button-secondary"
            onClick={async () => {
              // Supabase에서 상품ID 복사 기능
              setIsLoading(true);
              try {
                const currentUserId = getCurrentUserId();
                if (!currentUserId) {
                  alert('로그인이 필요합니다.');
                  return;
                }

                // extract_coupang_item_all 테이블에서 해당 user_id의 모든 item_id 조회 (배치 처리)
                const { supabase } = await import('../../config/supabase');
                
                let allData: any[] = [];
                let page = 0;
                const pageSize = 1000;
                let hasMore = true;

                while (hasMore) {
                  const from = page * pageSize;
                  const to = from + pageSize - 1;
                  
                  const { data: batch, error } = await supabase
                    .from('extract_coupang_item_all')
                    .select('item_id')
                    .eq('user_id', currentUserId)
                    .not('item_id', 'is', null)
                    .neq('item_id', '')
                    .range(from, to);

                  if (error) {
                    console.error('데이터 조회 오류:', error);
                    alert('데이터 조회 중 오류가 발생했습니다.');
                    return;
                  }

                  if (batch && batch.length > 0) {
                    allData = [...allData, ...batch];
                    hasMore = batch.length === pageSize;
                    page++;
                  } else {
                    hasMore = false;
                  }
                }

                const data = allData;

                // 중복 제거 및 정렬
                const itemIds = data.map(item => item.item_id);
                const uniqueItemIds = Array.from(new Set(itemIds)).sort();
                
                if (uniqueItemIds.length > 0) {
                  // 'item_id1', 'item_id2', 'item_id3' 형태로 복사
                  const formattedIds = uniqueItemIds.map(id => `'${id}'`).join(', ');
                  
                  // HTTPS 환경과 HTTP 환경 모두 지원하는 Fallback 방식
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    // HTTPS 환경 - Clipboard API 사용
                    navigator.clipboard.writeText(formattedIds).then(() => {
                      alert(`${uniqueItemIds.length}개의 상품ID가 복사되었습니다.`);
                    }).catch(() => {
                      alert('복사에 실패했습니다.');
                    });
                  } else {
                    // HTTP 환경 - 구식 방법 사용
                    const textarea = document.createElement('textarea');
                    textarea.value = formattedIds;
                    textarea.style.position = 'fixed';
                    textarea.style.top = '-999px';
                    textarea.style.left = '-999px';
                    document.body.appendChild(textarea);
                    textarea.focus();
                    textarea.select();
                    
                    try {
                      const successful = document.execCommand('copy');
                      if (successful) {
                        alert(`${uniqueItemIds.length}개의 상품ID가 복사되었습니다.`);
                      } else {
                        alert('복사에 실패했습니다.');
                      }
                    } catch (err) {
                      console.error('복사 실패:', err);
                      alert('복사에 실패했습니다.');
                    } finally {
                      document.body.removeChild(textarea);
                    }
                  }
                } else {
                  alert('복사할 상품ID가 없습니다.');
                }
              } catch (error) {
                console.error('상품ID 복사 오류:', error);
                alert('상품ID 복사 중 오류가 발생했습니다.');
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading}
          >
            상품id 복사
          </button>
          <button 
            className="product-list-button product-list-button-primary"
            onClick={() => setShowModal(true)}
          >
            조회수 저장
          </button>
        </div>
      </div>

      {/* 검색 및 필터 섹션 */}
      <div className="product-list-filter-section">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 첫 번째 줄: 시작일자, 종료일자, 조회 버튼 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
            {/* 시작일자 */}
            <div>
              <label className="product-list-label">시작일자</label>
              <input
                ref={startDateRef}
                type="text"
                value={startDate}
                onChange={(e) => handleDateInput(e.target.value, 'start', startDateRef)}
                className="product-list-select"
                maxLength={10}
                placeholder="YYYY-MM-DD"
                pattern="\d{4}-\d{2}-\d{2}"
              />
            </div>
            
            {/* 종료일자 */}
            <div>
              <label className="product-list-label">종료일자</label>
              <input
                ref={endDateRef}
                type="text"
                value={endDate}
                onChange={(e) => handleDateInput(e.target.value, 'end', endDateRef)}
                className="product-list-select"
                maxLength={10}
                placeholder="YYYY-MM-DD"
                pattern="\d{4}-\d{2}-\d{2}"
              />
            </div>
            
            {/* 조회 버튼 */}
            <button 
              onClick={handleDateSearch}
              className="product-list-button product-list-button-primary"
              disabled={isLoading}
              style={{ height: 'fit-content' }}
            >
              {isLoading ? '조회중...' : '조회'}
            </button>
          </div>
          
          {/* 두 번째 줄: 조회날짜, 추가 버튼 */}
          <div style={{ display: 'flex', alignItems: 'end', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#6b7280' }}>
              추가된 날짜: {addedDates.length}/8개
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '16px', alignItems: 'end' }}>
            {/* 조회날짜 */}
            <div>
              <label className="product-list-label">조회날짜</label>
              <select 
                className="product-list-select"
                value={selectedDateToAdd}
                onChange={(e) => setSelectedDateToAdd(e.target.value)}
                disabled={availableDates.length === 0}
              >
                <option value="">날짜를 선택하세요</option>
                {availableDates.map(date => (
                  <option key={date} value={date}>{date}</option>
                ))}
              </select>
            </div>
            
            {/* 추가 버튼 */}
            <button 
              onClick={handleAddDate}
              className="product-list-button product-list-button-primary"
              disabled={isLoading || !selectedDateToAdd || addedDates.length >= 8 || addedDates.includes(selectedDateToAdd)}
              style={{ height: 'fit-content' }}
            >
              {isLoading ? '로딩...' : '추가'}
            </button>
            
            {/* 삭제 버튼 */}
            <button 
              onClick={handleDeleteDate}
              className="product-list-button"
              disabled={isLoading || !selectedDateToAdd}
              style={{ 
                height: 'fit-content',
                backgroundColor: '#dc2626',
                color: 'white',
                border: '1px solid #dc2626'
              }}
            >
              {isLoading ? '로딩...' : '삭제'}
            </button>
          </div>
          
          {/* 세 번째 줄: 검색 */}
          <div className="product-list-search-container">
            <label className="product-list-label">검색</label>
            <div className="product-list-search-wrapper">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="상품ID 또는 상품명으로 검색..."
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
              총 {pivotData.length}개 상품
            </div>
          </div>
          
        </div>

        {/* 테이블 컨테이너 */}
        <div className="product-list-table-container">
          <table className="product-list-table views-page-table" style={{ textAlign: 'center' }}>
            <thead>
              <tr>
                <th style={{ width: '120px', textAlign: 'center' }}>상품ID</th>
                {uniqueDates.map(date => (
                  <th key={date} style={{ width: '120px', textAlign: 'center' }}>
                    {date}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentData.length === 0 ? (
                <tr>
                  <td colSpan={1 + uniqueDates.length} style={{ 
                    textAlign: 'center', 
                    padding: '40px', 
                    color: '#666',
                    fontSize: '16px' 
                  }}>
                    {isLoading ? '데이터를 불러오는 중...' : '데이터가 없습니다.'}
                  </td>
                </tr>
              ) : (
                currentData.map((item, index) => (
                  <tr key={`${item.productId}-${index}`}>
                    <td style={{ textAlign: 'center' }}>{item.productId}</td>
                    {uniqueDates.map(date => (
                      <td key={date} style={{ textAlign: 'center' }}>
                        {(item as any)[date]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="product-list-pagination">
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
        )}
      </div>

      {/* 조회수 추가 모달 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>조회수 추가</h3>
            </div>
            
            <div className="modal-body">
              <div className="input-group">
                <label>날짜</label>
                <input
                  type="date"
                  value={modalSelectedDate}
                  onChange={(e) => setModalSelectedDate(e.target.value)}
                  className="modal-date-input"
                />
              </div>
              
              <div className="input-group" style={{ marginTop: '20px' }}>
                <label>조회수 데이터</label>
                <textarea
                  value={viewsData}
                  onChange={(e) => setViewsData(e.target.value)}
                  placeholder="조회수 데이터를 입력하세요..."
                  className="modal-textarea"
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="modal-button modal-button-cancel"
                onClick={() => setShowModal(false)}
              >
                취소
              </button>
              <button 
                className="modal-button modal-button-save"
                onClick={handleSaveViews}
                disabled={isLoading}
              >
                {isLoading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '90%' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>조회수 데이터 삭제</h3>
              <button 
                className="modal-close-button"
                onClick={() => setShowDeleteModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px'
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body" style={{ padding: '24px' }}>
              <div style={{ 
                marginBottom: '24px', 
                padding: '16px', 
                backgroundColor: '#fef2f2', 
                border: '1px solid #fecaca', 
                borderRadius: '8px' 
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '12px' 
                }}>
                  <div style={{ 
                    fontSize: '20px', 
                    color: '#dc2626',
                    marginTop: '2px'
                  }}>
                    ⚠️
                  </div>
                  <div>
                    <p style={{ 
                      margin: '0 0 8px 0', 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: '#dc2626' 
                    }}>
                      데이터 삭제 확인
                    </p>
                    <p style={{ 
                      margin: '0', 
                      fontSize: '14px', 
                      color: '#374151',
                      lineHeight: '1.5' 
                    }}>
                      <strong>{dateToDelete}</strong> 날짜의 조회수 데이터를 완전히 삭제합니다.<br/>
                      이 작업은 되돌릴 수 없습니다.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="input-group">
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: '#374151' 
                }}>
                  삭제 확인을 위해 "<strong>삭제</strong>"라고 입력해주세요
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="삭제"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease-in-out',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>
            
            <div className="modal-footer" style={{ 
              padding: '16px 24px', 
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button 
                className="modal-button modal-button-cancel"
                onClick={() => setShowDeleteModal(false)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  backgroundColor: 'white',
                  color: '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                취소
              </button>
              <button 
                onClick={handleConfirmDelete}
                disabled={isLoading || deleteConfirmText !== '삭제'}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  backgroundColor: deleteConfirmText === '삭제' ? '#dc2626' : '#9ca3af',
                  color: 'white',
                  cursor: deleteConfirmText === '삭제' ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s ease-in-out',
                  opacity: (isLoading || deleteConfirmText !== '삭제') ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (deleteConfirmText === '삭제' && !isLoading) {
                    e.currentTarget.style.backgroundColor = '#b91c1c';
                  }
                }}
                onMouseLeave={(e) => {
                  if (deleteConfirmText === '삭제' && !isLoading) {
                    e.currentTarget.style.backgroundColor = '#dc2626';
                  }
                }}
              >
                {isLoading ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel 업로드 모달 */}
      {showExcelModal && (
        <div className="modal-overlay" onClick={() => setShowExcelModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>조회수 Excel 업로드</h3>
            </div>
            
            <div className="modal-body">
              <div style={{ marginBottom: '20px', fontSize: '14px', color: '#374151' }}>
                <p><strong>Excel 파일 형식:</strong></p>
                <ul style={{ marginLeft: '20px', lineHeight: '1.6' }}>
                  <li>A열: productId (상품 ID)</li>
                  <li>B열부터: 날짜별 조회수 데이터</li>
                  <li>첫 번째 행은 헤더로 무시됩니다</li>
                </ul>
                <p style={{ marginTop: '15px', fontSize: '12px', color: '#6b7280' }}>
                  예시: A1="productId", B1="2025-08-01", C1="2025-08-07"<br/>
                  A2=25487, B2=27, C2=32
                </p>
              </div>
              
              {!isLoading ? (
                <div 
                  className="product-list-upload-area"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #d1d5db',
                    borderRadius: '8px',
                    padding: '40px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: '#f9fafb'
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '10px' }}>📁</div>
                  <p style={{ margin: '0', fontSize: '16px', color: '#374151' }}>
                    Excel 파일을 선택하세요
                  </p>
                  <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
                    .xlsx, .xls 파일만 지원
                  </p>
                </div>
              ) : (
                <div style={{
                  border: '2px solid #3b82f6',
                  borderRadius: '8px',
                  padding: '40px',
                  textAlign: 'center',
                  backgroundColor: '#eff6ff'
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
                  <p style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '16px', 
                    fontWeight: '600',
                    color: '#1d4ed8' 
                  }}>
                    Excel 파일 처리 중...
                  </p>
                  <p style={{ 
                    margin: '0', 
                    fontSize: '14px', 
                    color: '#4b5563' 
                  }}>
                    데이터를 읽고 MongoDB에 저장하고 있습니다.
                  </p>
                  <div style={{ 
                    marginTop: '16px',
                    display: 'flex',
                    justifyContent: 'center'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      border: '3px solid #e5e7eb',
                      borderTop: '3px solid #3b82f6',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                  </div>
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                style={{ display: 'none' }}
                disabled={isLoading}
              />
            </div>
            
            <div className="modal-footer">
              <button 
                className="modal-button modal-button-cancel"
                onClick={() => setShowExcelModal(false)}
                disabled={isLoading}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 전체 삭제 확인 모달 */}
      {showDeleteAllModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteAllModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '90%' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>전체 조회수 데이터 삭제</h3>
              <button 
                className="modal-close-button"
                onClick={() => setShowDeleteAllModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px'
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body" style={{ padding: '24px' }}>
              <div style={{ 
                marginBottom: '24px', 
                padding: '16px', 
                backgroundColor: '#fef2f2', 
                border: '1px solid #fecaca', 
                borderRadius: '8px' 
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '12px' 
                }}>
                  <div style={{ 
                    fontSize: '20px', 
                    color: '#dc2626',
                    marginTop: '2px'
                  }}>
                    ⚠️
                  </div>
                  <div>
                    <p style={{ 
                      margin: '0 0 8px 0', 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: '#dc2626' 
                    }}>
                      전체 조회수 데이터 삭제 확인
                    </p>
                    <p style={{ 
                      margin: '0', 
                      fontSize: '14px', 
                      color: '#374151',
                      lineHeight: '1.5' 
                    }}>
                      계정의 <strong>모든 조회수 데이터</strong>를 완전히 삭제합니다.<br/>
                      이 작업은 되돌릴 수 없으며, 모든 날짜의 조회수 기록이 사라집니다.
                    </p>
                  </div>
                </div>
              </div>
              
              <div style={{ 
                textAlign: 'center',
                padding: '20px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <p style={{ 
                  margin: '0 0 16px 0', 
                  fontSize: '16px', 
                  fontWeight: '600',
                  color: '#374151' 
                }}>
                  정말로 모든 조회수 데이터를 삭제하시겠습니까?
                </p>
                <p style={{ 
                  margin: '0', 
                  fontSize: '14px', 
                  color: '#6b7280' 
                }}>
                  아래 버튼을 클릭하여 삭제를 진행하세요
                </p>
              </div>
            </div>
            
            <div className="modal-footer" style={{ 
              padding: '16px 24px', 
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button 
                onClick={() => setShowDeleteAllModal(false)}
                disabled={isLoading}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  backgroundColor: 'white',
                  color: '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out'
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = 'white';
                  }
                }}
              >
                취소
              </button>
              <button 
                onClick={handleDeleteAllViews}
                disabled={isLoading}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  backgroundColor: isLoading ? '#9ca3af' : '#dc2626',
                  color: 'white',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease-in-out',
                  opacity: isLoading ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = '#b91c1c';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = '#dc2626';
                  }
                }}
              >
                {isLoading ? '삭제 중...' : '전체 삭제를 진행합니다'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ViewsPage;