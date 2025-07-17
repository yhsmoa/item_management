import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { supabase } from '../../config/supabase';

/**
 * 대시보드 메인 페이지 컴포넌트
 * - 판매자의 주요 비즈니스 지표를 한눈에 볼 수 있는 대시보드
 * - 매출 현황, 주문 현황, 상품 관리 현황, 공지사항 등을 표시
 * - 상단 보드 영역과 하단 영역으로 구분
 */
const DashboardPage: React.FC = () => {
  // 월 보관료 상태
  const [totalStorageFee, setTotalStorageFee] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // 현재 로그인한 사용자 ID 가져오기
  const getCurrentUserId = (): string | null => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      return currentUser.id || currentUser.user_id || null;
    } catch (error) {
      console.error('❌ 사용자 정보 읽기 오류:', error);
      return null;
    }
  };

  // 월 보관료 합계 가져오기
  const fetchTotalStorageFee = async () => {
    try {
      setLoading(true);
      const userId = getCurrentUserId();
      
      if (!userId) {
        console.error('❌ 로그인한 사용자 정보를 찾을 수 없습니다.');
        return;
      }

      const { data, error } = await supabase
        .from('coupang_rocket_inventory')
        .select('monthly_storage_fee')
        .eq('user_id', userId)
        .gt('monthly_storage_fee', 0);

      if (error) {
        console.error('❌ 보관료 데이터 조회 오류:', error);
        return;
      }

      const total = data?.reduce((sum, item) => sum + (item.monthly_storage_fee || 0), 0) || 0;
      setTotalStorageFee(total);

    } catch (error) {
      console.error('❌ 보관료 데이터 가져오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 데이터 가져오기
  useEffect(() => {
    fetchTotalStorageFee();
  }, []);

  // 더미 데이터 - 실제 환경에서는 API에서 가져올 데이터
  const salesData = {
    todaySales: 352219,
    lastMonth: 31763440,
    salesRate: 100,
    orderCount: 289,
    completedOrders: 0,
    processingOrders: 0,
    totalOrders: 140
  };

  return (
    <DashboardContainer>
      {/* 상단 보드 영역 - 메인 대시보드 */}
      <BoardSection>
        {/* 페이지 헤더 */}
        <PageHeader>
          <HeaderTitle>대시보드</HeaderTitle>
          <HeaderSubtitle>6월 10일 오늘 매출 현황</HeaderSubtitle>
        </PageHeader>

        {/* 메인 통계 카드들 */}
        <StatsGrid>
          {/* 쿠팡 창고료 카드 */}
          <StatsCard>
            <CardHeader>
              <CardTitle>쿠팡 창고료</CardTitle>
              <CardDate>보관료 합계</CardDate>
            </CardHeader>
            <CardContent>
              <MainValue>
                {loading ? '로딩 중...' : `${totalStorageFee.toLocaleString()}원`}
              </MainValue>
              <SubText>월 보관료 전체 합계</SubText>
            </CardContent>
          </StatsCard>

          {/* 상품관리 카드 */}
          <StatsCard>
            <CardHeader>
              <CardTitle>상품관리</CardTitle>
              <StatusBadge>
                <BulletPoint />
                판매중 상품 수
              </StatusBadge>
            </CardHeader>
            <CardContent>
              <MainValue>{salesData.orderCount}</MainValue>
              <SubText>
                입시차량 상품 수: <strong>{salesData.completedOrders}</strong>
              </SubText>
              <SubText>
                승인대기 상품 수: <strong>{salesData.processingOrders}</strong>
              </SubText>
              <SubText>
                총상품 상품 수: <strong>{salesData.totalOrders}</strong>
              </SubText>
            </CardContent>
          </StatsCard>

          {/* 월 매출 현황 카드 */}
          <StatsCard>
            <CardHeader>
              <CardTitle>우수판매자</CardTitle>
              <CardDate>최근 12:51</CardDate>
            </CardHeader>
            <CardContent>
              <MainValue>{salesData.lastMonth.toLocaleString()}<span style={{fontSize: '16px'}}>/개월</span></MainValue>
              <ProgressContainer>
                <ProgressLabel>아이텐팩터 {salesData.salesRate}% / 70% 이상</ProgressLabel>
                <ProgressBar>
                  <ProgressFill percentage={salesData.salesRate} />
                </ProgressBar>
                <ProgressStatus status="good">조건 달성</ProgressStatus>
              </ProgressContainer>
            </CardContent>
          </StatsCard>

          {/* 컨버전율 카드 */}
          <StatsCard>
            <CardHeader>
              <CardTitle>판매지표</CardTitle>
              <CardDate>최근 12:51</CardDate>
            </CardHeader>
            <CardContent>
              <MetricGrid>
                <MetricItem>
                  <MetricLabel>주문율</MetricLabel>
                  <MetricValue>97.5</MetricValue>
                  <MetricStatus status="warning">⚠️</MetricStatus>
                </MetricItem>
                <MetricItem>
                  <MetricLabel>정시배송율</MetricLabel>
                  <MetricValue>100</MetricValue>
                  <MetricStatus status="good">✅</MetricStatus>
                </MetricItem>
                <MetricItem>
                  <MetricLabel>정시출고율</MetricLabel>
                  <MetricValue>100</MetricValue>
                  <MetricStatus status="good">✅</MetricStatus>
                </MetricItem>
                <MetricItem>
                  <MetricLabel>24시간 내 답변</MetricLabel>
                  <MetricValue>92.8</MetricValue>
                  <MetricStatus status="warning">⚠️</MetricStatus>
                </MetricItem>
              </MetricGrid>
            </CardContent>
          </StatsCard>
        </StatsGrid>

        {/* 프로모션 배너 */}
        <PromotionBanner>
          <BannerContent>
            <BannerIcon>📊</BannerIcon>
            <BannerText>
              <BannerTitle>한 눈에 보는 쿠팡 수수료</BannerTitle>
              <BannerSubtext>고객이 구매한 쿠팡의 가격이란</BannerSubtext>
            </BannerText>
          </BannerContent>
          <BannerProgress>
            <ProgressDot active />
            <ProgressDot />
            <ProgressDot />
            <ProgressDot />
            <ProgressDot />
          </BannerProgress>
        </PromotionBanner>
      </BoardSection>

      {/* 하단 영역 - 부가 정보 */}
      <BottomSection>
        {/* 공지사항 섹션 */}
        <NoticeSection>
          <SectionHeader>
            <SectionTitle>공지사항</SectionTitle>
            <SectionDate>최근 12:51</SectionDate>
          </SectionHeader>
          <NoticeList>
            <NoticeItem priority="high">
              <NoticeTitle>직업. 직업별 우수 평점 모니터링 결과 안내</NoticeTitle>
              <NoticeTime>08:07</NoticeTime>
            </NoticeItem>
            <NoticeItem priority="normal">
              <NoticeTitle>직업자, 월급날 놀+날일일 결제 안내</NoticeTitle>
              <NoticeTime>10:10</NoticeTime>
            </NoticeItem>
            <NoticeItem priority="normal">
              <NoticeTitle>한국페업인컨틴일회 핵심걱정을 위해폴료검수 안내</NoticeTitle>
              <NoticeTime>05:29</NoticeTime>
            </NoticeItem>
            <NoticeItem priority="normal">
              <NoticeTitle>쿠팡 우븅도츠 요청모습 정책 변경 안내</NoticeTitle>
              <NoticeTime>05:26</NoticeTime>
            </NoticeItem>
          </NoticeList>
        </NoticeSection>

        {/* 판매자 가이드 섹션 */}
        <GuideSection>
          <SectionHeader>
            <SectionTitle>판매자가이드</SectionTitle>
            <GuideCount>6/6</GuideCount>
          </SectionHeader>
          <GuideCard>
            <GuideImage>📱</GuideImage>
            <GuideContent>
              <GuideTitle>[정정] 매출최적화 광고 세팅가이드</GuideTitle>
              <GuideDescription>
                보고 만족하면 누구나 즐길 수 있고,
                자각의 가능성을 간단함니다!
              </GuideDescription>
            </GuideContent>
          </GuideCard>
        </GuideSection>
      </BottomSection>
    </DashboardContainer>
  );
};

/* ===================== 스타일드 컴포넌트 영역 ===================== */

/**
 * 대시보드 전체 컨테이너
 * - 패딩과 배경색 설정
 * - 스크롤 가능한 영역
 */
const DashboardContainer = styled.div`
  padding: 24px;
  background: #F8FAFB;
  min-height: 100%;
`;

/**
 * 상단 보드 섹션 - 메인 대시보드 영역
 * - 주요 통계와 차트가 들어가는 영역
 */
const BoardSection = styled.div`
  margin-bottom: 32px;
`;

/**
 * 페이지 헤더
 * - 페이지 제목과 부제목
 */
const PageHeader = styled.div`
  margin-bottom: 24px;
`;

/**
 * 헤더 제목
 */
const HeaderTitle = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: #1F2937;
  margin: 0 0 8px 0;
`;

/**
 * 헤더 부제목
 */
const HeaderSubtitle = styled.p`
  font-size: 16px;
  color: #6B7280;
  margin: 0;
`;

/**
 * 통계 카드 그리드
 * - 4개의 카드를 가로로 배치
 * - 반응형 레이아웃
 */
const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
`;

/**
 * 통계 카드
 * - 각각의 지표를 표시하는 카드
 * - 그림자와 호버 효과
 */
const StatsCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
`;

/**
 * 카드 헤더
 * - 제목과 날짜/상태 정보
 */
const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

/**
 * 카드 제목
 */
const CardTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin: 0;
`;

/**
 * 카드 날짜
 */
const CardDate = styled.span`
  font-size: 12px;
  color: #9CA3AF;
`;

/**
 * 상태 배지
 */
const StatusBadge = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #6B7280;
`;

/**
 * 불릿 포인트
 */
const BulletPoint = styled.div`
  width: 6px;
  height: 6px;
  background: #10B981;
  border-radius: 50%;
`;

/**
 * 카드 콘텐츠
 */
const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

/**
 * 메인 값 표시
 */
const MainValue = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: #1F2937;
`;

/**
 * 부가 텍스트
 */
const SubText = styled.div`
  font-size: 14px;
  color: #6B7280;
  
  strong {
    color: #374151;
    font-weight: 600;
  }
`;

/**
 * 진행률 컨테이너
 */
const ProgressContainer = styled.div`
  margin-top: 12px;
`;

/**
 * 진행률 라벨
 */
const ProgressLabel = styled.div`
  font-size: 12px;
  color: #6B7280;
  margin-bottom: 8px;
`;

/**
 * 진행률 바
 */
const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: #E5E7EB;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
`;

/**
 * 진행률 채움
 */
const ProgressFill = styled.div<{ percentage: number }>`
  width: ${props => props.percentage}%;
  height: 100%;
  background: #10B981;
  transition: width 0.3s ease;
`;

/**
 * 진행률 상태
 */
const ProgressStatus = styled.div<{ status: 'good' | 'warning' | 'error' }>`
  font-size: 12px;
  font-weight: 500;
  color: ${props => {
    switch (props.status) {
      case 'good': return '#10B981';
      case 'warning': return '#F59E0B';
      case 'error': return '#EF4444';
      default: return '#6B7280';
    }
  }};
`;

/**
 * 메트릭 그리드 (2x2)
 */
const MetricGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
`;

/**
 * 메트릭 아이템
 */
const MetricItem = styled.div`
  text-align: center;
`;

/**
 * 메트릭 라벨
 */
const MetricLabel = styled.div`
  font-size: 11px;
  color: #9CA3AF;
  margin-bottom: 4px;
`;

/**
 * 메트릭 값
 */
const MetricValue = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: #1F2937;
  margin-bottom: 4px;
`;

/**
 * 메트릭 상태
 */
const MetricStatus = styled.div<{ status: 'good' | 'warning' | 'error' }>`
  font-size: 12px;
`;

/**
 * 프로모션 배너
 */
const PromotionBanner = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 20px 24px;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

/**
 * 배너 콘텐츠
 */
const BannerContent = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

/**
 * 배너 아이콘
 */
const BannerIcon = styled.div`
  font-size: 40px;
`;

/**
 * 배너 텍스트
 */
const BannerText = styled.div``;

/**
 * 배너 제목
 */
const BannerTitle = styled.div`
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
`;

/**
 * 배너 부제목
 */
const BannerSubtext = styled.div`
  font-size: 14px;
  opacity: 0.9;
`;

/**
 * 배너 진행률 점들
 */
const BannerProgress = styled.div`
  display: flex;
  gap: 8px;
`;

/**
 * 진행률 점
 */
const ProgressDot = styled.div<{ active?: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.active ? 'white' : 'rgba(255, 255, 255, 0.5)'};
`;

/**
 * 하단 섹션 - 공지사항, 가이드 등
 */
const BottomSection = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

/**
 * 공지사항 섹션
 */
const NoticeSection = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

/**
 * 섹션 헤더
 */
const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #F3F4F6;
`;

/**
 * 섹션 제목
 */
const SectionTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: #1F2937;
  margin: 0;
`;

/**
 * 섹션 날짜
 */
const SectionDate = styled.span`
  font-size: 12px;
  color: #9CA3AF;
`;

/**
 * 공지사항 리스트
 */
const NoticeList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

/**
 * 공지사항 아이템
 */
const NoticeItem = styled.div<{ priority: 'high' | 'normal' }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  cursor: pointer;
  transition: background 0.2s ease;
  
  &:hover {
    background: #F9FAFB;
    margin: 0 -12px;
    padding: 12px;
    border-radius: 6px;
  }
`;

/**
 * 공지사항 제목
 */
const NoticeTitle = styled.div`
  font-size: 14px;
  color: #374151;
  flex: 1;
`;

/**
 * 공지사항 시간
 */
const NoticeTime = styled.div`
  font-size: 12px;
  color: #9CA3AF;
`;

/**
 * 가이드 섹션
 */
const GuideSection = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

/**
 * 가이드 카운트
 */
const GuideCount = styled.span`
  font-size: 12px;
  color: #6B7280;
`;

/**
 * 가이드 카드
 */
const GuideCard = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
`;

/**
 * 가이드 이미지
 */
const GuideImage = styled.div`
  width: 60px;
  height: 60px;
  background: #F3F4F6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
`;

/**
 * 가이드 콘텐츠
 */
const GuideContent = styled.div`
  flex: 1;
`;

/**
 * 가이드 제목
 */
const GuideTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #1F2937;
  margin-bottom: 8px;
`;

/**
 * 가이드 설명
 */
const GuideDescription = styled.div`
  font-size: 12px;
  color: #6B7280;
  line-height: 1.4;
`;

export default DashboardPage; 