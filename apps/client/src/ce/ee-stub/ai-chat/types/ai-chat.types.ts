export type ChatAttachment = {
  id: string;
  name?: string;
  mimeType?: string;
  fileSize?: number;
  [key: string]: any;
};

export type PageMention = {
  id: string;
  title?: string;
  slugId?: string;
  icon?: string;
  [key: string]: any;
};
