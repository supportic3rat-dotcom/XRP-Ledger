import { chartPeriods, type ChartPeriod, type PeriodSpec } from '@xrp/providers';

/** Chart periods shown as chips. Series data comes from live market history (see ./market). */
export const PERIOD_IDS = chartPeriods.map((p) => p.id);
export const periodSpec = (id: ChartPeriod): PeriodSpec => chartPeriods.find((p) => p.id === id) ?? chartPeriods[2]!;
