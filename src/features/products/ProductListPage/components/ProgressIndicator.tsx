// Progress indicator component
import React from 'react';
import { Progress } from '../types';

interface ProgressIndicatorProps {
  progress: Progress | null;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ progress }) => {
  if (!progress) {
    return null;
  }

  const percentage = (progress.current / progress.total) * 100;

  return (
    <div className="product-list-progress-section">
      <div className="product-list-progress-message">{progress.message}</div>
      <div className="product-list-progress-bar">
        <div 
          className="product-list-progress-fill"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <div className="product-list-progress-text">
        {progress.current} / {progress.total} ({percentage.toFixed(1)}%)
      </div>
    </div>
  );
};

export default ProgressIndicator;