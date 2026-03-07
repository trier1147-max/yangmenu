// Global TypeScript type definitions

export interface User {
  _openid: string;
  dailyUsage: number;
  lastUsageDate: string;
  createdAt: Date;
}

export type ScanRecordStatus = "processing" | "done" | "error";

export interface ScanRecord {
  _openid: string;
  imageFileID: string;
  dishes: Dish[];
  partialDishes?: Dish[];
  status?: ScanRecordStatus;
  errorMessage?: string;
  createdAt: Date;
}

export interface Dish {
  originalName: string;
  briefCN: string;
  detail: DishDetail | null;
}

export interface DishDetail {
  description?: string;
  /** 菜品介绍：起源、特色与做法（合并展示用） */
  introduction?: string;
  ingredients: string[];
  flavor: string;
  price?: string;
  options?: DishOptionGroup[];
  dietaryTags?: string[];
  recommendation?: string;
}

export interface DishOptionGroup {
  group: string;
  rule: string;
  choices: string[];
}

export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}
