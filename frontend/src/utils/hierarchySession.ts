export const LAST_HIERARCHY_DETAIL_KEY = 'lastHierarchyDetail'

const HIERARCHY_DETAIL_PATH = /^\/(?:portfolios|programs|projects)\/[^/?#]+(?:\?[^#]*)?$/

export const saveLastHierarchyDetail = (path: string) => {
  if (HIERARCHY_DETAIL_PATH.test(path)) {
    sessionStorage.setItem(LAST_HIERARCHY_DETAIL_KEY, path)
  }
}

export const getLastHierarchyDetail = (): string | null => {
  const savedPath = sessionStorage.getItem(LAST_HIERARCHY_DETAIL_KEY)
  return savedPath && HIERARCHY_DETAIL_PATH.test(savedPath) ? savedPath : null
}
