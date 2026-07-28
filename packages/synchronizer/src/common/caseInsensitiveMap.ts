export class CaseInsensitiveMap extends Map<string, string> {
  public override get(key: string): string | undefined {
    return super.get(key.toLowerCase());
  }
  public override set(key: string, value: string): this {
    return super.set(key.toLowerCase(), value);
  }
  public override has(key: string): boolean {
    return super.has(key.toLowerCase());
  }
}
