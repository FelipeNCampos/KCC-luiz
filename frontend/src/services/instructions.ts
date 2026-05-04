import { api } from "./api";

export type FlatInstruction = {
  id: string;
  title: string;
  video_url: string | null;
  video_name: string | null;
  video_data: string | null;
  description: string;
  position: number;
  building_id: string;
  condominio_id: string;
  created_at: string;
  updated_at: string;
};

export type FlatInstructionList = {
  flat: string;
  building_id: string;
  building_name: string;
  data: FlatInstruction[];
  count: number;
};

export const instructionsService = {
  async publicFlat(flat: string) {
    const { data } = await api.get<FlatInstructionList>(`/public-instructions/${flat}`);
    return data;
  },
  async flat(flat: string) {
    const { data } = await api.get<FlatInstructionList>(`/flat-instructions/${flat}`);
    return data;
  },
  async saveFlat(flat: string, items: Array<{ id?: string; title: string; video_url?: string | null; video_name?: string | null; video_data?: string | null; description: string; position: number }>) {
    const { data } = await api.put<FlatInstructionList>(`/flat-instructions/${flat}`, { items });
    return data;
  }
};
