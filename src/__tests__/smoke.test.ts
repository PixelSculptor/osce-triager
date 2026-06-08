import { it, expect } from 'vitest'
import { validateTestSelection } from '@/shared/lib/validator'

it('validateTestSelection is a callable function', () => {
  expect(typeof validateTestSelection).toBe('function')
})
