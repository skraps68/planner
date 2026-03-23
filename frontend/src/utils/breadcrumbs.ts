interface BreadcrumbItem {
  label: string
  path?: string
  state?: any
}

/**
 * Truncates a breadcrumb chain at the first item whose path matches
 * the current page, preventing navigation loops in the breadcrumb trail.
 *
 * Example: if the chain is [Home, Resources, Jane Doe, Mobile App Dev]
 * and the current page is Jane Doe (/resources/123), the result is
 * [Home, Resources] — the current page will append itself as the final crumb.
 */
export function truncateAtLoop(
  items: BreadcrumbItem[],
  currentPathname: string,
): BreadcrumbItem[] {
  const loopIndex = items.findIndex(
    (item) => item.path && item.path.split('?')[0] === currentPathname,
  )
  return loopIndex >= 0 ? items.slice(0, loopIndex) : items
}
