// Views-related utility functions

export const getViewCountColor = (current: string | undefined, previous: string | undefined, isFirstView: boolean = false): string => {
  // view1인 경우 항상 검은색
  if (isFirstView) {
    return '#000000';
  }
  
  // current나 previous가 없으면 검은색
  if (!current || current === '-' || !previous || previous === '-') {
    return '#000000';
  }
  
  const currentNum = parseInt(current.replace(/,/g, ''));
  const previousNum = parseInt(previous.replace(/,/g, ''));
  
  if (isNaN(currentNum) || isNaN(previousNum)) {
    return '#000000';
  }
  
  // 차이 계산 (current - previous, 방향성 고려)
  const difference = currentNum - previousNum;
  
  // 이전값보다 10 초과 증가하면 파란색
  if (difference > 10) {
    return '#0000ff';  // 파란색 (10 초과 증가)
  } 
  // 이전값보다 10 이상 감소하면 빨간색  
  else if (difference <= -10) {
    return '#ff0000';  // 빨간색 (10 이상 감소)
  } 
  // 그 외의 경우 (±10 미만 차이) 검은색
  else {
    return '#000000';  // 검은색 (±10 미만 차이)
  }
};

export const sortProductsByViewsData = (products: any[], itemViewsData: Record<string, any[]>) => {
  return products.sort((a, b) => {
    // 1차 정렬: 조회수 데이터 유무
    const aHasViews = itemViewsData[String(a.item_id)] && itemViewsData[String(a.item_id)].length > 0;
    const bHasViews = itemViewsData[String(b.item_id)] && itemViewsData[String(b.item_id)].length > 0;
    
    if (aHasViews && !bHasViews) return -1;  // a가 먼저
    if (!aHasViews && bHasViews) return 1;   // b가 먼저
    
    // 2차 정렬: 등록상품명 + 옵션명 결합 기준으로 알파벳 순서 정렬
    const aProductName = (a.item_name || '') + ' ' + (a.option_name || '');
    const bProductName = (b.item_name || '') + ' ' + (b.option_name || '');
    
    return aProductName.localeCompare(bProductName, 'ko', { numeric: true, caseFirst: 'lower' });
  });
};