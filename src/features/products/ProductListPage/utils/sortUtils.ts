/**
 * 상품 정렬 유틸리티 함수들
 * 1. item_id 기준 정렬 (1차)
 * 2. option_name 기준 정렬 (2차)
 *    - 사이즈 순서: XS, S, M, L, XL, 2XL, 3XL, 4XL...
 *    - 숫자 기반 정렬: 44-55, 55-66 등
 *    - 색상/기타 속성 정렬
 */

// 사이즈 순서 정의 (우선순위가 높을수록 작은 숫자)
const SIZE_ORDER_MAP = {
  'XS': 1,
  'S': 2,
  'M': 3,
  'L': 4,
  'XL': 5,
  '2XL': 6,
  '3XL': 7,
  '4XL': 8,
  '5XL': 9,
  '6XL': 10,
  '7XL': 11,
  '8XL': 12,
  '9XL': 13,
  '10XL': 14
};

// 색상 순서 정의 (기본적인 색상들)
const COLOR_ORDER_MAP = {
  'white': 1,
  'black': 2,
  'gray': 3,
  'red': 4,
  'pink': 5,
  'orange': 6,
  'yellow': 7,
  'green': 8,
  'blue': 9,
  'purple': 10,
  'brown': 11,
  'beige': 12,
  'navy': 13,
  'khaki': 14
};

/**
 * option_name에서 사이즈를 추출하고 우선순위 반환
 */
function extractSizeOrder(optionName: string): number {
  if (!optionName) return 999;

  const upperOption = optionName.toUpperCase();

  // 정확한 사이즈 매칭 (단어 경계 사용)
  for (const [size, order] of Object.entries(SIZE_ORDER_MAP)) {
    // 사이즈가 단독으로 있거나 공백/특수문자로 구분된 경우
    const sizeRegex = new RegExp(`\\b${size}\\b`, 'i');
    if (sizeRegex.test(upperOption)) {
      return order;
    }
  }

  return 999; // 사이즈가 없는 경우 가장 뒤로
}

/**
 * option_name에서 숫자를 추출하고 정렬 기준 반환
 */
function extractNumericOrder(optionName: string): number {
  if (!optionName) return 999999;

  // 숫자 패턴들을 찾기
  const patterns = [
    /(\d+)-(\d+)/,    // 44-55 형태
    /(\d+)~(\d+)/,    // 44~55 형태
    /(\d+)\s*-\s*(\d+)/, // 44 - 55 형태
    /(\d+)/           // 단순 숫자
  ];

  for (const pattern of patterns) {
    const match = optionName.match(pattern);
    if (match) {
      if (match[2]) {
        // 범위 형태 (44-55): 첫 번째 숫자를 기준으로 정렬
        return parseInt(match[1]);
      } else {
        // 단순 숫자: 해당 숫자를 기준으로 정렬
        return parseInt(match[1]);
      }
    }
  }

  return 999999; // 숫자가 없는 경우
}

/**
 * option_name에서 색상을 추출하고 우선순위 반환
 */
function extractColorOrder(optionName: string): number {
  if (!optionName) return 999;

  const lowerOption = optionName.toLowerCase();

  // 색상 매칭 (단어 경계 사용)
  for (const [color, order] of Object.entries(COLOR_ORDER_MAP)) {
    const colorRegex = new RegExp(`\\b${color}\\b`, 'i');
    if (colorRegex.test(lowerOption)) {
      return order;
    }
  }

  return 999; // 정의된 색상이 없는 경우
}

/**
 * option_name의 첫 번째 단어 추출 (색상/기타 속성용)
 */
function extractFirstAttribute(optionName: string): string {
  if (!optionName) return '';

  // 공백, 하이픈, 언더스코어로 분리된 첫 번째 단어 추출
  const words = optionName.trim().split(/[\s\-_]+/);
  return words[0]?.toLowerCase() || '';
}

/**
 * 복합 정렬 로직을 위한 정렬 키 생성
 */
export function generateSortKey(optionName: string): {
  sizeOrder: number;
  numericOrder: number;
  colorOrder: number;
  firstAttribute: string;
  originalName: string;
} {
  if (!optionName) {
    return {
      sizeOrder: 999,
      numericOrder: 999999,
      colorOrder: 999,
      firstAttribute: '',
      originalName: ''
    };
  }

  return {
    sizeOrder: extractSizeOrder(optionName),
    numericOrder: extractNumericOrder(optionName),
    colorOrder: extractColorOrder(optionName),
    firstAttribute: extractFirstAttribute(optionName),
    originalName: optionName.toLowerCase()
  };
}

/**
 * 상품 배열을 정렬하는 메인 함수
 * 1차: item_id 내림차순 (최신 등록 순)
 * 2차: option_name 복합 정렬
 */
export function sortProducts(products: any[]): any[] {
  return products.sort((a, b) => {
    // 1차 정렬: item_id 내림차순 (큰 값부터)
    const itemIdA = parseInt(a.item_id) || 0;
    const itemIdB = parseInt(b.item_id) || 0;

    if (itemIdA !== itemIdB) {
      return itemIdB - itemIdA; // 내림차순으로 변경
    }

    // 2차 정렬: option_name 복합 정렬
    const keyA = generateSortKey(a.option_name || '');
    const keyB = generateSortKey(b.option_name || '');

    // 2-1: 첫 번째 속성 (색상/기타) 정렬
    if (keyA.firstAttribute !== keyB.firstAttribute) {
      // 정의된 색상이 있는 경우 색상 순서대로
      if (keyA.colorOrder !== 999 || keyB.colorOrder !== 999) {
        return keyA.colorOrder - keyB.colorOrder;
      }
      // 색상이 정의되지 않은 경우 알파벳 순서
      return keyA.firstAttribute.localeCompare(keyB.firstAttribute);
    }

    // 2-2: 사이즈 정렬 (XS, S, M, L, XL...)
    if (keyA.sizeOrder !== keyB.sizeOrder) {
      return keyA.sizeOrder - keyB.sizeOrder;
    }

    // 2-3: 숫자 정렬 (44-55, 55-66...)
    if (keyA.numericOrder !== keyB.numericOrder) {
      return keyA.numericOrder - keyB.numericOrder;
    }

    // 2-4: 마지막 수단: 원본 문자열 알파벳 순서
    return keyA.originalName.localeCompare(keyB.originalName);
  });
}

/**
 * 정렬 로직 테스트용 함수
 */
export function testSortLogic() {
  const testData = [
    { item_id: '1', option_name: 'L pink' },
    { item_id: '1', option_name: 'S pink' },
    { item_id: '1', option_name: 'M pink' },
    { item_id: '1', option_name: 'red M' },
    { item_id: '1', option_name: 'red S' },
    { item_id: '1', option_name: 'pink M' },
    { item_id: '1', option_name: 'pink S' },
    { item_id: '2', option_name: '55-66 pink' },
    { item_id: '2', option_name: '44-55 pink' },
    { item_id: '2', option_name: 'pink 55' },
    { item_id: '2', option_name: 'pink 44' }
  ];

  const sorted = sortProducts(testData);
  console.log('🔍 정렬 테스트 결과:');
  sorted.forEach((item, index) => {
    console.log(`${index + 1}. item_id: ${item.item_id}, option_name: ${item.option_name}`);
  });

  return sorted;
}