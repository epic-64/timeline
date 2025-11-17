export interface Break {
  startDate: Date;
  endDate: Date;
}

export interface TimelineEvent {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date | null;
  color: string;
  breaks: Break[];
}
