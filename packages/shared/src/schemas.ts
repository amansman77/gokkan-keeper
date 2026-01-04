import { z } from 'zod';
import { CURRENCIES, GRANARY_PURPOSES, DEFAULT_OWNER } from './constants';

export const GranarySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  purpose: z.enum(GRANARY_PURPOSES),
  currency: z.enum(CURRENCIES),
  owner: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SnapshotSchema = z.object({
  id: z.string().uuid(),
  granaryId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalAmount: z.number().nonnegative(),
  availableBalance: z.number().nonnegative().optional(),
  profitLoss: z.number().optional(),
  memo: z.string().max(500).optional(),
  createdAt: z.string().datetime(),
});

export const CreateGranarySchema = z.object({
  name: z.string().min(1).max(100),
  purpose: z.enum(GRANARY_PURPOSES),
  currency: z.enum(CURRENCIES),
  owner: z.string().min(1).default(DEFAULT_OWNER),
});

export const UpdateGranarySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  purpose: z.enum(GRANARY_PURPOSES).optional(),
  currency: z.enum(CURRENCIES).optional(),
});

export const CreateSnapshotSchema = z.object({
  granaryId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalAmount: z.number().nonnegative(),
  availableBalance: z.number().nonnegative().optional(),
  profitLoss: z.number().optional(),
  memo: z.string().max(500).optional(),
});

export const UpdateSnapshotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  totalAmount: z.number().nonnegative().optional(),
  availableBalance: z.number().nonnegative().optional().nullable(),
  profitLoss: z.number().optional().nullable(),
  memo: z.string().max(500).optional().nullable(),
});

export type Granary = z.infer<typeof GranarySchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type CreateGranary = z.infer<typeof CreateGranarySchema>;
export type CreateSnapshot = z.infer<typeof CreateSnapshotSchema>;
export type UpdateGranary = z.infer<typeof UpdateGranarySchema>;
export type UpdateSnapshot = z.infer<typeof UpdateSnapshotSchema>;

