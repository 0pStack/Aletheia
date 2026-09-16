export function paramId(value: string | readonly string[] | undefined): string {
  return typeof value === 'string' ? value : ''
}

export function numericParamId(value: string | readonly string[] | undefined): number {
  return Number(paramId(value))
}
