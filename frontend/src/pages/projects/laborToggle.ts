import { LaborToggle } from '../../utils/forecastTransform'

export function nextToggleState(cur: LaborToggle, which: 'labor' | 'nonlabor'): LaborToggle {
  const next = which === 'labor' ? { ...cur, laborOn: !cur.laborOn } : { ...cur, nonlaborOn: !cur.nonlaborOn }
  if (!next.laborOn && !next.nonlaborOn) {
    // never both off: force the other one on
    return which === 'labor' ? { laborOn: false, nonlaborOn: true } : { laborOn: true, nonlaborOn: false }
  }
  return next
}
