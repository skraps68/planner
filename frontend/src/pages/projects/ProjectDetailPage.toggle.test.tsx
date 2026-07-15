// Focused unit test of the guard helper extracted from the page.
import { test, expect } from 'vitest'
import { nextToggleState } from './laborToggle'

test('turning off the last-on toggle flips the other on', () => {
  // start both on, turn labor off -> nonlabor stays on
  expect(nextToggleState({ laborOn: true, nonlaborOn: true }, 'labor')).toEqual({ laborOn: false, nonlaborOn: true })
  // only nonlabor on, turn nonlabor off -> labor forced on
  expect(nextToggleState({ laborOn: false, nonlaborOn: true }, 'nonlabor')).toEqual({ laborOn: true, nonlaborOn: false })
  // only labor on, turn labor off -> nonlabor forced on
  expect(nextToggleState({ laborOn: true, nonlaborOn: false }, 'labor')).toEqual({ laborOn: false, nonlaborOn: true })
})
