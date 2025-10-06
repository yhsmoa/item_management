import React from 'react';

// 🎨 버튼 타입 정의
type ButtonVariant = 'primary' | 'success' | 'info' | 'warning' | 'danger' | 'default' | 'orange';

// 🛠️ ActionButton 컴포넌트 Props 인터페이스
interface ActionButtonProps {
  /** 버튼에 표시될 텍스트 */
  children: React.ReactNode;
  /** 버튼 클릭 이벤트 핸들러 */
  onClick?: () => void;
  /** 버튼 스타일 타입 */
  variant?: ButtonVariant;
  /** 비활성화 상태 */
  disabled?: boolean;
  /** 로딩 상태 */
  loading?: boolean;
  /** 로딩 중 표시할 텍스트 */
  loadingText?: string;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 버튼 타입 (submit, button, reset) */
  type?: 'button' | 'submit' | 'reset';
}

/**
 * 🚀 재사용 가능한 액션 버튼 컴포넌트
 * 
 * @description 다양한 스타일과 상태를 지원하는 버튼 컴포넌트
 * - 6가지 버튼 스타일 (primary, success, info, warning, danger, default)
 * - 로딩 상태 지원
 * - 비활성화 상태 지원
 * - Tailwind CSS 클래스 기반 스타일링
 * 
 * @example
 * ```tsx
 * // 기본 버튼
 * <ActionButton onClick={handleClick}>클릭</ActionButton>
 * 
 * // 성공 스타일 버튼
 * <ActionButton variant="success" onClick={handleSave}>저장</ActionButton>
 * 
 * // 로딩 상태 버튼
 * <ActionButton loading={isLoading} loadingText="처리 중...">제출</ActionButton>
 * 
 * // 비활성화 버튼
 * <ActionButton disabled>비활성화</ActionButton>
 * ```
 */
const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  onClick,
  variant = 'default',
  disabled = false,
  loading = false,
  loadingText = '처리 중...',
  className = '',
  type = 'button'
}) => {
  // 🎨 버튼 스타일 클래스 생성
  const getButtonClasses = (): string => {
    const baseClasses = 'product-list-button';
    const variantClasses = `product-list-button-${variant}`;
    
    return `${baseClasses} ${variantClasses} ${className}`.trim();
  };

  // 🔧 클릭 핸들러 (로딩/비활성화 상태에서는 실행 안함)
  const handleClick = () => {
    if (!disabled && !loading && onClick) {
      onClick();
    }
  };

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled || loading}
      className={getButtonClasses()}
      aria-disabled={disabled || loading}
    >
      {loading ? loadingText : children}
    </button>
  );
};

export default ActionButton; 