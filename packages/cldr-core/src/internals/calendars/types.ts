import type { NumberParams } from '../../common/private';
import type { DateTimeNode } from '../../parsing/date';

export interface DateFormatRequest {
  wrapper?: string;
  date?: readonly DateTimeNode[];
  time?: readonly DateTimeNode[];
  params: NumberParams;
}

export interface DateIntervalFormatRequest {
  date?: readonly DateTimeNode[];
  time?: readonly DateTimeNode[];
  range?: readonly DateTimeNode[];
  skeleton?: string;
  params: NumberParams;
  wrapper: string;
}
