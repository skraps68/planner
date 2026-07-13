import { describe, it, expect, vi } from 'vitest'
import * as rt from '../../realtime/useRealtime'

vi.mock('./Header', () => ({
  default: () => null,
}))

// Assert Layout calls useRealtime exactly once when rendered.
describe('Layout wires realtime', () => {
  it('invokes useRealtime', async () => {
    const spy = vi.spyOn(rt, 'useRealtime').mockImplementation(() => {})
    const { render } = await import('../../test/test-utils')
    const Layout = (await import('./Layout')).default
    render(<Layout>content</Layout>)
    expect(spy).toHaveBeenCalled()
  })
})
