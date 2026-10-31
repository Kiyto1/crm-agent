// Join class names and skip empty values: cx('btn', big && 'btn--big')
export function cx(...names) {
  return names.filter(Boolean).join(' ')
}
