import { z } from "zod";
// •	Zod = 数据守门员
// •	所有从 DB / API 出来的数据，先过 schema
// •	防止 sync 时“脏数据炸系统”

export const CategorySchema = z.object({
   id: z.string(),
   name: z.string(),
   budget: z.number(),
   normalizedName: z.string().nullable().optional(),
   createdAt: z.string(),
   updatedAt: z.string(),
   deletedAt: z.string().nullable(),
   dirty: z.number(),     // 0 | 1（SQLite 不支持 boolean）
   version: z.number(),
   deviceId: z.string(),
   ownerKey: z.string(),
   userId: z.string().nullable(),
});

export type Category = z.infer<typeof CategorySchema>;
