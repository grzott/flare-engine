export type ParamValue = string;
export type Params = Record<string, ParamValue>;

export interface DeepLinkMatch {
  /** Scene or target id associated with the matched route. */
  scene: string;
  /** Parsed path + query parameters. Path params take precedence. */
  params: Params;
  /** Original URL the match was performed against. */
  url: string;
}
