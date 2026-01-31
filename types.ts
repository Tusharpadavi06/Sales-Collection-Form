
export interface CollectionEntry {
  id: string;
  date: string;
  customerName: string;
  orderAmount: number;
  collectionAmount: number;
}

export interface WeeklySummary {
  week: number;
  orderAmount: number;
  collectionAmount: number;
}

export interface FormState {
  dateRange: { from: Date | undefined; to: Date | undefined };
  branch: string;
  employee: string;
  entries: CollectionEntry[];
}
