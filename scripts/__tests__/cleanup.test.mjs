import { describe, it, expect, vi } from 'vitest'
import { runCleanup } from '../cleanup-expired-accounts.mjs'

describe('runCleanup — hermetic', () => {
  it('returns correct counts and logs when users are deleted', async () => {
    const sql = vi.fn().mockResolvedValue([{ users_deleted: 2, tokens_deleted: 1 }])
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const result = await runCleanup(sql)

    expect(result).toEqual({ usersDeleted: 2, tokensDeleted: 1 })
    expect(consoleSpy).toHaveBeenCalledWith(
      'Deleted 2 expired account(s), 1 verification token(s) cleaned'
    )
    consoleSpy.mockRestore()
  })

  it('returns zero counts when nothing is deleted', async () => {
    const sql = vi.fn().mockResolvedValue([{ users_deleted: 0, tokens_deleted: 0 }])
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const result = await runCleanup(sql)

    expect(result).toEqual({ usersDeleted: 0, tokensDeleted: 0 })
    vi.restoreAllMocks()
  })

  it('propagates error thrown by sql', async () => {
    const sql = vi.fn().mockRejectedValue(new Error('DB error'))

    await expect(runCleanup(sql)).rejects.toThrow('DB error')
  })
})
