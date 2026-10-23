'use client';

import { ChartMarkup } from './chart/ChartMarkup';
import { type ChartPoint, useChart } from './chart/useChart';

export const PerformanceChart = ({ points, height, accent }: { points: ChartPoint[]; height: number | string; accent: string }) => (
  <div>
    <ChartMarkup v={useChart(points, Number(height) || 220, accent)} />
  </div>
);
