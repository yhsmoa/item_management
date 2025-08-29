// Statistics cards section component
import React from 'react';
import DashboardStatsCard from './DashboardStatsCard';
import { Stats } from '../utils/statsUtils';

interface StatsCardsSectionProps {
  stats: Stats;
}

export const StatsCardsSection: React.FC<StatsCardsSectionProps> = ({ stats }) => {
  return (
    <div className="product-list-stats-section">
      <div className="product-list-stats-grid">
        <DashboardStatsCard title="전체" value={stats.total} color="default" />
        <DashboardStatsCard title="아이템파너 아님" value={stats.notItemPartner} hasInfo={true} subtitle="쿠팡 배송 성장 20% 상품 中" color="orange" />
        <DashboardStatsCard title="품절" value={stats.outOfStock} color="red" />
        <DashboardStatsCard title="승인반려" value={stats.rejected} hasInfo={true} color="red" />
        <DashboardStatsCard title="판매중" value={stats.selling} color="blue" />
        <DashboardStatsCard title="임시저장" value={stats.tempSave} color="default" />
      </div>
    </div>
  );
};

export default StatsCardsSection;