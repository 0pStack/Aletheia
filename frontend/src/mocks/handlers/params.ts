export function paramId(value: string | readonly string[] | undefined): string {
  return typeof value === 'string' ? value : ''
}
