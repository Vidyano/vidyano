/**
 * @param strict Strict parsing disables the deprecated fallback to the native Date constructor when
 * parsing a string.
 */
declare function moment(inp?: moment.MomentInput, strict?: boolean): moment.Moment;
/**
 * @param strict Strict parsing requires that the format and input match exactly, including delimiters.
 * Strict parsing is frequently the best parsing option. For more information about choosing strict vs
 * forgiving parsing, see the [parsing guide](https://momentjs.com/guides/#/parsing/).
 */
declare function moment(inp?: moment.MomentInput, format?: moment.MomentFormatSpecification, strict?: boolean): moment.Moment;
/**
 * @param strict Strict parsing requires that the format and input match exactly, including delimiters.
 * Strict parsing is frequently the best parsing option. For more information about choosing strict vs
 * forgiving parsing, see the [parsing guide](https://momentjs.com/guides/#/parsing/).
 */
declare function moment(inp?: moment.MomentInput, format?: moment.MomentFormatSpecification, language?: string, strict?: boolean): moment.Moment;

declare namespace moment {
  type RelativeTimeKey = 's' | 'ss' | 'm' | 'mm' | 'h' | 'hh' | 'd' | 'dd' | 'w' | 'ww' | 'M' | 'MM' | 'y' | 'yy';
  type CalendarKey = 'sameDay' | 'nextDay' | 'lastDay' | 'nextWeek' | 'lastWeek' | 'sameElse' | string;
  type LongDateFormatKey = 'LTS' | 'LT' | 'L' | 'LL' | 'LLL' | 'LLLL' | 'lts' | 'lt' | 'l' | 'll' | 'lll' | 'llll';

  interface Locale {
    calendar(key?: CalendarKey, m?: Moment, now?: Moment): string;

    longDateFormat(key: LongDateFormatKey): string;
    invalidDate(): string;
    ordinal(n: number): string;

    preparse(inp: string): string;
    postformat(inp: string): string;
    relativeTime(n: number, withoutSuffix: boolean,
                 key: RelativeTimeKey, isFuture: boolean): string;
    pastFuture(diff: number, absRelTime: string): string;
    set(config: Object): void;

    months(): string[];
    months(m: Moment, format?: string): string;
    monthsShort(): string[];
    monthsShort(m: Moment, format?: string): string;
    monthsParse(monthName: string, format: string, strict: boolean): number;
    monthsRegex(strict: boolean): RegExp;
    monthsShortRegex(strict: boolean): RegExp;

    week(m: Moment): number;
    firstDayOfYear(): number;
    firstDayOfWeek(): number;

    weekdays(): string[];
    weekdays(m: Moment, format?: string): string;
    weekdaysMin(): string[];
    weekdaysMin(m: Moment): string;
    weekdaysShort(): string[];
    weekdaysShort(m: Moment): string;
    weekdaysParse(weekdayName: string, format: string, strict: boolean): number;
    weekdaysRegex(strict: boolean): RegExp;
    weekdaysShortRegex(strict: boolean): RegExp;
    weekdaysMinRegex(strict: boolean): RegExp;

    isPM(input: string): boolean;
    meridiem(hour: number, minute: number, isLower: boolean): string;
  }

  interface StandaloneFormatSpec {
    format: string[];
    standalone: string[];
    isFormat?: RegExp;
  }

  interface WeekSpec {
    dow: number;
    doy?: number;
  }

  type CalendarSpecVal = string | ((m?: MomentInput, now?: Moment) => string);
  interface CalendarSpec {
    sameDay?: CalendarSpecVal;
    nextDay?: CalendarSpecVal;
    lastDay?: CalendarSpecVal;
    nextWeek?: CalendarSpecVal;
    lastWeek?: CalendarSpecVal;
    sameElse?: CalendarSpecVal;

    // any additional properties might be used with moment.calendarFormat
    [x: string]: CalendarSpecVal | undefined;
  }

  type RelativeTimeSpecVal = (
    string |
    ((n: number, withoutSuffix: boolean,
      key: RelativeTimeKey, isFuture: boolean) => string)
  );
  type RelativeTimeFuturePastVal = string | ((relTime: string) => string);

  interface RelativeTimeSpec {
    future?: RelativeTimeFuturePastVal;
    past?: RelativeTimeFuturePastVal;
    s?: RelativeTimeSpecVal;
    ss?: RelativeTimeSpecVal;
    m?: RelativeTimeSpecVal;
    mm?: RelativeTimeSpecVal;
    h?: RelativeTimeSpecVal;
    hh?: RelativeTimeSpecVal;
    d?: RelativeTimeSpecVal;
    dd?: RelativeTimeSpecVal;
    w?: RelativeTimeSpecVal;
    ww?: RelativeTimeSpecVal;
    M?: RelativeTimeSpecVal;
    MM?: RelativeTimeSpecVal;
    y?: RelativeTimeSpecVal;
    yy?: RelativeTimeSpecVal;
  }

  interface LongDateFormatSpec {
    LTS: string;
    LT: string;
    L: string;
    LL: string;
    LLL: string;
    LLLL: string;

    // lets forget for a sec that any upper/lower permutation will also work
    lts?: string;
    lt?: string;
    l?: string;
    ll?: string;
    lll?: string;
    llll?: string;
  }

  type MonthWeekdayFn = (momentToFormat: Moment, format?: string) => string;
  type WeekdaySimpleFn = (momentToFormat: Moment) => string;

  interface LocaleSpecification {
    months?: string[] | StandaloneFormatSpec | MonthWeekdayFn;
    monthsShort?: string[] | StandaloneFormatSpec | MonthWeekdayFn;

    weekdays?: string[] | StandaloneFormatSpec | MonthWeekdayFn;
    weekdaysShort?: string[] | StandaloneFormatSpec | WeekdaySimpleFn;
    weekdaysMin?: string[] | StandaloneFormatSpec | WeekdaySimpleFn;

    meridiemParse?: RegExp;
    meridiem?: (hour: number, minute:number, isLower: boolean) => string;

    isPM?: (input: string) => boolean;

    longDateFormat?: LongDateFormatSpec;
    calendar?: CalendarSpec;
    relativeTime?: RelativeTimeSpec;
    invalidDate?: string;
    ordinal?: (n: number) => string;
    ordinalParse?: RegExp;

    week?: WeekSpec;

    // Allow anything: in general any property that is passed as locale spec is
    // put in the locale object so it can be used by locale functions
    [x: string]: any;
  }

  interface MomentObjectOutput {
    years: number;
    /* One digit */
    months: number;
    /* Day of the month */
    date: number;
    hours: number;
    minutes: number;
    seconds: number;
    milliseconds: number;
  }
  interface argThresholdOpts {
    ss?: number;
    s?: number;
    m?: number;
    h?: number;
    d?: number;
    w?: number | null;
    M?: number;
  }

  interface Duration {
    clone(): Duration;

    humanize(argWithSuffix?: boolean, argThresholds?: argThresholdOpts): string;
    
    humanize(argThresholds?: argThresholdOpts): string;

    abs(): Duration;

    as(units: unitOfTime.Base): number;
    get(units: unitOfTime.Base): number;

    milliseconds(): number;
    asMilliseconds(): number;

    seconds(): number;
    asSeconds(): number;

    minutes(): number;
    asMinutes(): number;

    hours(): number;
    asHours(): number;

    days(): number;
    asDays(): number;

    weeks(): number;
    asWeeks(): number;

    months(): number;
    asMonths(): number;

    years(): number;
    asYears(): number;

    add(inp?: DurationInputArg1, unit?: DurationInputArg2): Duration;
    subtract(inp?: DurationInputArg1, unit?: DurationInputArg2): Duration;

    locale(): string;
    locale(locale: LocaleSpecifier): Duration;
    localeData(): Locale;

    toISOString(): string;
    toJSON(): string;

    isValid(): boolean;

    /**
     * @deprecated since version 2.8.0
     */
    lang(locale: LocaleSpecifier): Moment;
    /**
     * @deprecated since version 2.8.0
     */
    lang(): Locale;
    /**
     * @deprecated
     */
    toIsoString(): string;
  }

  interface MomentRelativeTime {
    future: any;
    past: any;
    s: any;
    ss: any;
    m: any;
    mm: any;
    h: any;
    hh: any;
    d: any;
    dd: any;
    M: any;
    MM: any;
    y: any;
    yy: any;
  }

  interface MomentLongDateFormat {
    L: string;
    LL: string;
    LLL: string;
    LLLL: string;
    LT: string;
    LTS: string;

    l?: string;
    ll?: string;
    lll?: string;
    llll?: string;
    lt?: string;
    lts?: string;
  }

  interface MomentParsingFlags {
    empty: boolean;
    unusedTokens: string[];
    unusedInput: string[];
    overflow: number;
    charsLeftOver: number;
    nullInput: boolean;
    invalidMonth: string | null;
    invalidFormat: boolean;
    userInvalidated: boolean;
    iso: boolean;
    parsedDateParts: any[];
    meridiem: string | null;
  }

  interface MomentParsingFlagsOpt {
    empty?: boolean;
    unusedTokens?: string[];
    unusedInput?: string[];
    overflow?: number;
    charsLeftOver?: number;
    nullInput?: boolean;
    invalidMonth?: string;
    invalidFormat?: boolean;
    userInvalidated?: boolean;
    iso?: boolean;
    parsedDateParts?: any[];
    meridiem?: string | null;
  }

  interface MomentBuiltinFormat {
    __momentBuiltinFormatBrand: any;
  }

  type MomentFormatSpecification = string | MomentBuiltinFormat | (string | MomentBuiltinFormat)[];

  namespace unitOfTime {
    type Base = (
      "year" | "years" | "y" |
      "month" | "months" | "M" |
      "week" | "weeks" | "w" |
      "day" | "days" | "d" |
      "hour" | "hours" | "h" |
      "minute" | "minutes" | "m" |
      "second" | "seconds" | "s" |
      "millisecond" | "milliseconds" | "ms"
    );

    type _quarter = "quarter" | "quarters" | "Q";
    type _isoWeek = "isoWeek" | "isoWeeks" | "W";
    type _date = "date" | "dates" | "D";
    type DurationConstructor = Base | _quarter;

    type DurationAs = Base;

    type StartOf = Base | _quarter | _isoWeek | _date | null;

    type Diff = Base | _quarter;

    type MomentConstructor = Base | _date;

    type All = Base | _quarter | _isoWeek | _date |
      "weekYear" | "weekYears" | "gg" |
      "isoWeekYear" | "isoWeekYears" | "GG" |
      "dayOfYear" | "dayOfYears" | "DDD" |
      "weekday" | "weekdays" | "e" |
      "isoWeekday" | "isoWeekdays" | "E";
  }

  interface MomentInputObject {
    years?: number;
    year?: number;
    y?: number;

    months?: number;
    month?: number;
    M?: number;

    days?: number;
    day?: number;
    d?: number;

    dates?: number;
    date?: number;
    D?: number;

    hours?: number;
    hour?: number;
    h?: number;

    minutes?: number;
    minute?: number;
    m?: number;

    seconds?: number;
    second?: number;
    s?: number;

    milliseconds?: number;
    millisecond?: number;
    ms?: number;
  }

  interface DurationInputObject extends MomentInputObject {
    quarters?: number;
    quarter?: number;
    Q?: number;

    weeks?: number;
    week?: number;
    w?: number;
  }

  interface MomentSetObject extends MomentInputObject {
    weekYears?: number;
    weekYear?: number;
    gg?: number;

    isoWeekYears?: number;
    isoWeekYear?: number;
    GG?: number;

    quarters?: number;
    quarter?: number;
    Q?: number;

    weeks?: number;
    week?: number;
    w?: number;

    isoWeeks?: number;
    isoWeek?: number;
    W?: number;

    dayOfYears?: number;
    dayOfYear?: number;
    DDD?: number;

    weekdays?: number;
    weekday?: number;
    e?: number;

    isoWeekdays?: number;
    isoWeekday?: number;
    E?: number;
  }

  interface FromTo {
    from: MomentInput;
    to: MomentInput;
  }

  type MomentInput = Moment | Date | string | number | (number | string)[] | MomentInputObject | null | undefined;
  type DurationInputArg1 = Duration | number | string | FromTo | DurationInputObject | null | undefined;
  type DurationInputArg2 = unitOfTime.DurationConstructor;
  type LocaleSpecifier = string | Moment | Duration | string[] | boolean;

  interface MomentCreationData {
    input: MomentInput;
    format?: MomentFormatSpecification;
    locale: Locale;
    isUTC: boolean;
    strict?: boolean;
  }

  interface Moment extends Object {
    format(format?: string): string;

    startOf(unitOfTime: unitOfTime.StartOf): Moment;
    endOf(unitOfTime: unitOfTime.StartOf): Moment;

    add(amount?: DurationInputArg1, unit?: DurationInputArg2): Moment;
    /**
     * @deprecated reverse syntax
     */
    add(unit: unitOfTime.DurationConstructor, amount: number|string): Moment;

    subtract(amount?: DurationInputArg1, unit?: DurationInputArg2): Moment;
    /**
     * @deprecated reverse syntax
     */
    subtract(unit: unitOfTime.DurationConstructor, amount: number|string): Moment;

    calendar(): string;
    calendar(formats: CalendarSpec): string;
    calendar(time?: MomentInput, formats?: CalendarSpec): string;

    clone(): Moment;

    /**
     * @return Unix timestamp in milliseconds
     */
    valueOf(): number;

    // current date/time in local mode
    local(keepLocalTime?: boolean): Moment;
    isLocal(): boolean;

    // current date/time in UTC mode
    utc(keepLocalTime?: boolean): Moment;
    isUTC(): boolean;
    /**
     * @deprecated use isUTC
     */
    isUtc(): boolean;

    parseZone(): Moment;
    isValid(): boolean;
    invalidAt(): number;

    hasAlignedHourOffset(other?: MomentInput): boolean;

    creationData(): MomentCreationData;
    parsingFlags(): MomentParsingFlags;

    year(y: number): Moment;
    year(): number;
    /**
     * @deprecated use year(y)
     */
    years(y: number): Moment;
    /**
     * @deprecated use year()
     */
    years(): number;
    quarter(): number;
    quarter(q: number): Moment;
    quarters(): number;
    quarters(q: number): Moment;
    month(M: number|string): Moment;
    month(): number;
    /**
     * @deprecated use month(M)
     */
    months(M: number|string): Moment;
    /**
     * @deprecated use month()
     */
    months(): number;
    day(d: number|string): Moment;
    day(): number;
    days(d: number|string): Moment;
    days(): number;
    date(d: number): Moment;
    date(): number;
    /**
     * @deprecated use date(d)
     */
    dates(d: number): Moment;
    /**
     * @deprecated use date()
     */
    dates(): number;
    hour(h: number): Moment;
    hour(): number;
    hours(h: number): Moment;
    hours(): number;
    minute(m: number): Moment;
    minute(): number;
    minutes(m: number): Moment;
    minutes(): number;
    second(s: number): Moment;
    second(): number;
    seconds(s: number): Moment;
    seconds(): number;
    millisecond(ms: number): Moment;
    millisecond(): number;
    milliseconds(ms: number): Moment;
    milliseconds(): number;
    weekday(): number;
    weekday(d: number): Moment;
    isoWeekday(): number;
    isoWeekday(d: number|string): Moment;
    weekYear(): number;
    weekYear(d: number): Moment;
    isoWeekYear(): number;
    isoWeekYear(d: number): Moment;
    week(): number;
    week(d: number): Moment;
    weeks(): number;
    weeks(d: number): Moment;
    isoWeek(): number;
    isoWeek(d: number): Moment;
    isoWeeks(): number;
    isoWeeks(d: number): Moment;
    weeksInYear(): number;
    isoWeeksInYear(): number;
    isoWeeksInISOWeekYear(): number;
    dayOfYear(): number;
    dayOfYear(d: number): Moment;

    from(inp: MomentInput, suffix?: boolean): string;
    to(inp: MomentInput, suffix?: boolean): string;
    fromNow(withoutSuffix?: boolean): string;
    toNow(withoutPrefix?: boolean): string;

    diff(b: MomentInput, unitOfTime?: unitOfTime.Diff, precise?: boolean): number;

    toArray(): [number, number, number, number, number, number, number];
    toDate(): Date;
    toISOString(keepOffset?: boolean): string;
    inspect(): string;
    toJSON(): string;
    unix(): number;

    isLeapYear(): boolean;
    /**
     * @deprecated in favor of utcOffset
     */
    zone(): number;
    zone(b: number|string): Moment;
    utcOffset(): number;
    utcOffset(b: number|string, keepLocalTime?: boolean): Moment;
    isUtcOffset(): boolean;
    daysInMonth(): number;
    isDST(): boolean;

    zoneAbbr(): string;
    zoneName(): string;

    isBefore(inp?: MomentInput, granularity?: unitOfTime.StartOf): boolean;
    isAfter(inp?: MomentInput, granularity?: unitOfTime.StartOf): boolean;
    isSame(inp?: MomentInput, granularity?: unitOfTime.StartOf): boolean;
    isSameOrAfter(inp?: MomentInput, granularity?: unitOfTime.StartOf): boolean;
    isSameOrBefore(inp?: MomentInput, granularity?: unitOfTime.StartOf): boolean;
    isBetween(a: MomentInput, b: MomentInput, granularity?: unitOfTime.StartOf, inclusivity?: "()" | "[)" | "(]" | "[]"): boolean;

    /**
     * @deprecated as of 2.8.0, use locale
     */
    lang(language: LocaleSpecifier): Moment;
    /**
     * @deprecated as of 2.8.0, use locale
     */
    lang(): Locale;

    locale(): string;
    locale(locale: LocaleSpecifier): Moment;

    localeData(): Locale;

    /**
     * @deprecated no reliable implementation
     */
    isDSTShifted(): boolean;

    // NOTE(constructor): Same as moment constructor
    /**
     * @deprecated as of 2.7.0, use moment.min/max
     */
    max(inp?: MomentInput, format?: MomentFormatSpecification, strict?: boolean): Moment;
    /**
     * @deprecated as of 2.7.0, use moment.min/max
     */
    max(inp?: MomentInput, format?: MomentFormatSpecification, language?: string, strict?: boolean): Moment;

    // NOTE(constructor): Same as moment constructor
    /**
     * @deprecated as of 2.7.0, use moment.min/max
     */
    min(inp?: MomentInput, format?: MomentFormatSpecification, strict?: boolean): Moment;
    /**
     * @deprecated as of 2.7.0, use moment.min/max
     */
    min(inp?: MomentInput, format?: MomentFormatSpecification, language?: string, strict?: boolean): Moment;

    get(unit: unitOfTime.All): number;
    set(unit: unitOfTime.All, value: number): Moment;
    set(objectLiteral: MomentSetObject): Moment;

    toObject(): MomentObjectOutput;
  }

  export var version: string;
  export var fn: Moment;

  // NOTE(constructor): Same as moment constructor
  /**
   * @param strict Strict parsing disables the deprecated fallback to the native Date constructor when
   * parsing a string.
   */
  export function utc(inp?: MomentInput, strict?: boolean): Moment;
  /**
   * @param strict Strict parsing requires that the format and input match exactly, including delimiters.
   * Strict parsing is frequently the best parsing option. For more information about choosing strict vs
   * forgiving parsing, see the [parsing guide](https://momentjs.com/guides/#/parsing/).
   */
  export function utc(inp?: MomentInput, format?: MomentFormatSpecification, strict?: boolean): Moment;
  /**
   * @param strict Strict parsing requires that the format and input match exactly, including delimiters.
   * Strict parsing is frequently the best parsing option. For more information about choosing strict vs
   * forgiving parsing, see the [parsing guide](https://momentjs.com/guides/#/parsing/).
   */
  export function utc(inp?: MomentInput, format?: MomentFormatSpecification, language?: string, strict?: boolean): Moment;

  export function unix(timestamp: number): Moment;

  export function invalid(flags?: MomentParsingFlagsOpt): Moment;
  export function isMoment(m: any): m is Moment;
  export function isDate(m: any): m is Date;
  export function isDuration(d: any): d is Duration;

  /**
   * @deprecated in 2.8.0
   */
  export function lang(language?: string): string;
  /**
   * @deprecated in 2.8.0
   */
  export function lang(language?: string, definition?: Locale): string;

  export function locale(language?: string): string;
  export function locale(language?: string[]): string;
  export function locale(language?: string, definition?: LocaleSpecification | null | undefined): string;

  export function localeData(key?: string | string[]): Locale;

  export function duration(inp?: DurationInputArg1, unit?: DurationInputArg2): Duration;

  // NOTE(constructor): Same as moment constructor
  export function parseZone(inp?: MomentInput, format?: MomentFormatSpecification, strict?: boolean): Moment;
  export function parseZone(inp?: MomentInput, format?: MomentFormatSpecification, language?: string, strict?: boolean): Moment;

  export function months(): string[];
  export function months(index: number): string;
  export function months(format: string): string[];
  export function months(format: string, index: number): string;
  export function monthsShort(): string[];
  export function monthsShort(index: number): string;
  export function monthsShort(format: string): string[];
  export function monthsShort(format: string, index: number): string;

  export function weekdays(): string[];
  export function weekdays(index: number): string;
  export function weekdays(format: string): string[];
  export function weekdays(format: string, index: number): string;
  export function weekdays(localeSorted: boolean): string[];
  export function weekdays(localeSorted: boolean, index: number): string;
  export function weekdays(localeSorted: boolean, format: string): string[];
  export function weekdays(localeSorted: boolean, format: string, index: number): string;
  export function weekdaysShort(): string[];
  export function weekdaysShort(index: number): string;
  export function weekdaysShort(format: string): string[];
  export function weekdaysShort(format: string, index: number): string;
  export function weekdaysShort(localeSorted: boolean): string[];
  export function weekdaysShort(localeSorted: boolean, index: number): string;
  export function weekdaysShort(localeSorted: boolean, format: string): string[];
  export function weekdaysShort(localeSorted: boolean, format: string, index: number): string;
  export function weekdaysMin(): string[];
  export function weekdaysMin(index: number): string;
  export function weekdaysMin(format: string): string[];
  export function weekdaysMin(format: string, index: number): string;
  export function weekdaysMin(localeSorted: boolean): string[];
  export function weekdaysMin(localeSorted: boolean, index: number): string;
  export function weekdaysMin(localeSorted: boolean, format: string): string[];
  export function weekdaysMin(localeSorted: boolean, format: string, index: number): string;

  export function min(moments: Moment[]): Moment;
  export function min(...moments: Moment[]): Moment;
  export function max(moments: Moment[]): Moment;
  export function max(...moments: Moment[]): Moment;

  /**
   * Returns unix time in milliseconds. Overwrite for profit.
   */
  export function now(): number;

  export function defineLocale(language: string, localeSpec: LocaleSpecification | null): Locale;
  export function updateLocale(language: string, localeSpec: LocaleSpecification | null): Locale;

  export function locales(): string[];

  export function normalizeUnits(unit: unitOfTime.All): string;
  export function relativeTimeThreshold(threshold: string): number | boolean;
  export function relativeTimeThreshold(threshold: string, limit: number): boolean;
  export function relativeTimeRounding(fn: (num: number) => number): boolean;
  export function relativeTimeRounding(): (num: number) => number;
  export function calendarFormat(m: Moment, now: Moment): string;

  export function parseTwoDigitYear(input: string): number;
  /**
   * Constant used to enable explicit ISO_8601 format parsing.
   */
  export var ISO_8601: MomentBuiltinFormat;
  export var RFC_2822: MomentBuiltinFormat;

  export var defaultFormat: string;
  export var defaultFormatUtc: string;

  export var suppressDeprecationWarnings: boolean;
  export var deprecationHandler: ((name: string | null, msg: string) => void) | null | undefined;

  export var HTML5_FMT: {
    DATETIME_LOCAL: string,
    DATETIME_LOCAL_SECONDS: string,
    DATETIME_LOCAL_MS: string,
    DATE: string,
    TIME: string,
    TIME_SECONDS: string,
    TIME_MS: string,
    WEEK: string,
    MONTH: string
  };

}

declare namespace moment_d {
  export { moment as default };
}

// Type definitions for bignumber.js >=8.1.0
// Project: https://github.com/MikeMcl/bignumber.js
// Definitions by: Michael Mclaughlin <https://github.com/MikeMcl>
// Definitions: https://github.com/MikeMcl/bignumber.js



declare namespace BigNumber {

  /** See `BigNumber.config` (alias `BigNumber.set`) and `BigNumber.clone`. */
  interface Config {

    /**
     * An integer, 0 to 1e+9. Default value: 20.
     *
     * The maximum number of decimal places of the result of operations involving division, i.e.
     * division, square root and base conversion operations, and exponentiation when the exponent is
     * negative.
     *
     * ```ts
     * BigNumber.config({ DECIMAL_PLACES: 5 })
     * BigNumber.set({ DECIMAL_PLACES: 5 })
     * ```
     */
    DECIMAL_PLACES?: number;

    /**
     * An integer, 0 to 8. Default value: `BigNumber.ROUND_HALF_UP` (4).
     *
     * The rounding mode used in operations that involve division (see `DECIMAL_PLACES`) and the
     * default rounding mode of the `decimalPlaces`, `precision`, `toExponential`, `toFixed`,
     * `toFormat` and `toPrecision` methods.
     *
     * The modes are available as enumerated properties of the BigNumber constructor.
     *
     * ```ts
     * BigNumber.config({ ROUNDING_MODE: 0 })
     * BigNumber.set({ ROUNDING_MODE: BigNumber.ROUND_UP })
     * ```
     */
    ROUNDING_MODE?: BigNumber.RoundingMode;

    /**
     * An integer, 0 to 1e+9, or an array, [-1e+9 to 0, 0 to 1e+9].
     * Default value: `[-7, 20]`.
     *
     * The exponent value(s) at which `toString` returns exponential notation.
     *
     * If a single number is assigned, the value is the exponent magnitude.
     *
     * If an array of two numbers is assigned then the first number is the negative exponent value at
     * and beneath which exponential notation is used, and the second number is the positive exponent
     * value at and above which exponential notation is used.
     *
     * For example, to emulate JavaScript numbers in terms of the exponent values at which they begin
     * to use exponential notation, use `[-7, 20]`.
     *
     * ```ts
     * BigNumber.config({ EXPONENTIAL_AT: 2 })
     * new BigNumber(12.3)         // '12.3'        e is only 1
     * new BigNumber(123)          // '1.23e+2'
     * new BigNumber(0.123)        // '0.123'       e is only -1
     * new BigNumber(0.0123)       // '1.23e-2'
     *
     * BigNumber.config({ EXPONENTIAL_AT: [-7, 20] })
     * new BigNumber(123456789)    // '123456789'   e is only 8
     * new BigNumber(0.000000123)  // '1.23e-7'
     *
     * // Almost never return exponential notation:
     * BigNumber.config({ EXPONENTIAL_AT: 1e+9 })
     *
     * // Always return exponential notation:
     * BigNumber.config({ EXPONENTIAL_AT: 0 })
     * ```
     *
     * Regardless of the value of `EXPONENTIAL_AT`, the `toFixed` method will always return a value in
     * normal notation and the `toExponential` method will always return a value in exponential form.
     * Calling `toString` with a base argument, e.g. `toString(10)`, will also always return normal
     * notation.
     */
    EXPONENTIAL_AT?: number | [number, number];

    /**
     * An integer, magnitude 1 to 1e+9, or an array, [-1e+9 to -1, 1 to 1e+9].
     * Default value: `[-1e+9, 1e+9]`.
     *
     * The exponent value(s) beyond which overflow to Infinity and underflow to zero occurs.
     *
     * If a single number is assigned, it is the maximum exponent magnitude: values wth a positive
     * exponent of greater magnitude become Infinity and those with a negative exponent of greater
     * magnitude become zero.
     *
     * If an array of two numbers is assigned then the first number is the negative exponent limit and
     * the second number is the positive exponent limit.
     *
     * For example, to emulate JavaScript numbers in terms of the exponent values at which they
     * become zero and Infinity, use [-324, 308].
     *
     * ```ts
     * BigNumber.config({ RANGE: 500 })
     * BigNumber.config().RANGE     // [ -500, 500 ]
     * new BigNumber('9.999e499')   // '9.999e+499'
     * new BigNumber('1e500')       // 'Infinity'
     * new BigNumber('1e-499')      // '1e-499'
     * new BigNumber('1e-500')      // '0'
     *
     * BigNumber.config({ RANGE: [-3, 4] })
     * new BigNumber(99999)         // '99999'      e is only 4
     * new BigNumber(100000)        // 'Infinity'   e is 5
     * new BigNumber(0.001)         // '0.01'       e is only -3
     * new BigNumber(0.0001)        // '0'          e is -4
     * ```
     * The largest possible magnitude of a finite BigNumber is 9.999...e+1000000000.
     * The smallest possible magnitude of a non-zero BigNumber is 1e-1000000000.
     */
    RANGE?: number | [number, number];

    /**
     * A boolean: `true` or `false`. Default value: `false`.
     *
     * The value that determines whether cryptographically-secure pseudo-random number generation is
     * used. If `CRYPTO` is set to true then the random method will generate random digits using
     * `crypto.getRandomValues` in browsers that support it, or `crypto.randomBytes` if using a
     * version of Node.js that supports it.
     *
     * If neither function is supported by the host environment then attempting to set `CRYPTO` to
     * `true` will fail and an exception will be thrown.
     *
     * If `CRYPTO` is `false` then the source of randomness used will be `Math.random` (which is
     * assumed to generate at least 30 bits of randomness).
     *
     * See `BigNumber.random`.
     *
     * ```ts
     * // Node.js
     * global.crypto = require('crypto')
     *
     * BigNumber.config({ CRYPTO: true })
     * BigNumber.config().CRYPTO       // true
     * BigNumber.random()              // 0.54340758610486147524
     * ```
     */
    CRYPTO?: boolean;

    /**
     * An integer, 0, 1, 3, 6 or 9. Default value: `BigNumber.ROUND_DOWN` (1).
     *
     * The modulo mode used when calculating the modulus: `a mod n`.
     * The quotient, `q = a / n`, is calculated according to the `ROUNDING_MODE` that corresponds to
     * the chosen `MODULO_MODE`.
     * The remainder, `r`, is calculated as: `r = a - n * q`.
     *
     * The modes that are most commonly used for the modulus/remainder operation are shown in the
     * following table. Although the other rounding modes can be used, they may not give useful
     * results.
     *
     * Property           | Value | Description
     * :------------------|:------|:------------------------------------------------------------------
     *  `ROUND_UP`        |   0   | The remainder is positive if the dividend is negative.
     *  `ROUND_DOWN`      |   1   | The remainder has the same sign as the dividend.
     *                    |       | Uses 'truncating division' and matches JavaScript's `%` operator .
     *  `ROUND_FLOOR`     |   3   | The remainder has the same sign as the divisor.
     *                    |       | This matches Python's `%` operator.
     *  `ROUND_HALF_EVEN` |   6   | The IEEE 754 remainder function.
     *  `EUCLID`          |   9   | The remainder is always positive.
     *                    |       | Euclidian division: `q = sign(n) * floor(a / abs(n))`
     *
     * The rounding/modulo modes are available as enumerated properties of the BigNumber constructor.
     *
     * See `modulo`.
     *
     * ```ts
     * BigNumber.config({ MODULO_MODE: BigNumber.EUCLID })
     * BigNumber.set({ MODULO_MODE: 9 })          // equivalent
     * ```
     */
    MODULO_MODE?: BigNumber.ModuloMode;

    /**
     * An integer, 0 to 1e+9. Default value: 0.
     *
     * The maximum precision, i.e. number of significant digits, of the result of the power operation
     * - unless a modulus is specified.
     *
     * If set to 0, the number of significant digits will not be limited.
     *
     * See `exponentiatedBy`.
     *
     * ```ts
     * BigNumber.config({ POW_PRECISION: 100 })
     * ```
     */
    POW_PRECISION?: number;

    /**
     * An object including any number of the properties shown below.
     *
     * The object configures the format of the string returned by the `toFormat` method.
     * The example below shows the properties of the object that are recognised, and
     * their default values.
     *
     * Unlike the other configuration properties, the values of the properties of the `FORMAT` object
     * will not be checked for validity - the existing object will simply be replaced by the object
     * that is passed in.
     *
     * See `toFormat`.
     *
     * ```ts
     * BigNumber.config({
     *   FORMAT: {
     *     // string to prepend
     *     prefix: '',
     *     // the decimal separator
     *     decimalSeparator: '.',
     *     // the grouping separator of the integer part
     *     groupSeparator: ',',
     *     // the primary grouping size of the integer part
     *     groupSize: 3,
     *     // the secondary grouping size of the integer part
     *     secondaryGroupSize: 0,
     *     // the grouping separator of the fraction part
     *     fractionGroupSeparator: ' ',
     *     // the grouping size of the fraction part
     *     fractionGroupSize: 0,
     *     // string to append
     *     suffix: ''
     *   }
     * })
     * ```
     */
    FORMAT?: BigNumber.Format;

    /**
     * The alphabet used for base conversion. The length of the alphabet corresponds to the maximum
     * value of the base argument that can be passed to the BigNumber constructor or `toString`.
     *
     * Default value: `'0123456789abcdefghijklmnopqrstuvwxyz'`.
     *
     * There is no maximum length for the alphabet, but it must be at least 2 characters long,
     * and it must not contain whitespace or a repeated character, or the sign indicators '+' and
     * '-', or the decimal separator '.'.
     *
     * ```ts
     * // duodecimal (base 12)
     * BigNumber.config({ ALPHABET: '0123456789TE' })
     * x = new BigNumber('T', 12)
     * x.toString()                // '10'
     * x.toString(12)              // 'T'
     * ```
     */
    ALPHABET?: string;
  }

  /** See `FORMAT` and `toFormat`. */
  interface Format {

    /** The string to prepend. */
    prefix?: string;

    /** The decimal separator. */
    decimalSeparator?: string;

    /** The grouping separator of the integer part. */
    groupSeparator?: string;

    /** The primary grouping size of the integer part. */
    groupSize?: number;

    /** The secondary grouping size of the integer part. */
    secondaryGroupSize?: number;

    /** The grouping separator of the fraction part. */
    fractionGroupSeparator?: string;

    /** The grouping size of the fraction part. */
    fractionGroupSize?: number;

    /** The string to append. */
    suffix?: string;
  }

  interface Instance {

    /** The coefficient of the value of this BigNumber, an array of base 1e14 integer numbers, or null. */
    readonly c: number[] | null;

    /** The exponent of the value of this BigNumber, an integer number, -1000000000 to 1000000000, or null. */
    readonly e: number | null;

    /** The sign of the value of this BigNumber, -1, 1, or null. */
    readonly s: number | null;

    [key: string]: any;
  }

  type Constructor = typeof BigNumber;
  type ModuloMode = 0 | 1 | 3 | 6 | 9;
  type RoundingMode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  type Value = string | number | Instance;
}

declare class BigNumber implements BigNumber.Instance {

  /** Used internally to identify a BigNumber instance. */
  private readonly _isBigNumber: true;

  /** The coefficient of the value of this BigNumber, an array of base 1e14 integer numbers, or null. */
  readonly c: number[] | null;

  /** The exponent of the value of this BigNumber, an integer number, -1000000000 to 1000000000, or null. */
  readonly e: number | null;

  /** The sign of the value of this BigNumber, -1, 1, or null. */
  readonly s: number | null;

  /**
   * Returns a new instance of a BigNumber object with value `n`, where `n` is a numeric value in
   * the specified `base`, or base 10 if `base` is omitted or is `null` or `undefined`.
   *
   * ```ts
   * x = new BigNumber(123.4567)              // '123.4567'
   * // 'new' is optional
   * y = BigNumber(x)                         // '123.4567'
   * ```
   *
   * If `n` is a base 10 value it can be in normal (fixed-point) or exponential notation.
   * Values in other bases must be in normal notation. Values in any base can have fraction digits,
   * i.e. digits after the decimal point.
   *
   * ```ts
   * new BigNumber(43210)                     // '43210'
   * new BigNumber('4.321e+4')                // '43210'
   * new BigNumber('-735.0918e-430')          // '-7.350918e-428'
   * new BigNumber('123412421.234324', 5)     // '607236.557696'
   * ```
   *
   * Signed `0`, signed `Infinity` and `NaN` are supported.
   *
   * ```ts
   * new BigNumber('-Infinity')               // '-Infinity'
   * new BigNumber(NaN)                       // 'NaN'
   * new BigNumber(-0)                        // '0'
   * new BigNumber('.5')                      // '0.5'
   * new BigNumber('+2')                      // '2'
   * ```
   *
   * String values in hexadecimal literal form, e.g. `'0xff'`, are valid, as are string values with
   * the octal and binary prefixs `'0o'` and `'0b'`. String values in octal literal form without the
   * prefix will be interpreted as decimals, e.g. `'011'` is interpreted as 11, not 9.
   *
   * ```ts
   * new BigNumber(-10110100.1, 2)            // '-180.5'
   * new BigNumber('-0b10110100.1')           // '-180.5'
   * new BigNumber('ff.8', 16)                // '255.5'
   * new BigNumber('0xff.8')                  // '255.5'
   * ```
   *
   * If a base is specified, `n` is rounded according to the current `DECIMAL_PLACES` and
   * `ROUNDING_MODE` settings. This includes base 10, so don't include a `base` parameter for decimal
   * values unless this behaviour is desired.
   *
   * ```ts
   * BigNumber.config({ DECIMAL_PLACES: 5 })
   * new BigNumber(1.23456789)                // '1.23456789'
   * new BigNumber(1.23456789, 10)            // '1.23457'
   * ```
   *
   * An error is thrown if `base` is invalid.
   *
   * There is no limit to the number of digits of a value of type string (other than that of
   * JavaScript's maximum array size). See `RANGE` to set the maximum and minimum possible exponent
   * value of a BigNumber.
   *
   * ```ts
   * new BigNumber('5032485723458348569331745.33434346346912144534543')
   * new BigNumber('4.321e10000000')
   * ```
   *
   * BigNumber `NaN` is returned if `n` is invalid (unless `BigNumber.DEBUG` is `true`, see below).
   *
   * ```ts
   * new BigNumber('.1*')                    // 'NaN'
   * new BigNumber('blurgh')                 // 'NaN'
   * new BigNumber(9, 2)                     // 'NaN'
   * ```
   *
   * To aid in debugging, if `BigNumber.DEBUG` is `true` then an error will be thrown on an
   * invalid `n`. An error will also be thrown if `n` is of type number with more than 15
   * significant digits, as calling `toString` or `valueOf` on these numbers may not result in the
   * intended value.
   *
   * ```ts
   * console.log(823456789123456.3)          //  823456789123456.2
   * new BigNumber(823456789123456.3)        // '823456789123456.2'
   * BigNumber.DEBUG = true
   * // 'Error: Number has more than 15 significant digits'
   * new BigNumber(823456789123456.3)
   * // 'Error: Not a base 2 number'
   * new BigNumber(9, 2)
   * ```
   *
   * A BigNumber can also be created from an object literal.
   * Use `isBigNumber` to check that it is well-formed.
   *
   * ```ts
   * new BigNumber({ s: 1, e: 2, c: [ 777, 12300000000000 ], _isBigNumber: true })    // '777.123'
   * ```
   *
   * @param n A numeric value.
   * @param base The base of `n`, integer, 2 to 36 (or `ALPHABET.length`, see `ALPHABET`).
   */
  constructor(n: BigNumber.Value, base?: number);

  /**
   * Returns a BigNumber whose value is the absolute value, i.e. the magnitude, of the value of this
   * BigNumber.
   *
   * The return value is always exact and unrounded.
   *
   * ```ts
   * x = new BigNumber(-0.8)
   * x.absoluteValue()           // '0.8'
   * ```
   */
  absoluteValue(): BigNumber;

  /**
   * Returns a BigNumber whose value is the absolute value, i.e. the magnitude, of the value of this
   * BigNumber.
   *
   * The return value is always exact and unrounded.
   *
   * ```ts
   * x = new BigNumber(-0.8)
   * x.abs()                     // '0.8'
   * ```
   */
  abs(): BigNumber;

  /**
   *  Returns |                                                               |
   * :-------:|:--------------------------------------------------------------|
   *     1    | If the value of this BigNumber is greater than the value of `n`
   *    -1    | If the value of this BigNumber is less than the value of `n`
   *     0    | If this BigNumber and `n` have the same value
   *  `null`  | If the value of either this BigNumber or `n` is `NaN`
   *
   * ```ts
   *
   * x = new BigNumber(Infinity)
   * y = new BigNumber(5)
   * x.comparedTo(y)                 // 1
   * x.comparedTo(x.minus(1))        // 0
   * y.comparedTo(NaN)               // null
   * y.comparedTo('110', 2)          // -1
   * ```
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  comparedTo(n: BigNumber.Value, base?: number): number;

  /**
   * Returns a BigNumber whose value is the value of this BigNumber rounded by rounding mode
   * `roundingMode` to a maximum of `decimalPlaces` decimal places.
   *
   * If `decimalPlaces` is omitted, or is `null` or `undefined`, the return value is the number of
   * decimal places of the value of this BigNumber, or `null` if the value of this BigNumber is
   * ±`Infinity` or `NaN`.
   *
   * If `roundingMode` is omitted, or is `null` or `undefined`, `ROUNDING_MODE` is used.
   *
   * Throws if `decimalPlaces` or `roundingMode` is invalid.
   *
   * ```ts
   * x = new BigNumber(1234.56)
   * x.decimalPlaces()                      // 2
   * x.decimalPlaces(1)                     // '1234.6'
   * x.decimalPlaces(2)                     // '1234.56'
   * x.decimalPlaces(10)                    // '1234.56'
   * x.decimalPlaces(0, 1)                  // '1234'
   * x.decimalPlaces(0, 6)                  // '1235'
   * x.decimalPlaces(1, 1)                  // '1234.5'
   * x.decimalPlaces(1, BigNumber.ROUND_HALF_EVEN)     // '1234.6'
   * x                                      // '1234.56'
   * y = new BigNumber('9.9e-101')
   * y.decimalPlaces()                      // 102
   * ```
   *
   * @param [decimalPlaces] Decimal places, integer, 0 to 1e+9.
   * @param [roundingMode] Rounding mode, integer, 0 to 8.
   */
  decimalPlaces(): number | null;
  decimalPlaces(decimalPlaces: number, roundingMode?: BigNumber.RoundingMode): BigNumber;

  /**
   * Returns a BigNumber whose value is the value of this BigNumber rounded by rounding mode
   * `roundingMode` to a maximum of `decimalPlaces` decimal places.
   *
   * If `decimalPlaces` is omitted, or is `null` or `undefined`, the return value is the number of
   * decimal places of the value of this BigNumber, or `null` if the value of this BigNumber is
   * ±`Infinity` or `NaN`.
   *
   * If `roundingMode` is omitted, or is `null` or `undefined`, `ROUNDING_MODE` is used.
   *
   * Throws if `decimalPlaces` or `roundingMode` is invalid.
   *
   * ```ts
   * x = new BigNumber(1234.56)
   * x.dp()                                 // 2
   * x.dp(1)                                // '1234.6'
   * x.dp(2)                                // '1234.56'
   * x.dp(10)                               // '1234.56'
   * x.dp(0, 1)                             // '1234'
   * x.dp(0, 6)                             // '1235'
   * x.dp(1, 1)                             // '1234.5'
   * x.dp(1, BigNumber.ROUND_HALF_EVEN)     // '1234.6'
   * x                                      // '1234.56'
   * y = new BigNumber('9.9e-101')
   * y.dp()                                 // 102
   * ```
   *
   * @param [decimalPlaces] Decimal places, integer, 0 to 1e+9.
   * @param [roundingMode] Rounding mode, integer, 0 to 8.
   */
  dp(): number | null;
  dp(decimalPlaces: number, roundingMode?: BigNumber.RoundingMode): BigNumber;

  /**
   * Returns a BigNumber whose value is the value of this BigNumber divided by `n`, rounded
   * according to the current `DECIMAL_PLACES` and `ROUNDING_MODE` settings.
   *
   * ```ts
   * x = new BigNumber(355)
   * y = new BigNumber(113)
   * x.dividedBy(y)                  // '3.14159292035398230088'
   * x.dividedBy(5)                  // '71'
   * x.dividedBy(47, 16)             // '5'
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  dividedBy(n: BigNumber.Value, base?: number): BigNumber;

  /**
   * Returns a BigNumber whose value is the value of this BigNumber divided by `n`, rounded
   * according to the current `DECIMAL_PLACES` and `ROUNDING_MODE` settings.
   *
   * ```ts
   * x = new BigNumber(355)
   * y = new BigNumber(113)
   * x.div(y)                    // '3.14159292035398230088'
   * x.div(5)                    // '71'
   * x.div(47, 16)               // '5'
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  div(n: BigNumber.Value, base?: number): BigNumber;

  /**
   * Returns a BigNumber whose value is the integer part of dividing the value of this BigNumber by
   * `n`.
   *
   * ```ts
   * x = new BigNumber(5)
   * y = new BigNumber(3)
   * x.dividedToIntegerBy(y)              // '1'
   * x.dividedToIntegerBy(0.7)            // '7'
   * x.dividedToIntegerBy('0.f', 16)      // '5'
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  dividedToIntegerBy(n: BigNumber.Value, base?: number): BigNumber;

  /**
   * Returns a BigNumber whose value is the integer part of dividing the value of this BigNumber by
   * `n`.
   *
   * ```ts
   * x = new BigNumber(5)
   * y = new BigNumber(3)
   * x.idiv(y)                       // '1'
   * x.idiv(0.7)                     // '7'
   * x.idiv('0.f', 16)               // '5'
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  idiv(n: BigNumber.Value, base?: number): BigNumber;

  /**
   * Returns a BigNumber whose value is the value of this BigNumber exponentiated by `n`, i.e.
   * raised to the power `n`, and optionally modulo a modulus `m`.
   *
   * If `n` is negative the result is rounded according to the current `DECIMAL_PLACES` and
   * `ROUNDING_MODE` settings.
   *
   * As the number of digits of the result of the power operation can grow so large so quickly,
   * e.g. 123.456**10000 has over 50000 digits, the number of significant digits calculated is
   * limited to the value of the `POW_PRECISION` setting (unless a modulus `m` is specified).
   *
   * By default `POW_PRECISION` is set to 0. This means that an unlimited number of significant
   * digits will be calculated, and that the method's performance will decrease dramatically for
   * larger exponents.
   *
   * If `m` is specified and the value of `m`, `n` and this BigNumber are integers and `n` is
   * positive, then a fast modular exponentiation algorithm is used, otherwise the operation will
   * be performed as `x.exponentiatedBy(n).modulo(m)` with a `POW_PRECISION` of 0.
   *
   * Throws if `n` is not an integer.
   *
   * ```ts
   * Math.pow(0.7, 2)                    // 0.48999999999999994
   * x = new BigNumber(0.7)
   * x.exponentiatedBy(2)                // '0.49'
   * BigNumber(3).exponentiatedBy(-2)    // '0.11111111111111111111'
   * ```
   *
   * @param n The exponent, an integer.
   * @param [m] The modulus.
   */
  exponentiatedBy(n: BigNumber.Value, m?: BigNumber.Value): BigNumber;
  exponentiatedBy(n: number, m?: BigNumber.Value): BigNumber;

  /**
   * Returns a BigNumber whose value is the value of this BigNumber exponentiated by `n`, i.e.
   * raised to the power `n`, and optionally modulo a modulus `m`.
   *
   * If `n` is negative the result is rounded according to the current `DECIMAL_PLACES` and
   * `ROUNDING_MODE` settings.
   *
   * As the number of digits of the result of the power operation can grow so large so quickly,
   * e.g. 123.456**10000 has over 50000 digits, the number of significant digits calculated is
   * limited to the value of the `POW_PRECISION` setting (unless a modulus `m` is specified).
   *
   * By default `POW_PRECISION` is set to 0. This means that an unlimited number of significant
   * digits will be calculated, and that the method's performance will decrease dramatically for
   * larger exponents.
   *
   * If `m` is specified and the value of `m`, `n` and this BigNumber are integers and `n` is
   * positive, then a fast modular exponentiation algorithm is used, otherwise the operation will
   * be performed as `x.pow(n).modulo(m)` with a `POW_PRECISION` of 0.
   *
   * Throws if `n` is not an integer.
   *
   * ```ts
   * Math.pow(0.7, 2)                   // 0.48999999999999994
   * x = new BigNumber(0.7)
   * x.pow(2)                           // '0.49'
   * BigNumber(3).pow(-2)               // '0.11111111111111111111'
   * ```
   *
   * @param n The exponent, an integer.
   * @param [m] The modulus.
   */
  pow(n: BigNumber.Value, m?: BigNumber.Value): BigNumber;
  pow(n: number, m?: BigNumber.Value): BigNumber;

  /**
   * Returns a BigNumber whose value is the value of this BigNumber rounded to an integer using
   * rounding mode `rm`.
   *
   * If `rm` is omitted, or is `null` or `undefined`, `ROUNDING_MODE` is used.
   *
   * Throws if `rm` is invalid.
   *
   * ```ts
   * x = new BigNumber(123.456)
   * x.integerValue()                        // '123'
   * x.integerValue(BigNumber.ROUND_CEIL)    // '124'
   * y = new BigNumber(-12.7)
   * y.integerValue()                        // '-13'
   * x.integerValue(BigNumber.ROUND_DOWN)    // '-12'
   * ```
   *
   * @param {BigNumber.RoundingMode} [rm] The roundng mode, an integer, 0 to 8.
   */
  integerValue(rm?: BigNumber.RoundingMode): BigNumber;

  /**
   * Returns `true` if the value of this BigNumber is equal to the value of `n`, otherwise returns
   * `false`.
   *
   * As with JavaScript, `NaN` does not equal `NaN`.
   *
   * ```ts
   * 0 === 1e-324                           // true
   * x = new BigNumber(0)
   * x.isEqualTo('1e-324')                  // false
   * BigNumber(-0).isEqualTo(x)             // true  ( -0 === 0 )
   * BigNumber(255).isEqualTo('ff', 16)     // true
   *
   * y = new BigNumber(NaN)
   * y.isEqualTo(NaN)                // false
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  isEqualTo(n: BigNumber.Value, base?: number): boolean;

  /**
   * Returns `true` if the value of this BigNumber is equal to the value of `n`, otherwise returns
   * `false`.
   *
   * As with JavaScript, `NaN` does not equal `NaN`.
   *
   * ```ts
   * 0 === 1e-324                    // true
   * x = new BigNumber(0)
   * x.eq('1e-324')                  // false
   * BigNumber(-0).eq(x)             // true  ( -0 === 0 )
   * BigNumber(255).eq('ff', 16)     // true
   *
   * y = new BigNumber(NaN)
   * y.eq(NaN)                       // false
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  eq(n: BigNumber.Value, base?: number): boolean;

  /**
   * Returns `true` if the value of this BigNumber is a finite number, otherwise returns `false`.
   *
   * The only possible non-finite values of a BigNumber are `NaN`, `Infinity` and `-Infinity`.
   *
   * ```ts
   * x = new BigNumber(1)
   * x.isFinite()                    // true
   * y = new BigNumber(Infinity)
   * y.isFinite()                    // false
   * ```
   */
  isFinite(): boolean;

  /**
   * Returns `true` if the value of this BigNumber is greater than the value of `n`, otherwise
   * returns `false`.
   *
   * ```ts
   * 0.1 > (0.3 - 0.2)                             // true
   * x = new BigNumber(0.1)
   * x.isGreaterThan(BigNumber(0.3).minus(0.2))    // false
   * BigNumber(0).isGreaterThan(x)                 // false
   * BigNumber(11, 3).isGreaterThan(11.1, 2)       // true
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  isGreaterThan(n: BigNumber.Value, base?: number): boolean;

  /**
   * Returns `true` if the value of this BigNumber is greater than the value of `n`, otherwise
   * returns `false`.
   *
   * ```ts
   * 0.1 > (0.3 - 0                     // true
   * x = new BigNumber(0.1)
   * x.gt(BigNumber(0.3).minus(0.2))    // false
   * BigNumber(0).gt(x)                 // false
   * BigNumber(11, 3).gt(11.1, 2)       // true
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  gt(n: BigNumber.Value, base?: number): boolean;

  /**
   * Returns `true` if the value of this BigNumber is greater than or equal to the value of `n`,
   * otherwise returns `false`.
   *
   * ```ts
   * (0.3 - 0.2) >= 0.1                                  // false
   * x = new BigNumber(0.3).minus(0.2)
   * x.isGreaterThanOrEqualTo(0.1)                       // true
   * BigNumber(1).isGreaterThanOrEqualTo(x)              // true
   * BigNumber(10, 18).isGreaterThanOrEqualTo('i', 36)   // true
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  isGreaterThanOrEqualTo(n: BigNumber.Value, base?: number): boolean;

  /**
   * Returns `true` if the value of this BigNumber is greater than or equal to the value of `n`,
   * otherwise returns `false`.
   *
   * ```ts
   * (0.3 - 0.2) >= 0.1                    // false
   * x = new BigNumber(0.3).minus(0.2)
   * x.gte(0.1)                            // true
   * BigNumber(1).gte(x)                   // true
   * BigNumber(10, 18).gte('i', 36)        // true
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  gte(n: BigNumber.Value, base?: number): boolean;

  /**
   * Returns `true` if the value of this BigNumber is an integer, otherwise returns `false`.
   *
   * ```ts
   * x = new BigNumber(1)
   * x.isInteger()                   // true
   * y = new BigNumber(123.456)
   * y.isInteger()                   // false
   * ```
   */
  isInteger(): boolean;

  /**
   * Returns `true` if the value of this BigNumber is less than the value of `n`, otherwise returns
   * `false`.
   *
   * ```ts
   * (0.3 - 0.2) < 0.1                       // true
   * x = new BigNumber(0.3).minus(0.2)
   * x.isLessThan(0.1)                       // false
   * BigNumber(0).isLessThan(x)              // true
   * BigNumber(11.1, 2).isLessThan(11, 3)    // true
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  isLessThan(n: BigNumber.Value, base?: number): boolean;

  /**
   * Returns `true` if the value of this BigNumber is less than the value of `n`, otherwise returns
   * `false`.
   *
   * ```ts
   * (0.3 - 0.2) < 0.1                       // true
   * x = new BigNumber(0.3).minus(0.2)
   * x.lt(0.1)                               // false
   * BigNumber(0).lt(x)                      // true
   * BigNumber(11.1, 2).lt(11, 3)            // true
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  lt(n: BigNumber.Value, base?: number): boolean;

  /**
   * Returns `true` if the value of this BigNumber is less than or equal to the value of `n`,
   * otherwise returns `false`.
   *
   * ```ts
   * 0.1 <= (0.3 - 0.2)                                 // false
   * x = new BigNumber(0.1)
   * x.isLessThanOrEqualTo(BigNumber(0.3).minus(0.2))   // true
   * BigNumber(-1).isLessThanOrEqualTo(x)               // true
   * BigNumber(10, 18).isLessThanOrEqualTo('i', 36)     // true
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  isLessThanOrEqualTo(n: BigNumber.Value, base?: number): boolean;

  /**
   * Returns `true` if the value of this BigNumber is less than or equal to the value of `n`,
   * otherwise returns `false`.
   *
   * ```ts
   * 0.1 <= (0.3 - 0.2)                  // false
   * x = new BigNumber(0.1)
   * x.lte(BigNumber(0.3).minus(0.2))    // true
   * BigNumber(-1).lte(x)                // true
   * BigNumber(10, 18).lte('i', 36)      // true
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  lte(n: BigNumber.Value, base?: number): boolean;

  /**
   * Returns `true` if the value of this BigNumber is `NaN`, otherwise returns `false`.
   *
   * ```ts
   * x = new BigNumber(NaN)
   * x.isNaN()                       // true
   * y = new BigNumber('Infinity')
   * y.isNaN()                       // false
   * ```
   */
  isNaN(): boolean;

  /**
   * Returns `true` if the value of this BigNumber is negative, otherwise returns `false`.
   *
   * ```ts
   * x = new BigNumber(-0)
   * x.isNegative()                  // true
   * y = new BigNumber(2)
   * y.isNegative()                  // false
   * ```
   */
  isNegative(): boolean;

  /**
   * Returns `true` if the value of this BigNumber is positive, otherwise returns `false`.
   *
   * ```ts
   * x = new BigNumber(-0)
   * x.isPositive()                  // false
   * y = new BigNumber(2)
   * y.isPositive()                  // true
   * ```
   */
  isPositive(): boolean;

  /**
   * Returns `true` if the value of this BigNumber is zero or minus zero, otherwise returns `false`.
   *
   * ```ts
   * x = new BigNumber(-0)
   * x.isZero()                 // true
   * ```
   */
  isZero(): boolean;

  /**
   * Returns a BigNumber whose value is the value of this BigNumber minus `n`.
   *
   * The return value is always exact and unrounded.
   *
   * ```ts
   * 0.3 - 0.1                       // 0.19999999999999998
   * x = new BigNumber(0.3)
   * x.minus(0.1)                    // '0.2'
   * x.minus(0.6, 20)                // '0'
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  minus(n: BigNumber.Value, base?: number): BigNumber;

  /**
   * Returns a BigNumber whose value is the value of this BigNumber modulo `n`, i.e. the integer
   * remainder of dividing this BigNumber by `n`.
   *
   * The value returned, and in particular its sign, is dependent on the value of the `MODULO_MODE`
   * setting of this BigNumber constructor. If it is 1 (default value), the result will have the
   * same sign as this BigNumber, and it will match that of Javascript's `%` operator (within the
   * limits of double precision) and BigDecimal's `remainder` method.
   *
   * The return value is always exact and unrounded.
   *
   * See `MODULO_MODE` for a description of the other modulo modes.
   *
   * ```ts
   * 1 % 0.9                         // 0.09999999999999998
   * x = new BigNumber(1)
   * x.modulo(0.9)                   // '0.1'
   * y = new BigNumber(33)
   * y.modulo('a', 33)               // '3'
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  modulo(n: BigNumber.Value, base?: number): BigNumber;

  /**
   * Returns a BigNumber whose value is the value of this BigNumber modulo `n`, i.e. the integer
   * remainder of dividing this BigNumber by `n`.
   *
   * The value returned, and in particular its sign, is dependent on the value of the `MODULO_MODE`
   * setting of this BigNumber constructor. If it is 1 (default value), the result will have the
   * same sign as this BigNumber, and it will match that of Javascript's `%` operator (within the
   * limits of double precision) and BigDecimal's `remainder` method.
   *
   * The return value is always exact and unrounded.
   *
   * See `MODULO_MODE` for a description of the other modulo modes.
   *
   * ```ts
   * 1 % 0.9                      // 0.09999999999999998
   * x = new BigNumber(1)
   * x.mod(0.9)                   // '0.1'
   * y = new BigNumber(33)
   * y.mod('a', 33)               // '3'
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  mod(n: BigNumber.Value, base?: number): BigNumber;

  /**
   * Returns a BigNumber whose value is the value of this BigNumber multiplied by `n`.
   *
   * The return value is always exact and unrounded.
   *
   * ```ts
   * 0.6 * 3                                // 1.7999999999999998
   * x = new BigNumber(0.6)
   * y = x.multipliedBy(3)                  // '1.8'
   * BigNumber('7e+500').multipliedBy(y)    // '1.26e+501'
   * x.multipliedBy('-a', 16)               // '-6'
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  multipliedBy(n: BigNumber.Value, base?: number): BigNumber;

  /**
   * Returns a BigNumber whose value is the value of this BigNumber multiplied by `n`.
   *
   * The return value is always exact and unrounded.
   *
   * ```ts
   * 0.6 * 3                         // 1.7999999999999998
   * x = new BigNumber(0.6)
   * y = x.times(3)                  // '1.8'
   * BigNumber('7e+500').times(y)    // '1.26e+501'
   * x.times('-a', 16)               // '-6'
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  times(n: BigNumber.Value, base?: number): BigNumber;

  /**
   * Returns a BigNumber whose value is the value of this BigNumber negated, i.e. multiplied by -1.
   *
   * ```ts
   * x = new BigNumber(1.8)
   * x.negated()                     // '-1.8'
   * y = new BigNumber(-1.3)
   * y.negated()                     // '1.3'
   * ```
   */
  negated(): BigNumber;

  /**
   * Returns a BigNumber whose value is the value of this BigNumber plus `n`.
   *
   * The return value is always exact and unrounded.
   *
   * ```ts
   * 0.1 + 0.2                       // 0.30000000000000004
   * x = new BigNumber(0.1)
   * y = x.plus(0.2)                 // '0.3'
   * BigNumber(0.7).plus(x).plus(y)  // '1.1'
   * x.plus('0.1', 8)                // '0.225'
   * ```
   *
   * @param n A numeric value.
   * @param [base] The base of n.
   */
  plus(n: BigNumber.Value, base?: number): BigNumber;

  /**
   * Returns the number of significant digits of the value of this BigNumber, or `null` if the value
   * of this BigNumber is ±`Infinity` or `NaN`.
   *
   * If `includeZeros` is true then any trailing zeros of the integer part of the value of this
   * BigNumber are counted as significant digits, otherwise they are not.
   *
   * Throws if `includeZeros` is invalid.
   *
   * ```ts
   * x = new BigNumber(9876.54321)
   * x.precision()                         // 9
   * y = new BigNumber(987000)
   * y.precision(false)                    // 3
   * y.precision(true)                     // 6
   * ```
   *
   * @param [includeZeros] Whether to include integer trailing zeros in the significant digit count.
   */
  precision(includeZeros?: boolean): number;

  /**
   * Returns a BigNumber whose value is the value of this BigNumber rounded to a precision of
   * `significantDigits` significant digits using rounding mode `roundingMode`.
   *
   * If `roundingMode` is omitted or is `null` or `undefined`, `ROUNDING_MODE` will be used.
   *
   * Throws if `significantDigits` or `roundingMode` is invalid.
   *
   * ```ts
   * x = new BigNumber(9876.54321)
   * x.precision(6)                         // '9876.54'
   * x.precision(6, BigNumber.ROUND_UP)     // '9876.55'
   * x.precision(2)                         // '9900'
   * x.precision(2, 1)                      // '9800'
   * x                                      // '9876.54321'
   * ```
   *
   * @param significantDigits Significant digits, integer, 1 to 1e+9.
   * @param [roundingMode] Rounding mode, integer, 0 to 8.
   */
  precision(significantDigits: number, roundingMode?: BigNumber.RoundingMode): BigNumber;

  /**
   * Returns the number of significant digits of the value of this BigNumber,
   * or `null` if the value of this BigNumber is ±`Infinity` or `NaN`.
   *
   * If `includeZeros` is true then any trailing zeros of the integer part of
   * the value of this BigNumber are counted as significant digits, otherwise
   * they are not.
   *
   * Throws if `includeZeros` is invalid.
   *
   * ```ts
   * x = new BigNumber(9876.54321)
   * x.sd()                         // 9
   * y = new BigNumber(987000)
   * y.sd(false)                    // 3
   * y.sd(true)                     // 6
   * ```
   *
   * @param [includeZeros] Whether to include integer trailing zeros in the significant digit count.
   */
  sd(includeZeros?: boolean): number;

  /**
   * Returns a BigNumber whose value is the value of this BigNumber rounded to a precision of
   * `significantDigits` significant digits using rounding mode `roundingMode`.
   *
   * If `roundingMode` is omitted or is `null` or `undefined`, `ROUNDING_MODE` will be used.
   *
   * Throws if `significantDigits` or `roundingMode` is invalid.
   *
   * ```ts
   * x = new BigNumber(9876.54321)
   * x.sd(6)                           // '9876.54'
   * x.sd(6, BigNumber.ROUND_UP)       // '9876.55'
   * x.sd(2)                           // '9900'
   * x.sd(2, 1)                        // '9800'
   * x                                 // '9876.54321'
   * ```
   *
   * @param significantDigits Significant digits, integer, 1 to 1e+9.
   * @param [roundingMode] Rounding mode, integer, 0 to 8.
   */
  sd(significantDigits: number, roundingMode?: BigNumber.RoundingMode): BigNumber;

  /**
   * Returns a BigNumber whose value is the value of this BigNumber shifted by `n` places.
   *
   * The shift is of the decimal point, i.e. of powers of ten, and is to the left if `n` is negative
   * or to the right if `n` is positive.
   *
   * The return value is always exact and unrounded.
   *
   * Throws if `n` is invalid.
   *
   * ```ts
   * x = new BigNumber(1.23)
   * x.shiftedBy(3)                      // '1230'
   * x.shiftedBy(-3)                     // '0.00123'
   * ```
   *
   * @param n The shift value, integer, -9007199254740991 to 9007199254740991.
   */
  shiftedBy(n: number): BigNumber;

  /**
   * Returns a BigNumber whose value is the square root of the value of this BigNumber, rounded
   * according to the current `DECIMAL_PLACES` and `ROUNDING_MODE` settings.
   *
   * The return value will be correctly rounded, i.e. rounded as if the result was first calculated
   * to an infinite number of correct digits before rounding.
   *
   * ```ts
   * x = new BigNumber(16)
   * x.squareRoot()                  // '4'
   * y = new BigNumber(3)
   * y.squareRoot()                  // '1.73205080756887729353'
   * ```
   */
  squareRoot(): BigNumber;

  /**
   * Returns a BigNumber whose value is the square root of the value of this BigNumber, rounded
   * according to the current `DECIMAL_PLACES` and `ROUNDING_MODE` settings.
   *
   * The return value will be correctly rounded, i.e. rounded as if the result was first calculated
   * to an infinite number of correct digits before rounding.
   *
   * ```ts
   * x = new BigNumber(16)
   * x.sqrt()                  // '4'
   * y = new BigNumber(3)
   * y.sqrt()                  // '1.73205080756887729353'
   * ```
   */
  sqrt(): BigNumber;

  /**
   * Returns a string representing the value of this BigNumber in exponential notation rounded using
   * rounding mode `roundingMode` to `decimalPlaces` decimal places, i.e with one digit before the
   * decimal point and `decimalPlaces` digits after it.
   *
   * If the value of this BigNumber in exponential notation has fewer than `decimalPlaces` fraction
   * digits, the return value will be appended with zeros accordingly.
   *
   * If `decimalPlaces` is omitted, or is `null` or `undefined`, the number of digits after the
   * decimal point defaults to the minimum number of digits necessary to represent the value
   * exactly.
   *
   * If `roundingMode` is omitted or is `null` or `undefined`, `ROUNDING_MODE` is used.
   *
   * Throws if `decimalPlaces` or `roundingMode` is invalid.
   *
   * ```ts
   * x = 45.6
   * y = new BigNumber(x)
   * x.toExponential()               // '4.56e+1'
   * y.toExponential()               // '4.56e+1'
   * x.toExponential(0)              // '5e+1'
   * y.toExponential(0)              // '5e+1'
   * x.toExponential(1)              // '4.6e+1'
   * y.toExponential(1)              // '4.6e+1'
   * y.toExponential(1, 1)           // '4.5e+1'  (ROUND_DOWN)
   * x.toExponential(3)              // '4.560e+1'
   * y.toExponential(3)              // '4.560e+1'
   * ```
   *
   * @param [decimalPlaces] Decimal places, integer, 0 to 1e+9.
   * @param [roundingMode] Rounding mode, integer, 0 to 8.
   */
  toExponential(decimalPlaces: number, roundingMode?: BigNumber.RoundingMode): string;
  toExponential(): string;

  /**
   * Returns a string representing the value of this BigNumber in normal (fixed-point) notation
   * rounded to `decimalPlaces` decimal places using rounding mode `roundingMode`.
   *
   * If the value of this BigNumber in normal notation has fewer than `decimalPlaces` fraction
   * digits, the return value will be appended with zeros accordingly.
   *
   * Unlike `Number.prototype.toFixed`, which returns exponential notation if a number is greater or
   * equal to 10**21, this method will always return normal notation.
   *
   * If `decimalPlaces` is omitted or is `null` or `undefined`, the return value will be unrounded
   * and in normal notation. This is also unlike `Number.prototype.toFixed`, which returns the value
   * to zero decimal places. It is useful when normal notation is required and the current
   * `EXPONENTIAL_AT` setting causes `toString` to return exponential notation.
   *
   * If `roundingMode` is omitted or is `null` or `undefined`, `ROUNDING_MODE` is used.
   *
   * Throws if `decimalPlaces` or `roundingMode` is invalid.
   *
   * ```ts
   * x = 3.456
   * y = new BigNumber(x)
   * x.toFixed()                     // '3'
   * y.toFixed()                     // '3.456'
   * y.toFixed(0)                    // '3'
   * x.toFixed(2)                    // '3.46'
   * y.toFixed(2)                    // '3.46'
   * y.toFixed(2, 1)                 // '3.45'  (ROUND_DOWN)
   * x.toFixed(5)                    // '3.45600'
   * y.toFixed(5)                    // '3.45600'
   * ```
   *
   * @param [decimalPlaces] Decimal places, integer, 0 to 1e+9.
   * @param [roundingMode] Rounding mode, integer, 0 to 8.
   */
  toFixed(decimalPlaces: number, roundingMode?: BigNumber.RoundingMode): string;
  toFixed(): string;

  /**
   * Returns a string representing the value of this BigNumber in normal (fixed-point) notation
   * rounded to `decimalPlaces` decimal places using rounding mode `roundingMode`, and formatted
   * according to the properties of the `format` or `FORMAT` object.
   *
   * The formatting object may contain some or all of the properties shown in the examples below.
   *
   * If `decimalPlaces` is omitted or is `null` or `undefined`, then the return value is not
   * rounded to a fixed number of decimal places.
   *
   * If `roundingMode` is omitted or is `null` or `undefined`, `ROUNDING_MODE` is used.
   *
   * If `format` is omitted or is `null` or `undefined`, `FORMAT` is used.
   *
   * Throws if `decimalPlaces`, `roundingMode`, or `format` is invalid.
   *
   * ```ts
   * fmt = {
   *   decimalSeparator: '.',
   *   groupSeparator: ',',
   *   groupSize: 3,
   *   secondaryGroupSize: 0,
   *   fractionGroupSeparator: ' ',
   *   fractionGroupSize: 0
   * }
   *
   * x = new BigNumber('123456789.123456789')
   *
   * // Set the global formatting options
   * BigNumber.config({ FORMAT: fmt })
   *
   * x.toFormat()                              // '123,456,789.123456789'
   * x.toFormat(3)                             // '123,456,789.123'
   *
   * // If a reference to the object assigned to FORMAT has been retained,
   * // the format properties can be changed directly
   * fmt.groupSeparator = ' '
   * fmt.fractionGroupSize = 5
   * x.toFormat()                              // '123 456 789.12345 6789'
   *
   * // Alternatively, pass the formatting options as an argument
   * fmt = {
   *   decimalSeparator: ',',
   *   groupSeparator: '.',
   *   groupSize: 3,
   *   secondaryGroupSize: 2
   * }
   *
   * x.toFormat()                              // '123 456 789.12345 6789'
   * x.toFormat(fmt)                           // '12.34.56.789,123456789'
   * x.toFormat(2, fmt)                        // '12.34.56.789,12'
   * x.toFormat(3, BigNumber.ROUND_UP, fmt)    // '12.34.56.789,124'
   * ```
   *
   * @param [decimalPlaces] Decimal places, integer, 0 to 1e+9.
   * @param [roundingMode] Rounding mode, integer, 0 to 8.
   * @param [format] Formatting options object. See `BigNumber.Format`.
   */
  toFormat(decimalPlaces: number, roundingMode: BigNumber.RoundingMode, format?: BigNumber.Format): string;
  toFormat(decimalPlaces: number, roundingMode?: BigNumber.RoundingMode): string;
  toFormat(decimalPlaces?: number): string;
  toFormat(decimalPlaces: number, format: BigNumber.Format): string;
  toFormat(format: BigNumber.Format): string;

  /**
   * Returns an array of two BigNumbers representing the value of this BigNumber as a simple
   * fraction with an integer numerator and an integer denominator.
   * The denominator will be a positive non-zero value less than or equal to `max_denominator`.
   * If a maximum denominator, `max_denominator`, is not specified, or is `null` or `undefined`, the
   * denominator will be the lowest value necessary to represent the number exactly.
   *
   * Throws if `max_denominator` is invalid.
   *
   * ```ts
   * x = new BigNumber(1.75)
   * x.toFraction()                  // '7, 4'
   *
   * pi = new BigNumber('3.14159265358')
   * pi.toFraction()                 // '157079632679,50000000000'
   * pi.toFraction(100000)           // '312689, 99532'
   * pi.toFraction(10000)            // '355, 113'
   * pi.toFraction(100)              // '311, 99'
   * pi.toFraction(10)               // '22, 7'
   * pi.toFraction(1)                // '3, 1'
   * ```
   *
   * @param [max_denominator] The maximum denominator, integer > 0, or Infinity.
   */
  toFraction(max_denominator?: BigNumber.Value): [BigNumber, BigNumber];

  /** As `valueOf`. */
  toJSON(): string;

  /**
   * Returns the value of this BigNumber as a JavaScript primitive number.
   *
   * Using the unary plus operator gives the same result.
   *
   * ```ts
   * x = new BigNumber(456.789)
   * x.toNumber()                    // 456.789
   * +x                              // 456.789
   *
   * y = new BigNumber('45987349857634085409857349856430985')
   * y.toNumber()                    // 4.598734985763409e+34
   *
   * z = new BigNumber(-0)
   * 1 / z.toNumber()                // -Infinity
   * 1 / +z                          // -Infinity
   * ```
   */
  toNumber(): number;

  /**
   * Returns a string representing the value of this BigNumber rounded to `significantDigits`
   * significant digits using rounding mode `roundingMode`.
   *
   * If `significantDigits` is less than the number of digits necessary to represent the integer
   * part of the value in normal (fixed-point) notation, then exponential notation is used.
   *
   * If `significantDigits` is omitted, or is `null` or `undefined`, then the return value is the
   * same as `n.toString()`.
   *
   * If `roundingMode` is omitted or is `null` or `undefined`, `ROUNDING_MODE` is used.
   *
   * Throws if `significantDigits` or `roundingMode` is invalid.
   *
   * ```ts
   * x = 45.6
   * y = new BigNumber(x)
   * x.toPrecision()                 // '45.6'
   * y.toPrecision()                 // '45.6'
   * x.toPrecision(1)                // '5e+1'
   * y.toPrecision(1)                // '5e+1'
   * y.toPrecision(2, 0)             // '4.6e+1'  (ROUND_UP)
   * y.toPrecision(2, 1)             // '4.5e+1'  (ROUND_DOWN)
   * x.toPrecision(5)                // '45.600'
   * y.toPrecision(5)                // '45.600'
   * ```
   *
   * @param [significantDigits] Significant digits, integer, 1 to 1e+9.
   * @param [roundingMode] Rounding mode, integer 0 to 8.
   */
  toPrecision(significantDigits: number, roundingMode?: BigNumber.RoundingMode): string;
  toPrecision(): string;

  /**
   * Returns a string representing the value of this BigNumber in base `base`, or base 10 if `base`
   * is omitted or is `null` or `undefined`.
   *
   * For bases above 10, and using the default base conversion alphabet (see `ALPHABET`), values
   * from 10 to 35 are represented by a-z (the same as `Number.prototype.toString`).
   *
   * If a base is specified the value is rounded according to the current `DECIMAL_PLACES` and
   * `ROUNDING_MODE` settings, otherwise it is not.
   *
   * If a base is not specified, and this BigNumber has a positive exponent that is equal to or
   * greater than the positive component of the current `EXPONENTIAL_AT` setting, or a negative
   * exponent equal to or less than the negative component of the setting, then exponential notation
   * is returned.
   *
   * If `base` is `null` or `undefined` it is ignored.
   *
   * Throws if `base` is invalid.
   *
   * ```ts
   * x = new BigNumber(750000)
   * x.toString()                    // '750000'
   * BigNumber.config({ EXPONENTIAL_AT: 5 })
   * x.toString()                    // '7.5e+5'
   *
   * y = new BigNumber(362.875)
   * y.toString(2)                   // '101101010.111'
   * y.toString(9)                   // '442.77777777777777777778'
   * y.toString(32)                  // 'ba.s'
   *
   * BigNumber.config({ DECIMAL_PLACES: 4 });
   * z = new BigNumber('1.23456789')
   * z.toString()                    // '1.23456789'
   * z.toString(10)                  // '1.2346'
   * ```
   *
   * @param [base] The base, integer, 2 to 36 (or `ALPHABET.length`, see `ALPHABET`).
   */
  toString(base?: number): string;

  /**
   * As `toString`, but does not accept a base argument and includes the minus sign for negative
   * zero.
   *
   * ``ts
   * x = new BigNumber('-0')
   * x.toString()                    // '0'
   * x.valueOf()                     // '-0'
   * y = new BigNumber('1.777e+457')
   * y.valueOf()                     // '1.777e+457'
   * ```
   */
  valueOf(): string;

  /** Helps ES6 import. */
  private static readonly default?: BigNumber.Constructor;

  /** Helps ES6 import. */
  private static readonly BigNumber?: BigNumber.Constructor;

  /** Rounds away from zero. */
  static readonly ROUND_UP: 0;

  /** Rounds towards zero. */
  static readonly ROUND_DOWN: 1;

  /** Rounds towards Infinity. */
  static readonly ROUND_CEIL: 2;

  /** Rounds towards -Infinity. */
  static readonly ROUND_FLOOR: 3;

  /** Rounds towards nearest neighbour. If equidistant, rounds away from zero . */
  static readonly ROUND_HALF_UP: 4;

  /** Rounds towards nearest neighbour. If equidistant, rounds towards zero. */
  static readonly ROUND_HALF_DOWN: 5;

  /** Rounds towards nearest neighbour. If equidistant, rounds towards even neighbour. */
  static readonly ROUND_HALF_EVEN: 6;

  /** Rounds towards nearest neighbour. If equidistant, rounds towards Infinity. */
  static readonly ROUND_HALF_CEIL: 7;

  /** Rounds towards nearest neighbour. If equidistant, rounds towards -Infinity. */
  static readonly ROUND_HALF_FLOOR: 8;

  /** See `MODULO_MODE`. */
  static readonly EUCLID: 9;

  /**
   * To aid in debugging, if a `BigNumber.DEBUG` property is `true` then an error will be thrown
   * if the BigNumber constructor receives an invalid `BigNumber.Value`, or if `BigNumber.isBigNumber`
   * receives a BigNumber instance that is malformed.
   *
   * ```ts
   * // No error, and BigNumber NaN is returned.
   * new BigNumber('blurgh')    // 'NaN'
   * new BigNumber(9, 2)        // 'NaN'
   * BigNumber.DEBUG = true
   * new BigNumber('blurgh')    // '[BigNumber Error] Not a number'
   * new BigNumber(9, 2)        // '[BigNumber Error] Not a base 2 number'
   * ```
   *
   * An error will also be thrown if a `BigNumber.Value` is of type number with more than 15
   * significant digits, as calling `toString` or `valueOf` on such numbers may not result
   * in the intended value.
   *
   * ```ts
   * console.log(823456789123456.3)       //  823456789123456.2
   * // No error, and the returned BigNumber does not have the same value as the number literal.
   * new BigNumber(823456789123456.3)     // '823456789123456.2'
   * BigNumber.DEBUG = true
   * new BigNumber(823456789123456.3)
   * // '[BigNumber Error] Number primitive has more than 15 significant digits'
   * ```
   *
   * Check that a BigNumber instance is well-formed:
   *
   * ```ts
   * x = new BigNumber(10)
   *
   * BigNumber.DEBUG = false
   * // Change x.c to an illegitimate value.
   * x.c = NaN
   * // No error, as BigNumber.DEBUG is false.
   * BigNumber.isBigNumber(x)    // true
   *
   * BigNumber.DEBUG = true
   * BigNumber.isBigNumber(x)    // '[BigNumber Error] Invalid BigNumber'
   * ```
   */
  static DEBUG?: boolean;

  /**
   * Returns a new independent BigNumber constructor with configuration as described by `object`, or
   * with the default configuration if object is `null` or `undefined`.
   *
   * Throws if `object` is not an object.
   *
   * ```ts
   * BigNumber.config({ DECIMAL_PLACES: 5 })
   * BN = BigNumber.clone({ DECIMAL_PLACES: 9 })
   *
   * x = new BigNumber(1)
   * y = new BN(1)
   *
   * x.div(3)                        // 0.33333
   * y.div(3)                        // 0.333333333
   *
   * // BN = BigNumber.clone({ DECIMAL_PLACES: 9 }) is equivalent to:
   * BN = BigNumber.clone()
   * BN.config({ DECIMAL_PLACES: 9 })
   * ```
   *
   * @param [object] The configuration object.
   */
  static clone(object?: BigNumber.Config): BigNumber.Constructor;

  /**
   * Configures the settings that apply to this BigNumber constructor.
   *
   * The configuration object, `object`, contains any number of the properties shown in the example
   * below.
   *
   * Returns an object with the above properties and their current values.
   *
   * Throws if `object` is not an object, or if an invalid value is assigned to one or more of the
   * properties.
   *
   * ```ts
   * BigNumber.config({
   *     DECIMAL_PLACES: 40,
   *     ROUNDING_MODE: BigNumber.ROUND_HALF_CEIL,
   *     EXPONENTIAL_AT: [-10, 20],
   *     RANGE: [-500, 500],
   *     CRYPTO: true,
   *     MODULO_MODE: BigNumber.ROUND_FLOOR,
   *     POW_PRECISION: 80,
   *     FORMAT: {
   *         groupSize: 3,
   *         groupSeparator: ' ',
   *         decimalSeparator: ','
   *     },
   *     ALPHABET: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_'
   * });
   *
   * BigNumber.config().DECIMAL_PLACES        // 40
   * ```
   *
   * @param object The configuration object.
   */
  static config(object?: BigNumber.Config): BigNumber.Config;

  /**
   * Returns `true` if `value` is a BigNumber instance, otherwise returns `false`.
   *
   * If `BigNumber.DEBUG` is `true`, throws if a BigNumber instance is not well-formed.
   *
   * ```ts
   * x = 42
   * y = new BigNumber(x)
   *
   * BigNumber.isBigNumber(x)             // false
   * y instanceof BigNumber               // true
   * BigNumber.isBigNumber(y)             // true
   *
   * BN = BigNumber.clone();
   * z = new BN(x)
   * z instanceof BigNumber               // false
   * BigNumber.isBigNumber(z)             // true
   * ```
   *
   * @param value The value to test.
   */
  static isBigNumber(value: any): value is BigNumber;

  /**
   * Returns a BigNumber whose value is the maximum of the arguments.
   *
   * The return value is always exact and unrounded.
   *
   * ```ts
   * x = new BigNumber('3257869345.0378653')
   * BigNumber.maximum(4e9, x, '123456789.9')      // '4000000000'
   *
   * arr = [12, '13', new BigNumber(14)]
   * BigNumber.maximum.apply(null, arr)            // '14'
   * ```
   *
   * @param n A numeric value.
   */
  static maximum(...n: BigNumber.Value[]): BigNumber;

  /**
   * Returns a BigNumber whose value is the maximum of the arguments.
   *
   * The return value is always exact and unrounded.
   *
   * ```ts
   * x = new BigNumber('3257869345.0378653')
   * BigNumber.max(4e9, x, '123456789.9')      // '4000000000'
   *
   * arr = [12, '13', new BigNumber(14)]
   * BigNumber.max.apply(null, arr)            // '14'
   * ```
   *
   * @param n A numeric value.
   */
  static max(...n: BigNumber.Value[]): BigNumber;

  /**
   * Returns a BigNumber whose value is the minimum of the arguments.
   *
   * The return value is always exact and unrounded.
   *
   * ```ts
   * x = new BigNumber('3257869345.0378653')
   * BigNumber.minimum(4e9, x, '123456789.9')          // '123456789.9'
   *
   * arr = [2, new BigNumber(-14), '-15.9999', -12]
   * BigNumber.minimum.apply(null, arr)                // '-15.9999'
   * ```
   *
   * @param n A numeric value.
   */
  static minimum(...n: BigNumber.Value[]): BigNumber;

  /**
   * Returns a BigNumber whose value is the minimum of the arguments.
   *
   * The return value is always exact and unrounded.
   *
   * ```ts
   * x = new BigNumber('3257869345.0378653')
   * BigNumber.min(4e9, x, '123456789.9')             // '123456789.9'
   *
   * arr = [2, new BigNumber(-14), '-15.9999', -12]
   * BigNumber.min.apply(null, arr)                   // '-15.9999'
   * ```
   *
   * @param n A numeric value.
   */
  static min(...n: BigNumber.Value[]): BigNumber;

  /**
   * Returns a new BigNumber with a pseudo-random value equal to or greater than 0 and less than 1.
   *
   * The return value will have `decimalPlaces` decimal places, or less if trailing zeros are
   * produced. If `decimalPlaces` is omitted, the current `DECIMAL_PLACES` setting will be used.
   *
   * Depending on the value of this BigNumber constructor's `CRYPTO` setting and the support for the
   * `crypto` object in the host environment, the random digits of the return value are generated by
   * either `Math.random` (fastest), `crypto.getRandomValues` (Web Cryptography API in recent
   * browsers) or `crypto.randomBytes` (Node.js).
   *
   * To be able to set `CRYPTO` to true when using Node.js, the `crypto` object must be available
   * globally:
   *
   * ```ts
   * global.crypto = require('crypto')
   * ```
   *
   * If `CRYPTO` is true, i.e. one of the `crypto` methods is to be used, the value of a returned
   * BigNumber should be cryptographically secure and statistically indistinguishable from a random
   * value.
   *
   * Throws if `decimalPlaces` is invalid.
   *
   * ```ts
   * BigNumber.config({ DECIMAL_PLACES: 10 })
   * BigNumber.random()              // '0.4117936847'
   * BigNumber.random(20)            // '0.78193327636914089009'
   * ```
   *
   * @param [decimalPlaces] Decimal places, integer, 0 to 1e+9.
   */
  static random(decimalPlaces?: number): BigNumber;

  /**
   * Returns a BigNumber whose value is the sum of the arguments.
   *
   * The return value is always exact and unrounded.
   *
   * ```ts
   * x = new BigNumber('3257869345.0378653')
   * BigNumber.sum(4e9, x, '123456789.9')      // '7381326134.9378653'
   *
   * arr = [2, new BigNumber(14), '15.9999', 12]
   * BigNumber.sum.apply(null, arr)            // '43.9999'
   * ```
   *
   * @param n A numeric value.
   */
  static sum(...n: BigNumber.Value[]): BigNumber;

  /**
   * Configures the settings that apply to this BigNumber constructor.
   *
   * The configuration object, `object`, contains any number of the properties shown in the example
   * below.
   *
   * Returns an object with the above properties and their current values.
   *
   * Throws if `object` is not an object, or if an invalid value is assigned to one or more of the
   * properties.
   *
   * ```ts
   * BigNumber.set({
   *     DECIMAL_PLACES: 40,
   *     ROUNDING_MODE: BigNumber.ROUND_HALF_CEIL,
   *     EXPONENTIAL_AT: [-10, 20],
   *     RANGE: [-500, 500],
   *     CRYPTO: true,
   *     MODULO_MODE: BigNumber.ROUND_FLOOR,
   *     POW_PRECISION: 80,
   *     FORMAT: {
   *         groupSize: 3,
   *         groupSeparator: ' ',
   *         decimalSeparator: ','
   *     },
   *     ALPHABET: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_'
   * });
   *
   * BigNumber.set().DECIMAL_PLACES        // 40
   * ```
   *
   * @param object The configuration object.
   */
  static set(object?: BigNumber.Config): BigNumber.Config;
}

declare function BigNumber(n: BigNumber.Value, base?: number): BigNumber;

declare type KeyValue<T> = {
    [key: string]: T;
};
declare type KeyValueString = KeyValue<string>;
declare type KeyValuePair<T, U> = {
    key: T;
    value: U;
};

declare global {
    export interface Array<T> {
        index?: number;
        input?: string;
        distinct<T, U>(this: T[], selector?: (element: T) => T | U): U[];
        groupBy<T>(this: T[], selector: (element: T) => string): KeyValuePair<string, T[]>[];
        groupBy<T>(this: T[], selector: (element: T) => number): KeyValuePair<number, T[]>[];
        orderBy<T>(this: T[], selector: (element: T) => number | string): T[];
        orderBy<T>(this: T[], property: string): T[];
        orderByDescending<T>(this: T[], selector: (element: T) => number): T[];
        orderByDescending<T>(this: T[], property: string): T[];
        min<T>(this: T[], selector: (element: T) => number): number;
        max<T>(this: T[], selector: (element: T) => number): number;
        remove(s: T): boolean;
        removeAll(f: (t: T) => boolean, thisObject?: any): void;
        sum<T>(this: T[], selector: (element: T) => number): number;
    }
    export interface ArrayConstructor {
        range(start: number, end: number, step?: number): number[];
    }
}

declare module "bignumber.js" {
    interface BigNumber {
        format(format: string): string;
        localeFormat(format: string): string;
    }
}
declare global {
    export interface Number {
        format(format: string): string;
        localeFormat(format: string): string;
    }
}

declare global {
    export interface BooleanConstructor {
        parse(value: string): boolean;
    }
}

declare global {
    export interface Date {
        format(format: string): string;
        localeFormat(format: string, useDefault: boolean): string;
        netType(value: string): any;
        netType(): string;
        netOffset(value: string): any;
        netOffset(): string;
    }
}

declare class ExpressionParser {
    static readonly alwaysTrue: () => boolean;
    private static _cache;
    private static _operands;
    static get(expression: string): any;
    static parse(expression: string): any;
}

interface ISubjectNotifier<TSource, TDetail> {
    notify?: (source: TSource, detail?: TDetail) => void;
}
declare class PropertyChangedArgs {
    readonly propertyName: string;
    readonly newValue: any;
    readonly oldValue: any;
    constructor(propertyName: string, newValue: any, oldValue: any);
}
declare class ArrayChangedArgs {
    arrayPropertyName: string;
    readonly index: number;
    readonly removedItems?: any[];
    readonly addedItemCount?: number;
    constructor(arrayPropertyName: string, index: number, removedItems?: any[], addedItemCount?: number);
}
interface ISubjectDisposer {
    (): void;
}
declare class Subject<TSource, TDetail> {
    private _observers;
    constructor(notifier: ISubjectNotifier<TSource, TDetail>);
    attach(observer: ISubjectObserver<TSource, TDetail>): ISubjectDisposer;
    private _detach;
}
interface ISubjectObserver<TSource, TDetail> {
    (sender: TSource, detail: TDetail): void;
}
declare class Observable<T> {
    private _propertyChangedNotifier;
    private _arrayChangedNotifier;
    readonly propertyChanged: Subject<T, PropertyChangedArgs>;
    readonly arrayChanged: Subject<T, ArrayChangedArgs>;
    constructor();
    protected notifyPropertyChanged(propertyName: string, newValue: any, oldValue?: any): void;
    protected notifyArrayChanged(arrayPropertyName: string, index: number, removedItems: any[], addedCount: number): void;
}
interface IPropertyChangedObserver<T> extends ISubjectObserver<T, PropertyChangedArgs> {
}

declare class Queue {
    private pendingPromises;
    private maxPendingPromises;
    private maxQueuedPromises;
    private queue;
    constructor(maxPendingPromises?: number, maxQueuedPromises?: number);
    add<T>(promiseGenerator: () => Promise<T>): Promise<T>;
    private _dequeue;
    get pendingLength(): number;
    get queueLength(): number;
}

type ServiceBusCallback = (sender: any, message: string, detail: any) => void;
interface ServiceBusSubscriptionDisposer extends ISubjectDisposer {
}
interface IServiceBus {
    send(sender: any, message: string, parameters: any): any;
    subscribe(message: string, callback: ServiceBusCallback, receiveLast?: boolean): ServiceBusSubscriptionDisposer;
}
declare class ServiceBusImpl implements IServiceBus {
    private _topics;
    private _getTopic;
    send(message: string, detail?: any): void;
    send(sender: any, message: string, detail?: any): void;
    subscribe(message: string, callback: ServiceBusCallback, receiveLast?: boolean): ISubjectDisposer;
}
declare const ServiceBus: ServiceBusImpl;

declare global {
    export interface String {
        asDataUri(): string;
        contains(str: string): boolean;
        endsWith(suffix: string): boolean;
        insert(str: string, index: number): string;
        padLeft(width: number, str?: string): string;
        padRight(width: number, str?: string): string;
        splitWithTail(separator: string | RegExp, limit?: number): string[];
        toKebabCase(): string;
        trimEnd(char: string): string;
        trimStart(char: string): string;
    }
    export interface StringConstructor {
        isNullOrEmpty(str: string): boolean;
        isNullOrWhiteSpace(str: string): boolean;
        format(format: string, ...args: any[]): string;
        fromChar(ch: string, count: number): string;
    }
}

declare function extend(target: any, ...sources: any[]): any;

declare function noop(): void;

declare function sleep(ms: number): Promise<void>;

declare type NotificationType$1 = "" | "OK" | "Notice" | "Warning" | "Error";
declare type SortDirection$1 = "" | "ASC" | "DESC";
declare type Request$1 = {
    userName?: string;
    authToken?: string;
    clientVersion?: string;
    environment: "Web" | "Web,ServiceWorker";
    environmentVersion: string;
};
declare type Response$1 = {
    authToken?: string;
    exception?: string;
};
declare type GetApplicationRequest = {
    password?: string;
} & Request$1;
declare type GetQueryRequest = {
    id: string;
} & Request$1;
declare type GetQueryResponse = {
    query: Query$2;
} & Response$1;
declare type GetPersistentObjectRequest = {
    persistentObjectTypeId: string;
    objectId?: string;
    isNew?: boolean;
    parent?: PersistentObject$2;
} & Request$1;
declare type GetPersistentObjectResponse = {
    result: PersistentObject$2;
} & Response$1;
declare type ExecuteActionParameters = {
    [key: string]: string;
};
declare type ExecuteActionRequest = {
    action: string;
    parameters: ExecuteActionParameters;
    parent: PersistentObject$2;
} & Request$1;
declare type ExecuteActionRefreshParameters = {
    RefreshedPersistentObjectAttributeId: string;
} & ExecuteActionParameters;
declare type ExecuteQueryActionRequest = {
    parent: PersistentObject$2;
    query: Query$2;
    selectedItems: QueryResultItem$1[];
} & ExecuteActionRequest;
declare type ExecuteQueryFilterActionRequest = {
    query: Query$2;
} & ExecuteActionRequest;
declare type ExecutePersistentObjectActionRequest = {
    parent: PersistentObject$2;
} & ExecuteActionRequest;
declare type ExecuteActionResponse = {
    result: PersistentObject$2;
} & Response$1;
declare type ExecuteQueryRequest = {
    query: Query$2;
    parent: PersistentObject$2;
} & Request$1;
declare type ExecuteQueryResponse = {
    result: QueryResult;
} & Response$1;
declare type ProviderParameters = {
    label: string;
    description: string;
    requestUri: string;
    signOutUri: string;
    redirectUri: string;
    registerPersistentObjectId?: string;
    registerUser?: string;
    forgotPassword?: boolean;
    getCredentialType?: boolean;
};
declare type ClientData = {
    defaultUser: string;
    exception: string;
    languages: Languages;
    providers: {
        [name: string]: {
            parameters: ProviderParameters;
        };
    };
    windowsAuthentication: boolean;
};
declare type Languages = {
    [culture: string]: Language$1;
};
declare type Language$1 = {
    name: string;
    isDefault: boolean;
    messages: KeyValueString;
};
declare type ApplicationResponse = {
    application: PersistentObject$2;
    userCultureInfo: string;
    userLanguage: string;
    userName: string;
    hasSensitive: boolean;
} & Response$1;
declare type PersistentObjectStateBehavior = "None" | "OpenInEdit" | "StayInEdit" | "AsDialog";
declare type PersistentObject$2 = {
    actions?: string[];
    attributes?: PersistentObjectAttribute$2[];
    breadcrumb?: string;
    dialogSaveAction?: string;
    forceFromAction?: boolean;
    fullTypeName: string;
    id: string;
    isBreadcrumbSensitive?: boolean;
    isNew?: boolean;
    isSystem?: boolean;
    label?: string;
    newOptions?: string;
    notification?: string;
    notificationType?: NotificationType$1;
    notificationDuration?: number;
    objectId?: string;
    queries?: Query$2[];
    queryLayoutMode?: string;
    securityToken?: never;
    stateBehavior?: PersistentObjectStateBehavior;
    tabs?: KeyValue<PersistentObjectTab$2>;
    type: string;
};
declare type PersistentObjectAttributeVisibility = "Always" | "Read" | "New" | "Never" | "Query" | "Read, Query" | "Read, New" | "Query, New";
declare type PersistentObjectAttribute$2 = {
    disableSort?: boolean;
    id?: string;
    column?: number;
    name: string;
    type: string;
    group?: string;
    tab?: string;
    label?: string;
    value?: string;
    isReadOnly?: boolean;
    isRequired?: boolean;
    isSensitive?: boolean;
    isSystem?: boolean;
    isValueChanged?: boolean;
    offset?: number;
    rules?: string;
    visibility?: PersistentObjectAttributeVisibility;
    toolTip?: string;
    columnSpan?: number;
    typeHints?: KeyValue<string>;
    validationError?: string;
    triggersRefresh?: boolean;
    options?: string[];
};
declare type PersistentObjectAttributeWithReference$1 = {
    displayAttribute: string;
    lookup: Query$2;
    objectId: string;
} & PersistentObjectAttribute$2;
declare type PersistentObjectTab$2 = {
    columnCount: number;
    id?: string;
    name: string;
};
declare type Query$2 = {
    actionLabels?: KeyValueString;
    actions: string[];
    allowTextSearch: boolean;
    allSelected: boolean;
    allSelectedInversed: boolean;
    autoQuery: boolean;
    canRead: boolean;
    columns: QueryColumn$1[];
    disableBulkEdit: boolean;
    enableSelectAll: boolean;
    filters: PersistentObject$2;
    groupedBy: string;
    id: string;
    label: string;
    name: string;
    notification: string;
    notificationType: NotificationType$1;
    notificationDuration: number;
    pageSize: number;
    persistentObject: PersistentObject$2;
    result: QueryResult;
    sortOptions: string;
    textSearch: string;
};
declare type QueryColumn$1 = {
    canFilter: boolean;
    canGroupBy: boolean;
    canListDistincts: boolean;
    canSort: boolean;
    id: string;
    isHidden: boolean;
    isSensitive?: boolean;
    label: string;
    name: string;
    offset: number;
    persistentObjectId: string;
    type: string;
};
declare type QueryResult = {
    charts: QueryChart$1[];
    columns: QueryColumn$1[];
    continuation?: string;
    groupedBy?: string;
    groupingInfo?: QueryGroupingInfo;
    items: QueryResultItem$1[];
    notification?: string;
    notificationDuration?: number;
    notificationType?: NotificationType$1;
    pageSize?: number;
    skip?: number;
    sortOptions: string;
    totalItem?: QueryResultItem$1;
    totalItems?: number;
};
declare type QueryResultItem$1 = {
    id: string;
    values: QueryResultItemValue$1[];
    typeHints?: KeyValueString;
};
declare type QueryResultItemValue$1 = {
    key: string;
    value: string;
    objectId?: string;
    typeHints?: KeyValueString;
};
declare type QueryGroupingInfo = {
    groupedBy: string;
    groups?: QueryResultItemGroup$1[];
};
declare type QueryResultItemGroup$1 = {
    name: string;
    count: number;
};
declare type QueryChart$1 = {
    label: string;
    name: string;
    type: string;
    options: any;
};
declare type RetryAction = {
    cancelOption?: number;
    defaultOption?: number;
    message: string;
    options: string[];
    persistentObject?: PersistentObject$2;
    title: string;
};
declare type ProfilerRequest$1 = {
    method: string;
    profiler: Profiler$1;
    request: any;
    response: any;
    transport: number;
    when: Date;
};
declare type Profiler$1 = {
    elapsedMilliseconds: number;
    entries: ProfilerEntry[];
    exceptions: {
        id: string;
        message: string;
    }[];
    sql: ProfilerSql[];
    taskId: number;
};
declare type ProfilerEntry = {
    arguments: any[];
    elapsedMilliseconds: number;
    entries: ProfilerEntry[];
    exception: string;
    hasNPlusOne?: boolean;
    methodName: string;
    sql: string[];
    started: number;
};
declare type ProfilerSql = {
    commandId: string;
    commandText: string;
    elapsedMilliseconds: number;
    parameters: ProfilerSqlParameter[];
    recordsAffected: number;
    taskId: number;
    type: string;
};
declare type ProfilerSqlParameter = {
    name: string;
    type: string;
    value: string;
};

type service_ApplicationResponse = ApplicationResponse;
type service_ClientData = ClientData;
type service_ExecuteActionParameters = ExecuteActionParameters;
type service_ExecuteActionRefreshParameters = ExecuteActionRefreshParameters;
type service_ExecuteActionRequest = ExecuteActionRequest;
type service_ExecuteActionResponse = ExecuteActionResponse;
type service_ExecutePersistentObjectActionRequest = ExecutePersistentObjectActionRequest;
type service_ExecuteQueryActionRequest = ExecuteQueryActionRequest;
type service_ExecuteQueryFilterActionRequest = ExecuteQueryFilterActionRequest;
type service_ExecuteQueryRequest = ExecuteQueryRequest;
type service_ExecuteQueryResponse = ExecuteQueryResponse;
type service_GetApplicationRequest = GetApplicationRequest;
type service_GetPersistentObjectRequest = GetPersistentObjectRequest;
type service_GetPersistentObjectResponse = GetPersistentObjectResponse;
type service_GetQueryRequest = GetQueryRequest;
type service_GetQueryResponse = GetQueryResponse;
type service_Languages = Languages;
type service_PersistentObjectAttributeVisibility = PersistentObjectAttributeVisibility;
type service_PersistentObjectStateBehavior = PersistentObjectStateBehavior;
type service_ProfilerEntry = ProfilerEntry;
type service_ProfilerSql = ProfilerSql;
type service_ProfilerSqlParameter = ProfilerSqlParameter;
type service_ProviderParameters = ProviderParameters;
type service_QueryGroupingInfo = QueryGroupingInfo;
type service_QueryResult = QueryResult;
type service_RetryAction = RetryAction;
declare namespace service {
  export type { service_ApplicationResponse as ApplicationResponse, service_ClientData as ClientData, service_ExecuteActionParameters as ExecuteActionParameters, service_ExecuteActionRefreshParameters as ExecuteActionRefreshParameters, service_ExecuteActionRequest as ExecuteActionRequest, service_ExecuteActionResponse as ExecuteActionResponse, service_ExecutePersistentObjectActionRequest as ExecutePersistentObjectActionRequest, service_ExecuteQueryActionRequest as ExecuteQueryActionRequest, service_ExecuteQueryFilterActionRequest as ExecuteQueryFilterActionRequest, service_ExecuteQueryRequest as ExecuteQueryRequest, service_ExecuteQueryResponse as ExecuteQueryResponse, service_GetApplicationRequest as GetApplicationRequest, service_GetPersistentObjectRequest as GetPersistentObjectRequest, service_GetPersistentObjectResponse as GetPersistentObjectResponse, service_GetQueryRequest as GetQueryRequest, service_GetQueryResponse as GetQueryResponse, Language$1 as Language, service_Languages as Languages, NotificationType$1 as NotificationType, PersistentObject$2 as PersistentObject, PersistentObjectAttribute$2 as PersistentObjectAttribute, service_PersistentObjectAttributeVisibility as PersistentObjectAttributeVisibility, PersistentObjectAttributeWithReference$1 as PersistentObjectAttributeWithReference, service_PersistentObjectStateBehavior as PersistentObjectStateBehavior, PersistentObjectTab$2 as PersistentObjectTab, Profiler$1 as Profiler, service_ProfilerEntry as ProfilerEntry, ProfilerRequest$1 as ProfilerRequest, service_ProfilerSql as ProfilerSql, service_ProfilerSqlParameter as ProfilerSqlParameter, service_ProviderParameters as ProviderParameters, Query$2 as Query, QueryChart$1 as QueryChart, QueryColumn$1 as QueryColumn, service_QueryGroupingInfo as QueryGroupingInfo, service_QueryResult as QueryResult, QueryResultItem$1 as QueryResultItem, QueryResultItemGroup$1 as QueryResultItemGroup, QueryResultItemValue$1 as QueryResultItemValue, Request$1 as Request, Response$1 as Response, service_RetryAction as RetryAction, SortDirection$1 as SortDirection };
}

declare class ServiceObject extends Observable<ServiceObject> {
    service: Service;
    constructor(service: Service);
    copyProperties(propertyNames: Array<string>, includeNullValues?: boolean, result?: any): any;
}

declare class QueryResultItemValue extends ServiceObject {
    private _item;
    private _column;
    private _value;
    private _valueParsed;
    key: string;
    value: string;
    typeHints: any;
    persistentObjectId: string;
    objectId: string;
    constructor(service: Service, _item: QueryResultItem, value: any);
    get item(): QueryResultItem;
    get column(): QueryColumn;
    getTypeHint(name: string, defaultValue?: string, typeHints?: any): string;
    getValue(): any;
    _toServiceObject(): any;
}

interface IQueryColumnDistincts {
    matching: string[];
    remaining: string[];
    isDirty: boolean;
    hasMore: boolean;
}
type SortDirection = SortDirection$1;
declare class QueryColumn extends ServiceObject {
    query: Query$1;
    private _id;
    private _displayAttribute;
    private _sortDirection;
    private _canSort;
    private _canGroupBy;
    private _canFilter;
    private _canListDistincts;
    private _isSensitive;
    private _name;
    private _type;
    private _label;
    private _distincts;
    private _selectedDistincts;
    private _selectedDistinctsInversed;
    private _total;
    offset: number;
    isPinned: boolean;
    isHidden: boolean;
    width: string;
    typeHints: any;
    constructor(service: Service, col: QueryColumn$1, query: Query$1);
    get id(): string;
    get name(): string;
    get type(): string;
    get label(): string;
    get canFilter(): boolean;
    get canSort(): boolean;
    get canGroupBy(): boolean;
    get canListDistincts(): boolean;
    get displayAttribute(): string;
    get isSensitive(): boolean;
    get isSorting(): boolean;
    get sortDirection(): SortDirection;
    get selectedDistincts(): string[];
    set selectedDistincts(selectedDistincts: string[]);
    get selectedDistinctsInversed(): boolean;
    set selectedDistinctsInversed(selectedDistinctsInversed: boolean);
    get distincts(): IQueryColumnDistincts;
    set distincts(distincts: IQueryColumnDistincts);
    get total(): QueryResultItemValue;
    private _setTotal;
    private _setSortDirection;
    _toServiceObject(): any;
    getTypeHint(name: string, defaultValue?: string, typeHints?: any, ignoreCasing?: boolean): string;
    refreshDistincts(search?: string): Promise<IQueryColumnDistincts>;
    sort(direction: SortDirection, multiSort?: boolean): Promise<QueryResultItem[]>;
    private _queryPropertyChanged;
}

declare class PersistentObjectAttributeGroup extends Observable<PersistentObjectAttributeGroup> {
    service: Service;
    key: string;
    parent: PersistentObject$1;
    private _attributes;
    label: string;
    index: number;
    constructor(service: Service, key: string, _attributes: PersistentObjectAttribute$1[], parent: PersistentObject$1);
    get attributes(): PersistentObjectAttribute$1[];
    set attributes(attributes: PersistentObjectAttribute$1[]);
}

declare class PersistentObjectTab$1 extends Observable<PersistentObjectTab$1> {
    service: Service;
    name: string;
    label: string;
    target: ServiceObjectWithActions;
    parent?: PersistentObject$1;
    private _isVisible;
    tabGroupIndex: number;
    constructor(service: Service, name: string, label: string, target: ServiceObjectWithActions, parent?: PersistentObject$1, _isVisible?: boolean);
    get isVisible(): boolean;
    set isVisible(val: boolean);
}
declare class PersistentObjectAttributeTab extends PersistentObjectTab$1 {
    private _groups;
    key: string;
    id: string;
    private _layout;
    columnCount: number;
    private _attributes;
    constructor(service: Service, _groups: PersistentObjectAttributeGroup[], key: string, id: string, name: string, _layout: any, po: PersistentObject$1, columnCount: number, isVisible: boolean);
    get isVisible(): boolean;
    set isVisible(val: boolean);
    get layout(): any;
    private _setLayout;
    get attributes(): PersistentObjectAttribute$1[];
    get groups(): PersistentObjectAttributeGroup[];
    set groups(groups: PersistentObjectAttributeGroup[]);
    saveLayout(layout: any): Promise<any>;
    private _updateAttributes;
}
declare class PersistentObjectQueryTab extends PersistentObjectTab$1 {
    query: Query$1;
    constructor(service: Service, query: Query$1);
    get isVisible(): boolean;
}

type PersistentObjectAttributeOption = KeyValuePair<string, string>;
declare class PersistentObjectAttribute$1 extends ServiceObject {
    parent: PersistentObject$1;
    private _isSystem;
    private _lastParsedValue;
    private _cachedValue;
    private _serviceValue;
    private _serviceOptions;
    private _displayValueSource;
    private _displayValue;
    private _rules;
    private _validationError;
    private _tab;
    private _tabKey;
    private _group;
    private _groupKey;
    private _isRequired;
    private _isReadOnly;
    private _isValueChanged;
    private _isSensitive;
    private _visibility;
    private _isVisible;
    protected _shouldRefresh: boolean;
    private _refreshServiceValue;
    id: string;
    name: string;
    label: string;
    options: string[] | PersistentObjectAttributeOption[];
    offset: number;
    type: string;
    toolTip: string;
    typeHints: any;
    disableSort: boolean;
    triggersRefresh: boolean;
    column: number;
    columnSpan: number;
    input: HTMLInputElement;
    constructor(service: Service, attr: PersistentObjectAttribute$2, parent: PersistentObject$1);
    get groupKey(): string;
    get group(): PersistentObjectAttributeGroup;
    set group(group: PersistentObjectAttributeGroup);
    get tabKey(): string;
    get tab(): PersistentObjectAttributeTab;
    set tab(tab: PersistentObjectAttributeTab);
    get isSystem(): boolean;
    get visibility(): PersistentObjectAttributeVisibility;
    set visibility(visibility: PersistentObjectAttributeVisibility);
    get isVisible(): boolean;
    get validationError(): string;
    set validationError(error: string);
    get rules(): string;
    private _setRules;
    get isRequired(): boolean;
    private _setIsRequired;
    get isReadOnly(): boolean;
    private _setIsReadOnly;
    get displayValue(): string;
    get shouldRefresh(): boolean;
    get value(): any;
    set value(val: any);
    setValue(val: any, allowRefresh?: boolean): Promise<any>;
    get isValueChanged(): boolean;
    set isValueChanged(isValueChanged: boolean);
    get isSensitive(): boolean;
    getTypeHint(name: string, defaultValue?: string, typeHints?: any, ignoreCasing?: boolean): string;
    _toServiceObject(): any;
    _refreshFromResult(resultAttr: PersistentObjectAttribute$1, resultWins: boolean): boolean;
    _triggerAttributeRefresh(immediate?: boolean): Promise<any>;
    protected _setOptions(options: string[]): void;
}

declare class PersistentObjectAttributeAsDetail$1 extends PersistentObjectAttribute$1 {
    parent: PersistentObject$1;
    private _objects;
    details: Query$1;
    lookupAttribute: string;
    constructor(service: Service, attr: any, parent: PersistentObject$1);
    get objects(): PersistentObject$1[];
    private _setObjects;
    newObject(): Promise<PersistentObject$1>;
    _refreshFromResult(resultAttr: PersistentObjectAttribute$1, resultWins: boolean): boolean;
    _toServiceObject(): any;
    onChanged(allowRefresh: boolean): Promise<any>;
}

declare class QueryFilters extends Observable<QueryFilters> {
    private _query;
    private _filtersPO;
    private _filters;
    private _currentFilter;
    private _filtersAsDetail;
    private _skipSearch;
    constructor(_query: Query$1, _filtersPO: PersistentObject$1);
    get filters(): QueryFilter[];
    private _setFilters;
    get detailsAttribute(): PersistentObjectAttributeAsDetail$1;
    get currentFilter(): QueryFilter;
    set currentFilter(filter: QueryFilter);
    private _computeFilters;
    private _computeFilterData;
    clone(targetQuery: Query$1): QueryFilters;
    getFilter(name: string): QueryFilter;
    createNew(): Promise<QueryFilter>;
    save(filter?: QueryFilter): Promise<boolean>;
    delete(name: string | QueryFilter): Promise<any>;
}
declare class QueryFilter extends Observable<QueryFilter> {
    persistentObject: PersistentObject$1;
    constructor(persistentObject: PersistentObject$1);
    get name(): string;
    get isLocked(): boolean;
    get isDefault(): boolean;
}

declare class QueryChart extends Observable<QueryChart> {
    private _query;
    private _label;
    private _name;
    private _options;
    private _type;
    constructor(_query: Query$1, _label: string, _name: string, _options: any, _type: string);
    get query(): Query$1;
    get label(): string;
    get name(): string;
    get options(): any;
    get type(): string;
    execute(parameters?: any): Promise<any>;
}

interface IQueryGroupingInfo extends QueryGroupingInfo {
    groups?: QueryResultItemGroup[];
}
declare class QueryResultItemGroup extends Observable<QueryResultItemGroup> implements QueryResultItemGroup$1 {
    readonly query: Query$1;
    private _start;
    private _end;
    private _notifier;
    private _name;
    private _count;
    private _items;
    private _isCollapsed;
    constructor(query: Query$1, group: QueryResultItemGroup$1, _start: number, _end: number, _notifier: () => void);
    get name(): string;
    get count(): number;
    get start(): number;
    get end(): number;
    get items(): QueryResultItem[];
    get isCollapsed(): boolean;
    set isCollapsed(isCollapsed: boolean);
    update(group: QueryResultItemGroup$1, start: number, end: number): void;
}

interface ISortOption {
    column: QueryColumn;
    name: string;
    direction: SortDirection;
}
interface IQuerySelectAll {
    isAvailable: boolean;
    allSelected: boolean;
    inverse: boolean;
}
declare class Query$1 extends ServiceObjectWithActions {
    parent?: PersistentObject$1;
    maxSelectedItems?: number;
    private _lastResult;
    private _asLookup;
    private _isSelectionModifying;
    private _totalItems;
    private _labelWithTotalItems;
    private _sortOptions;
    private _queriedPages;
    private _filters;
    private _allowTextSearch;
    private _canFilter;
    private _canRead;
    private _canReorder;
    private _charts;
    private _defaultChartName;
    private _currentChart;
    private _lastUpdated;
    private _totalItem;
    private _isSystem;
    private _isFiltering;
    private _columnObservers;
    private _hasMore;
    private _groupingInfo;
    private _items;
    private _queuedLazyItemIndexes;
    private _queuedLazyItemIndexesTimeout;
    persistentObject: PersistentObject$1;
    columns: QueryColumn[];
    id: string;
    name: string;
    autoQuery: boolean;
    isHidden: boolean;
    hasSearched: boolean;
    label: string;
    singularLabel: string;
    offset: number;
    textSearch: string;
    pageSize: number;
    skip: number;
    top: number;
    continuation: string;
    selectAll: IQuerySelectAll;
    disableLazyLoading: boolean;
    constructor(service: Service, query: Query$2, parent?: PersistentObject$1, asLookup?: boolean, maxSelectedItems?: number);
    get isSystem(): boolean;
    get allowTextSearch(): boolean;
    get filters(): QueryFilters;
    get canFilter(): boolean;
    private _setCanFilter;
    get hasMore(): boolean;
    private _setHasMore;
    get canRead(): boolean;
    get canReorder(): boolean;
    get charts(): QueryChart[];
    private _setCharts;
    get currentChart(): QueryChart;
    set currentChart(currentChart: QueryChart);
    get defaultChartName(): string;
    set defaultChartName(defaultChart: string);
    get groupingInfo(): IQueryGroupingInfo;
    private _setGroupingInfo;
    get lastUpdated(): Date;
    private _setLastUpdated;
    get selectedItems(): QueryResultItem[];
    set selectedItems(items: QueryResultItem[]);
    private _selectAllPropertyChanged;
    resetFilters(): Promise<void>;
    selectRange(from: number, to: number): boolean;
    get asLookup(): boolean;
    get totalItems(): number;
    get labelWithTotalItems(): string;
    get sortOptions(): ISortOption[];
    get totalItem(): QueryResultItem;
    private _setTotalItem;
    set sortOptions(options: ISortOption[]);
    group(column: QueryColumn): Promise<QueryResultItem[]>;
    group(by: string): Promise<QueryResultItem[]>;
    reorder(before: QueryResultItem, item: QueryResultItem, after: QueryResultItem): Promise<QueryResultItem[]>;
    private _setSortOptionsFromService;
    private _setTotalItems;
    get isFiltering(): boolean;
    private _updateIsFiltering;
    _toServiceObject(): any;
    _setResult(result: QueryResult): void;
    getColumn(name: string): QueryColumn;
    get items(): QueryResultItem[];
    private set items(value);
    private _getItemsLazy;
    getItemsByIndex(...indexes: number[]): Promise<QueryResultItem[]>;
    getItems(start: number, length?: number, skipQueue?: boolean): Promise<QueryResultItem[]>;
    search(options?: {
        delay?: number;
        throwExceptions?: boolean;
        keepSelection?: boolean;
    }): Promise<QueryResultItem[]>;
    clone(asLookup?: boolean): Query$1;
    private _updateColumns;
    private _updateGroupingInfo;
    private _queryColumnPropertyChanged;
    _notifyItemSelectionChanged(item: QueryResultItem): void;
    private _updateSelectAll;
}

declare class QueryResultItem extends ServiceObject {
    query: Query$1;
    private _isSelected;
    private _ignoreSelect;
    id: string;
    rawValues: QueryResultItemValue[];
    typeHints: any;
    private _fullValuesByName;
    private _values;
    constructor(service: Service, item: any, query: Query$1, _isSelected: boolean);
    get values(): {
        [key: string]: any;
    };
    get isSelected(): boolean;
    set isSelected(val: boolean);
    get ignoreSelect(): boolean;
    getValue(key: string): any;
    getFullValue(key: string): QueryResultItemValue;
    getTypeHint(name: string, defaultValue?: string, typeHints?: any): string;
    getPersistentObject(throwExceptions?: boolean): Promise<PersistentObject$1>;
    _toServiceObject(): any;
}

interface ActionDefinitionParams {
    name: string;
    displayName?: string;
    isPinned?: boolean;
    isStreaming?: boolean;
    showedOn?: string[];
    confirmation?: string;
    refreshQueryOnCompleted?: boolean;
    keepSelectionOnRefresh?: boolean;
    offset?: number;
    selectionRule?: string;
    options?: ("PersistentObject" | "Query")[];
    icon?: string;
}
declare class ActionDefinition {
    private readonly _service;
    private _groupDefinition;
    private _selectionRule;
    private readonly _definition;
    constructor(service: Service, definition: ActionDefinitionParams);
    constructor(service: Service, item: QueryResultItem);
    get name(): string;
    get displayName(): string;
    get isPinned(): boolean;
    get isStreaming(): boolean;
    get refreshQueryOnCompleted(): boolean;
    get keepSelectionOnRefresh(): boolean;
    get offset(): number;
    get confirmation(): string;
    get options(): Array<string>;
    get selectionRule(): (count: number) => boolean;
    get showedOn(): string[];
    get groupDefinition(): ActionDefinition;
    get icon(): string;
}

declare class ActionGroup extends ServiceObject {
    service: Service;
    definition: ActionDefinition;
    private _actions;
    private _canExecute;
    private _isVisible;
    constructor(service: Service, definition: ActionDefinition);
    addAction(action: Action): void;
    removeAction(action: Action): void;
    get actions(): Action[];
    get name(): string;
    get displayName(): string;
    get canExecute(): boolean;
    private _setCanExecute;
    get isVisible(): boolean;
    private _setIsVisible;
    get isPinned(): boolean;
    get options(): string[];
    private _actionPropertyChanged;
}

interface IActionExecuteOptions {
    menuOption?: number;
    parameters?: any;
    selectedItems?: QueryResultItem[];
    skipOpen?: boolean;
    noConfirmation?: boolean;
    throwExceptions?: boolean;
}
interface ISelectedItemsActionArgs {
    name: string;
    isVisible: boolean;
    canExecute: boolean;
    options: string[];
}
type ActionExecutionHandler = (action: Action, worker: Promise<PersistentObject$1>, args: IActionExecuteOptions) => boolean | void | Promise<void>;
type ActionExecutionHandlerDispose = () => void;
declare class Action extends ServiceObject {
    service: Service;
    definition: ActionDefinition;
    owner: ServiceObjectWithActions;
    private _targetType;
    private _query;
    private _parent;
    private _isVisible;
    private _canExecute;
    private _block;
    private _parameters;
    private _offset;
    protected _isPinned: boolean;
    private _options;
    private _executeHandlers;
    private _group;
    selectionRule: (count: number) => boolean;
    displayName: string;
    dependentActions: any[];
    constructor(service: Service, definition: ActionDefinition, owner: ServiceObjectWithActions);
    get parent(): PersistentObject$1;
    get query(): Query$1;
    get offset(): number;
    set offset(value: number);
    get name(): string;
    get group(): ActionGroup;
    get canExecute(): boolean;
    set canExecute(val: boolean);
    set block(block: boolean);
    get isVisible(): boolean;
    set isVisible(val: boolean);
    get isPinned(): boolean;
    get options(): string[];
    private _setOptions;
    subscribe(handler: ActionExecutionHandler): ActionExecutionHandlerDispose;
    execute(options?: IActionExecuteOptions): Promise<PersistentObject$1>;
    protected _onExecute(options: IActionExecuteOptions): Promise<PersistentObject$1>;
    _getParameters(parameters: any, option: any): any;
    _onParentIsEditingChanged(isEditing: boolean): void;
    _onParentIsDirtyChanged(isDirty: boolean): void;
    private _setNotification;
    static get(service: Service, name: string, owner: ServiceObjectWithActions): Action;
    static addActions(service: Service, owner: ServiceObjectWithActions, actions: Action[], actionNames: string[]): void;
}
declare let Actions: {
    [name: string]: typeof Action;
};

declare class ServiceObjectWithActions extends ServiceObject {
    private _actionNames;
    private _actionLabels?;
    private _queue;
    private _isBusy;
    private _notification;
    private _notificationType;
    private _notificationDuration;
    actions: Array<Action> & {
        [name: string]: Action;
    };
    constructor(service: Service, _actionNames?: string[], _actionLabels?: {
        [key: string]: string;
    });
    get isBusy(): boolean;
    private _setIsBusy;
    get notification(): string;
    get notificationType(): NotificationType;
    get notificationDuration(): number;
    getAction(name: string): Action;
    setNotification(notification?: string, type?: NotificationType, duration?: number, skipShowNotification?: boolean): any;
    setNotification(notification?: Error, type?: NotificationType, duration?: number, skipShowNotification?: boolean): any;
    queueWork<T>(work: () => Promise<T>, blockActions?: boolean): Promise<T>;
    protected _initializeActions(): void;
    private _blockActions;
}

declare class PersistentObjectAttributeWithReference extends PersistentObjectAttribute$1 {
    parent: PersistentObject$1;
    lookup: Query$1;
    objectId: string;
    displayAttribute: string;
    canAddNewReference: boolean;
    selectInPlace: boolean;
    constructor(service: Service, attr: any, parent: PersistentObject$1);
    addNewReference(): Promise<void>;
    changeReference(selectedItems: QueryResultItem[] | string[]): Promise<boolean>;
    getPersistentObject(): Promise<PersistentObject$1>;
    _refreshFromResult(resultAttr: PersistentObjectAttribute$1, resultWins: boolean): boolean;
}

declare enum PersistentObjectLayoutMode {
    FullPage = 0,
    MasterDetail = 1
}
declare class PersistentObject$1 extends ServiceObjectWithActions {
    private _isSystem;
    private _lastResult;
    private _lastUpdated;
    private _lastResultBackup;
    private securityToken;
    private _isEditing;
    private _isDirty;
    private _id;
    private _type;
    private _breadcrumb;
    private _isDeleted;
    private _tabs;
    private _isFrozen;
    readonly isBreadcrumbSensitive: boolean;
    readonly forceFromAction: boolean;
    fullTypeName: string;
    label: string;
    objectId: string;
    isHidden: boolean;
    isNew: boolean;
    isReadOnly: boolean;
    queryLayoutMode: PersistentObjectLayoutMode;
    newOptions: string;
    ignoreCheckRules: boolean;
    stateBehavior: string;
    dialogSaveAction: Action;
    parent: PersistentObject$1;
    ownerDetailAttribute: PersistentObjectAttributeAsDetail$1;
    ownerAttributeWithReference: PersistentObjectAttributeWithReference;
    ownerPersistentObject: PersistentObject$1;
    ownerQuery: Query$1;
    bulkObjectIds: string[];
    queriesToRefresh: Array<string>;
    attributes: PersistentObjectAttribute$1[];
    queries: Query$1[];
    constructor(service: Service, po: PersistentObject$2);
    private _createPersistentObjectAttribute;
    get id(): string;
    get isSystem(): boolean;
    get type(): string;
    get isBulkEdit(): boolean;
    get tabs(): PersistentObjectTab$1[];
    set tabs(tabs: PersistentObjectTab$1[]);
    get isEditing(): boolean;
    private setIsEditing;
    get breadcrumb(): string;
    private _setBreadcrumb;
    get isDirty(): boolean;
    private _setIsDirty;
    get isDeleted(): boolean;
    set isDeleted(isDeleted: boolean);
    get isFrozen(): boolean;
    freeze(): void;
    unfreeze(): void;
    getAttribute(name: string): PersistentObjectAttribute$1;
    getAttributeValue(name: string): any;
    setAttributeValue(name: string, value: any, allowRefresh?: boolean): Promise<any>;
    get lastUpdated(): Date;
    private _setLastUpdated;
    getQuery(name: string): Query$1;
    beginEdit(): void;
    cancelEdit(): void;
    save(waitForOwnerQuery?: boolean): Promise<boolean>;
    toServiceObject(skipParent?: boolean): any;
    refreshFromResult(result: PersistentObject$1, resultWins?: boolean): void;
    refreshTabsAndGroups(...changedAttributes: PersistentObjectAttribute$1[]): void;
    triggerDirty(): boolean;
    _triggerAttributeRefresh(attr: PersistentObjectAttribute$1, immediate?: boolean): Promise<boolean>;
    _prepareAttributesForRefresh(sender: PersistentObjectAttribute$1): void;
}

declare class ProgramUnitItem extends ServiceObject {
    path?: string;
    nameKebab?: string;
    id: string;
    title: string;
    name: string;
    constructor(service: Service, unitItem: any, path?: string, nameKebab?: string);
}
declare class ProgramUnitItemGroup extends ProgramUnitItem {
    items: ProgramUnitItem[];
    constructor(service: Service, unitItem: any, items: ProgramUnitItem[]);
}
declare class ProgramUnitItemQuery extends ProgramUnitItem {
    queryId: string;
    constructor(service: Service, routes: IRoutes, unitItem: any, parent: ProgramUnit);
    private static _getPath;
}
declare class ProgramUnitItemPersistentObject extends ProgramUnitItem {
    persistentObjectId: string;
    persistentObjectObjectId: string;
    constructor(service: Service, routes: IRoutes, unitItem: any, parent: ProgramUnit);
    private static _getPath;
}
declare class ProgramUnitItemUrl extends ProgramUnitItem {
    constructor(service: Service, unitItem: any);
}
declare class ProgramUnitItemSeparator extends ProgramUnitItem {
    constructor(service: Service, unitItem: any);
}

declare class ProgramUnit extends ProgramUnitItem {
    offset: number;
    openFirst: boolean;
    items: ProgramUnitItem[];
    constructor(service: Service, routes: IRoutes, unit: any);
    private _createItem;
}

declare class Application extends PersistentObject$1 {
    private _userId;
    private _friendlyUserName;
    private _feedbackId;
    private _userSettingsId;
    private _globalSearchId;
    private _analyticsKey;
    private _userSettings;
    private _canProfile;
    private _hasManagement;
    private _session;
    private _routes;
    private _poRe;
    private _queryRe;
    readonly programUnits: ProgramUnit[];
    readonly hasSensitive: boolean;
    constructor(service: Service, { application, hasSensitive }: ApplicationResponse);
    get userId(): string;
    get friendlyUserName(): string;
    get feedbackId(): string;
    get userSettingsId(): string;
    get globalSearchId(): string;
    get analyticsKey(): string;
    get userSettings(): any;
    get canProfile(): boolean;
    get hasManagement(): boolean;
    get session(): PersistentObject$1;
    get routes(): IRoutes;
    private _setRoutes;
    get poRe(): RegExp;
    get queryRe(): RegExp;
    saveUserSettings(): Promise<any>;
    _updateSession(session: any): void;
}
interface IRoutes {
    programUnits: {
        [name: string]: string;
    };
    persistentObjects: {
        [type: string]: string;
    };
    persistentObjectKeys: string[];
    queries: {
        [type: string]: string;
    };
    queryKeys: string[];
}

declare class ExecuteActionArgs {
    private service;
    persistentObject: PersistentObject$1;
    query: Query$1;
    selectedItems: Array<QueryResultItem>;
    parameters: any;
    private _action;
    action: string;
    isHandled: boolean;
    result: PersistentObject$1;
    constructor(service: Service, action: string, persistentObject: PersistentObject$1, query: Query$1, selectedItems: Array<QueryResultItem>, parameters: any);
    executeServiceRequest(): Promise<PersistentObject$1>;
}

declare class Language extends Observable<ServiceObject> implements Language$1 {
    private _language;
    private _culture;
    constructor(_language: Language$1, _culture: string);
    get culture(): string;
    get name(): string;
    get isDefault(): boolean;
    get messages(): {
        [key: string]: string;
    };
    set messages(value: {
        [key: string]: string;
    });
}

type StreamingActionMessages = AsyncGenerator<string, void, unknown>;
declare class ServiceHooks {
    private _service;
    get service(): Service;
    createData(data: any): void;
    onFetch(request: Request): Promise<Response>;
    trackEvent(name: string, option: string, owner: ServiceObjectWithActions): void;
    onInitialize(clientData: ClientData): Promise<ClientData>;
    onSessionExpired(): Promise<boolean>;
    onActionConfirmation(action: Action, option: number): Promise<boolean>;
    onAction(args: ExecuteActionArgs): Promise<PersistentObject$1>;
    onStreamingAction(action: string, messages: () => StreamingActionMessages, abort?: () => void): Promise<void>;
    onOpen(obj: ServiceObject, replaceCurrent?: boolean, forceFromAction?: boolean): void;
    onClose(obj: ServiceObject): void;
    onConstructApplication(application: ApplicationResponse): Application;
    onConstructPersistentObject(service: Service, po: any): PersistentObject$1;
    onConstructPersistentObjectAttributeTab(service: Service, groups: PersistentObjectAttributeGroup[], key: string, id: string, name: string, layout: any, parent: PersistentObject$1, columnCount: number, isVisible: boolean): PersistentObjectAttributeTab;
    onConstructPersistentObjectQueryTab(service: Service, query: Query$1): PersistentObjectQueryTab;
    onConstructPersistentObjectAttributeGroup(service: Service, key: string, attributes: PersistentObjectAttribute$1[], parent: PersistentObject$1): PersistentObjectAttributeGroup;
    onConstructPersistentObjectAttribute(service: Service, attr: any, parent: PersistentObject$1): PersistentObjectAttribute$1;
    onConstructPersistentObjectAttributeWithReference(service: Service, attr: any, parent: PersistentObject$1): PersistentObjectAttributeWithReference;
    onConstructPersistentObjectAttributeAsDetail(service: Service, attr: any, parent: PersistentObject$1): PersistentObjectAttributeAsDetail$1;
    onConstructQuery(service: Service, query: any, parent?: PersistentObject$1, asLookup?: boolean, maxSelectedItems?: number): Query$1;
    onConstructQueryResultItem(service: Service, item: any, query: Query$1, isSelected?: boolean): QueryResultItem;
    onConstructQueryResultItemValue(service: Service, item: QueryResultItem, value: any): QueryResultItemValue;
    onConstructQueryColumn(service: Service, col: any, query: Query$1): QueryColumn;
    onConstructAction(service: Service, action: Action): Action;
    onSortPersistentObjectTabs(parent: PersistentObject$1, attributeTabs: PersistentObjectAttributeTab[], queryTabs: PersistentObjectQueryTab[]): PersistentObjectTab$1[];
    onMessageDialog(title: string, message: string, rich: boolean, ...actions: string[]): Promise<number>;
    onShowNotification(notification: string, type: NotificationType, duration: number): void;
    onSelectReference(query: Query$1): Promise<QueryResultItem[]>;
    onNavigate(path: string, replaceCurrent?: boolean): void;
    onClientOperation(operation: IClientOperation): void;
    onSelectedItemsActions(query: Query$1, selectedItems: QueryResultItem[], action: ISelectedItemsActionArgs): void;
    onRefreshFromResult(po: PersistentObject$1): void;
    onUpdateAvailable(): void;
    onRetryAction(retry: RetryAction): Promise<string>;
    onGetAttributeDisplayValue(attribute: PersistentObjectAttribute$1, value: any): string;
    setDefaultTranslations(languages: Language[]): void;
}

interface IClientOperation {
    type: string;
}
interface IRefreshOperation extends IClientOperation {
    delay?: number;
    queryId?: string;
    fullTypeName?: string;
    objectId?: string;
}
interface IExecuteMethodOperation extends IClientOperation {
    name: string;
    arguments: any[];
}
interface IOpenOperation extends IClientOperation {
    persistentObject: any;
    replace?: boolean;
}
declare const ClientOperations: {
    enableDatadog: (hooks: ServiceHooks, applicationId: string, clientToken: string, site: string, service: string, version?: string, environment?: string) => void;
    navigate: (hooks: ServiceHooks, path: string, replaceCurrent?: boolean) => void;
    openUrl: (hooks: ServiceHooks, url: string) => void;
    refreshForUpdate: (hooks: ServiceHooks, path: string, replaceCurrent?: boolean) => void;
    reloadPage: () => void;
    showMessageBox: (hooks: ServiceHooks, title: string, message: string, rich?: boolean, delay?: number) => void;
};

declare let version: string;
declare type NotificationType = NotificationType$1;
declare class Service extends Observable<Service> {
    serviceUri: string;
    hooks: ServiceHooks;
    readonly isTransient: boolean;
    private static _token;
    private _lastAuthTokenUpdate;
    private _isUsingDefaultCredentials;
    private _clientData;
    private _language;
    private _languages;
    private _windowsAuthentication;
    private _providers;
    private _isSignedIn;
    private _application;
    private _userName;
    private _authToken;
    private _profile;
    private _profiledRequests;
    private _queuedClientOperations;
    private _initial;
    staySignedIn: boolean;
    icons: KeyValue<string>;
    actionDefinitions: KeyValue<ActionDefinition>;
    environment: string;
    environmentVersion: string;
    clearSiteData: boolean;
    constructor(serviceUri: string, hooks?: ServiceHooks, isTransient?: boolean);
    static set token(token: string);
    private _createUri;
    private _createData;
    private _fetch;
    private _getJSON;
    private _postJSON;
    private _postJSONProcess;
    get queuedClientOperations(): IClientOperation[];
    get application(): Application;
    private _setApplication;
    get initial(): PersistentObject$1;
    get language(): Language;
    set language(l: Language);
    get requestedLanguage(): string;
    set requestedLanguage(val: string);
    get isSignedIn(): boolean;
    private _setIsSignedIn;
    get languages(): Language[];
    get windowsAuthentication(): boolean;
    get providers(): {
        [name: string]: ProviderParameters;
    };
    get isUsingDefaultCredentials(): boolean;
    get userName(): string;
    private set userName(value);
    get defaultUserName(): string;
    get registerUserName(): string;
    get authToken(): string;
    set authToken(val: string);
    get authTokenType(): "Basic" | "JWT" | null;
    get profile(): boolean;
    set profile(val: boolean);
    get profiledRequests(): ProfilerRequest$1[];
    private _setProfiledRequests;
    getTranslatedMessage(key: string, ...params: string[]): string;
    getCredentialType(userName: string): Promise<any>;
    initialize(skipDefaultCredentialLogin?: boolean): Promise<Application>;
    signInExternal(providerName: string): void;
    signInUsingCredentials(userName: string, password: string, staySignedIn?: boolean): Promise<Application>;
    signInUsingCredentials(userName: string, password: string, code?: string, staySignedIn?: boolean): Promise<Application>;
    signInUsingDefaultCredentials(): Promise<Application>;
    signOut(skipAcs?: boolean): Promise<boolean>;
    private _getApplication;
    getQuery(id: string, asLookup?: boolean, parent?: PersistentObject$1): Promise<Query$1>;
    getPersistentObject(parent: PersistentObject$1, id: string, objectId?: string, isNew?: boolean): Promise<PersistentObject$1>;
    executeQuery(parent: PersistentObject$1, query: Query$1, asLookup?: boolean, throwExceptions?: boolean): Promise<QueryResult>;
    executeAction(action: string, parent: PersistentObject$1, query: Query$1, selectedItems: Array<QueryResultItem>, parameters?: any, skipHooks?: boolean): Promise<PersistentObject$1>;
    getStream(obj: PersistentObject$1, action?: string, parent?: PersistentObject$1, query?: Query$1, selectedItems?: Array<QueryResultItem>, parameters?: any): Promise<void>;
    getReport(token: string, { filter, orderBy, top, skip, hideIds, hideType }?: IReportOptions): Promise<any[]>;
    getInstantSearch(search: string): Promise<IInstantSearchResult[]>;
    forgotPassword(userName: string): Promise<IForgotPassword>;
    static fromServiceString(value: string, typeName: string): any;
    static toServiceString(value: any, typeName: string): string;
}
interface IForgotPassword {
    notification: string;
    notificationType: NotificationType;
    notificationDuration: number;
}
interface IReportOptions {
    filter?: string;
    orderBy?: string;
    top?: number;
    skip?: number;
    hideIds?: boolean;
    hideType?: boolean;
}
interface IInstantSearchResult {
    id: string;
    label: string;
    objectId: string;
    breadcrumb: string;
}

declare function cookiePrefix(prefix?: string): string;
declare function cookie(key: string, value?: any, options?: {
    force?: boolean;
    raw?: boolean;
    path?: string;
    domain?: string;
    secure?: boolean;
    expires?: number | Date;
}): string;

declare class CultureInfo {
    name: string;
    numberFormat: ICultureInfoNumberFormat;
    dateFormat: ICultureInfoDateFormat;
    static currentCulture: CultureInfo;
    static invariantCulture: CultureInfo;
    static cultures: KeyValue<CultureInfo>;
    constructor(name: string, numberFormat: ICultureInfoNumberFormat, dateFormat: ICultureInfoDateFormat);
}
interface ICultureInfoNumberFormat {
    naNSymbol: string;
    negativeSign: string;
    positiveSign: string;
    negativeInfinityText: string;
    positiveInfinityText: string;
    percentSymbol: string;
    percentGroupSizes: Array<number>;
    percentDecimalDigits: number;
    percentDecimalSeparator: string;
    percentGroupSeparator: string;
    percentPositivePattern: string;
    percentNegativePattern: string;
    currencySymbol: string;
    currencyGroupSizes: Array<number>;
    currencyDecimalDigits: number;
    currencyDecimalSeparator: string;
    currencyGroupSeparator: string;
    currencyNegativePattern: string;
    currencyPositivePattern: string;
    numberGroupSizes: Array<number>;
    numberDecimalDigits: number;
    numberDecimalSeparator: string;
    numberGroupSeparator: string;
}
interface ICultureInfoDateFormat {
    amDesignator: string;
    pmDesignator: string;
    dateSeparator: string;
    timeSeparator: string;
    gmtDateTimePattern: string;
    universalDateTimePattern: string;
    sortableDateTimePattern: string;
    dateTimePattern: string;
    longDatePattern: string;
    shortDatePattern: string;
    longTimePattern: string;
    shortTimePattern: string;
    yearMonthPattern: string;
    firstDayOfWeek: number;
    dayNames: Array<string>;
    shortDayNames: Array<string>;
    minimizedDayNames: Array<string>;
    monthNames: Array<string>;
    shortMonthNames: Array<string>;
}

declare class NoInternetMessage {
    private language;
    title: string;
    message: string;
    tryAgain: string;
    static messages: KeyValue<NoInternetMessage>;
    constructor(language: string, title: string, message: string, tryAgain: string);
}

declare abstract class DataType {
    static isDateTimeType(type: string): boolean;
    static isNumericType(type: string): boolean;
    static isBooleanType(type: string): boolean;
    private static _getDate;
    private static _getServiceTimeString;
    static fromServiceString(value: string, type: string): any;
    static toServiceString(value: any, type: string): string;
}

type vidyano_Action = Action;
declare const vidyano_Action: typeof Action;
type vidyano_ActionDefinition = ActionDefinition;
declare const vidyano_ActionDefinition: typeof ActionDefinition;
type vidyano_ActionDefinitionParams = ActionDefinitionParams;
type vidyano_ActionExecutionHandler = ActionExecutionHandler;
type vidyano_ActionExecutionHandlerDispose = ActionExecutionHandlerDispose;
type vidyano_ActionGroup = ActionGroup;
declare const vidyano_ActionGroup: typeof ActionGroup;
declare const vidyano_Actions: typeof Actions;
type vidyano_Application = Application;
declare const vidyano_Application: typeof Application;
type vidyano_ArrayChangedArgs = ArrayChangedArgs;
declare const vidyano_ArrayChangedArgs: typeof ArrayChangedArgs;
declare const vidyano_ClientOperations: typeof ClientOperations;
type vidyano_CultureInfo = CultureInfo;
declare const vidyano_CultureInfo: typeof CultureInfo;
type vidyano_DataType = DataType;
declare const vidyano_DataType: typeof DataType;
type vidyano_ExecuteActionArgs = ExecuteActionArgs;
declare const vidyano_ExecuteActionArgs: typeof ExecuteActionArgs;
type vidyano_ExpressionParser = ExpressionParser;
declare const vidyano_ExpressionParser: typeof ExpressionParser;
type vidyano_IActionExecuteOptions = IActionExecuteOptions;
type vidyano_IClientOperation = IClientOperation;
type vidyano_ICultureInfoDateFormat = ICultureInfoDateFormat;
type vidyano_ICultureInfoNumberFormat = ICultureInfoNumberFormat;
type vidyano_IExecuteMethodOperation = IExecuteMethodOperation;
type vidyano_IForgotPassword = IForgotPassword;
type vidyano_IInstantSearchResult = IInstantSearchResult;
type vidyano_IOpenOperation = IOpenOperation;
type vidyano_IPropertyChangedObserver<T> = IPropertyChangedObserver<T>;
type vidyano_IQueryColumnDistincts = IQueryColumnDistincts;
type vidyano_IQueryGroupingInfo = IQueryGroupingInfo;
type vidyano_IQuerySelectAll = IQuerySelectAll;
type vidyano_IRefreshOperation = IRefreshOperation;
type vidyano_IReportOptions = IReportOptions;
type vidyano_IRoutes = IRoutes;
type vidyano_ISelectedItemsActionArgs = ISelectedItemsActionArgs;
type vidyano_IServiceBus = IServiceBus;
type vidyano_ISortOption = ISortOption;
type vidyano_ISubjectDisposer = ISubjectDisposer;
type vidyano_ISubjectNotifier<TSource, TDetail> = ISubjectNotifier<TSource, TDetail>;
type vidyano_ISubjectObserver<TSource, TDetail> = ISubjectObserver<TSource, TDetail>;
type vidyano_KeyValue<T> = KeyValue<T>;
type vidyano_KeyValuePair<T, U> = KeyValuePair<T, U>;
type vidyano_KeyValueString = KeyValueString;
type vidyano_Language = Language;
declare const vidyano_Language: typeof Language;
type vidyano_NoInternetMessage = NoInternetMessage;
declare const vidyano_NoInternetMessage: typeof NoInternetMessage;
type vidyano_NotificationType = NotificationType;
type vidyano_Observable<T> = Observable<T>;
declare const vidyano_Observable: typeof Observable;
type vidyano_PersistentObjectAttributeGroup = PersistentObjectAttributeGroup;
declare const vidyano_PersistentObjectAttributeGroup: typeof PersistentObjectAttributeGroup;
type vidyano_PersistentObjectAttributeOption = PersistentObjectAttributeOption;
type vidyano_PersistentObjectAttributeTab = PersistentObjectAttributeTab;
declare const vidyano_PersistentObjectAttributeTab: typeof PersistentObjectAttributeTab;
type vidyano_PersistentObjectAttributeWithReference = PersistentObjectAttributeWithReference;
declare const vidyano_PersistentObjectAttributeWithReference: typeof PersistentObjectAttributeWithReference;
type vidyano_PersistentObjectLayoutMode = PersistentObjectLayoutMode;
declare const vidyano_PersistentObjectLayoutMode: typeof PersistentObjectLayoutMode;
type vidyano_PersistentObjectQueryTab = PersistentObjectQueryTab;
declare const vidyano_PersistentObjectQueryTab: typeof PersistentObjectQueryTab;
type vidyano_ProgramUnit = ProgramUnit;
declare const vidyano_ProgramUnit: typeof ProgramUnit;
type vidyano_ProgramUnitItem = ProgramUnitItem;
declare const vidyano_ProgramUnitItem: typeof ProgramUnitItem;
type vidyano_ProgramUnitItemGroup = ProgramUnitItemGroup;
declare const vidyano_ProgramUnitItemGroup: typeof ProgramUnitItemGroup;
type vidyano_ProgramUnitItemPersistentObject = ProgramUnitItemPersistentObject;
declare const vidyano_ProgramUnitItemPersistentObject: typeof ProgramUnitItemPersistentObject;
type vidyano_ProgramUnitItemQuery = ProgramUnitItemQuery;
declare const vidyano_ProgramUnitItemQuery: typeof ProgramUnitItemQuery;
type vidyano_ProgramUnitItemSeparator = ProgramUnitItemSeparator;
declare const vidyano_ProgramUnitItemSeparator: typeof ProgramUnitItemSeparator;
type vidyano_ProgramUnitItemUrl = ProgramUnitItemUrl;
declare const vidyano_ProgramUnitItemUrl: typeof ProgramUnitItemUrl;
type vidyano_PropertyChangedArgs = PropertyChangedArgs;
declare const vidyano_PropertyChangedArgs: typeof PropertyChangedArgs;
type vidyano_QueryChart = QueryChart;
declare const vidyano_QueryChart: typeof QueryChart;
type vidyano_QueryColumn = QueryColumn;
declare const vidyano_QueryColumn: typeof QueryColumn;
type vidyano_QueryFilter = QueryFilter;
declare const vidyano_QueryFilter: typeof QueryFilter;
type vidyano_QueryFilters = QueryFilters;
declare const vidyano_QueryFilters: typeof QueryFilters;
type vidyano_QueryResultItem = QueryResultItem;
declare const vidyano_QueryResultItem: typeof QueryResultItem;
type vidyano_QueryResultItemGroup = QueryResultItemGroup;
declare const vidyano_QueryResultItemGroup: typeof QueryResultItemGroup;
type vidyano_QueryResultItemValue = QueryResultItemValue;
declare const vidyano_QueryResultItemValue: typeof QueryResultItemValue;
type vidyano_Queue = Queue;
declare const vidyano_Queue: typeof Queue;
type vidyano_Service = Service;
declare const vidyano_Service: typeof Service;
declare const vidyano_ServiceBus: typeof ServiceBus;
type vidyano_ServiceBusCallback = ServiceBusCallback;
type vidyano_ServiceBusSubscriptionDisposer = ServiceBusSubscriptionDisposer;
type vidyano_ServiceHooks = ServiceHooks;
declare const vidyano_ServiceHooks: typeof ServiceHooks;
type vidyano_ServiceObject = ServiceObject;
declare const vidyano_ServiceObject: typeof ServiceObject;
type vidyano_ServiceObjectWithActions = ServiceObjectWithActions;
declare const vidyano_ServiceObjectWithActions: typeof ServiceObjectWithActions;
type vidyano_SortDirection = SortDirection;
type vidyano_StreamingActionMessages = StreamingActionMessages;
type vidyano_Subject<TSource, TDetail> = Subject<TSource, TDetail>;
declare const vidyano_Subject: typeof Subject;
declare const vidyano_cookie: typeof cookie;
declare const vidyano_cookiePrefix: typeof cookiePrefix;
declare const vidyano_extend: typeof extend;
declare const vidyano_noop: typeof noop;
declare const vidyano_sleep: typeof sleep;
declare const vidyano_version: typeof version;
declare namespace vidyano {
  export { vidyano_Action as Action, vidyano_ActionDefinition as ActionDefinition, type vidyano_ActionDefinitionParams as ActionDefinitionParams, type vidyano_ActionExecutionHandler as ActionExecutionHandler, type vidyano_ActionExecutionHandlerDispose as ActionExecutionHandlerDispose, vidyano_ActionGroup as ActionGroup, vidyano_Actions as Actions, vidyano_Application as Application, vidyano_ArrayChangedArgs as ArrayChangedArgs, vidyano_ClientOperations as ClientOperations, vidyano_CultureInfo as CultureInfo, vidyano_DataType as DataType, service as Dto, vidyano_ExecuteActionArgs as ExecuteActionArgs, vidyano_ExpressionParser as ExpressionParser, type vidyano_IActionExecuteOptions as IActionExecuteOptions, type vidyano_IClientOperation as IClientOperation, type vidyano_ICultureInfoDateFormat as ICultureInfoDateFormat, type vidyano_ICultureInfoNumberFormat as ICultureInfoNumberFormat, type vidyano_IExecuteMethodOperation as IExecuteMethodOperation, type vidyano_IForgotPassword as IForgotPassword, type vidyano_IInstantSearchResult as IInstantSearchResult, type vidyano_IOpenOperation as IOpenOperation, type vidyano_IPropertyChangedObserver as IPropertyChangedObserver, type vidyano_IQueryColumnDistincts as IQueryColumnDistincts, type vidyano_IQueryGroupingInfo as IQueryGroupingInfo, type vidyano_IQuerySelectAll as IQuerySelectAll, type vidyano_IRefreshOperation as IRefreshOperation, type vidyano_IReportOptions as IReportOptions, type vidyano_IRoutes as IRoutes, type vidyano_ISelectedItemsActionArgs as ISelectedItemsActionArgs, type vidyano_IServiceBus as IServiceBus, type vidyano_ISortOption as ISortOption, type vidyano_ISubjectDisposer as ISubjectDisposer, type vidyano_ISubjectNotifier as ISubjectNotifier, type vidyano_ISubjectObserver as ISubjectObserver, type vidyano_KeyValue as KeyValue, type vidyano_KeyValuePair as KeyValuePair, type vidyano_KeyValueString as KeyValueString, vidyano_Language as Language, vidyano_NoInternetMessage as NoInternetMessage, type vidyano_NotificationType as NotificationType, vidyano_Observable as Observable, PersistentObject$1 as PersistentObject, PersistentObjectAttribute$1 as PersistentObjectAttribute, PersistentObjectAttributeAsDetail$1 as PersistentObjectAttributeAsDetail, vidyano_PersistentObjectAttributeGroup as PersistentObjectAttributeGroup, type vidyano_PersistentObjectAttributeOption as PersistentObjectAttributeOption, vidyano_PersistentObjectAttributeTab as PersistentObjectAttributeTab, vidyano_PersistentObjectAttributeWithReference as PersistentObjectAttributeWithReference, vidyano_PersistentObjectLayoutMode as PersistentObjectLayoutMode, vidyano_PersistentObjectQueryTab as PersistentObjectQueryTab, PersistentObjectTab$1 as PersistentObjectTab, vidyano_ProgramUnit as ProgramUnit, vidyano_ProgramUnitItem as ProgramUnitItem, vidyano_ProgramUnitItemGroup as ProgramUnitItemGroup, vidyano_ProgramUnitItemPersistentObject as ProgramUnitItemPersistentObject, vidyano_ProgramUnitItemQuery as ProgramUnitItemQuery, vidyano_ProgramUnitItemSeparator as ProgramUnitItemSeparator, vidyano_ProgramUnitItemUrl as ProgramUnitItemUrl, vidyano_PropertyChangedArgs as PropertyChangedArgs, Query$1 as Query, vidyano_QueryChart as QueryChart, vidyano_QueryColumn as QueryColumn, vidyano_QueryFilter as QueryFilter, vidyano_QueryFilters as QueryFilters, vidyano_QueryResultItem as QueryResultItem, vidyano_QueryResultItemGroup as QueryResultItemGroup, vidyano_QueryResultItemValue as QueryResultItemValue, vidyano_Queue as Queue, vidyano_Service as Service, vidyano_ServiceBus as ServiceBus, type vidyano_ServiceBusCallback as ServiceBusCallback, type vidyano_ServiceBusSubscriptionDisposer as ServiceBusSubscriptionDisposer, vidyano_ServiceHooks as ServiceHooks, vidyano_ServiceObject as ServiceObject, vidyano_ServiceObjectWithActions as ServiceObjectWithActions, type vidyano_SortDirection as SortDirection, type vidyano_StreamingActionMessages as StreamingActionMessages, vidyano_Subject as Subject, vidyano_cookie as cookie, vidyano_cookiePrefix as cookiePrefix, vidyano_extend as extend, vidyano_noop as noop, vidyano_sleep as sleep, vidyano_version as version };
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.




/**
 * Wraps an ES6 class expression mixin such that the mixin is only applied
 * if it has not already been applied its base argument. Also memoizes mixin
 * applications.
 */
declare function dedupingMixin<T>(mixin: T): T;

// tslint:disable:variable-name Describing an API that's defined elsewhere.




/**
 * Converts "dash-case" identifier (e.g. `foo-bar-baz`) to "camelCase"
 * (e.g. `fooBarBaz`).
 *
 * @returns Camel-case representation of the identifier
 */
declare function dashToCamelCase(dash: string): string;



/**
 * Converts "camelCase" identifier (e.g. `fooBarBaz`) to "dash-case"
 * (e.g. `foo-bar-baz`).
 *
 * @returns Dash-case representation of the identifier
 */
declare function camelToDashCase(camel: string): string;

declare const caseMap_d_camelToDashCase: typeof camelToDashCase;
declare const caseMap_d_dashToCamelCase: typeof dashToCamelCase;
declare namespace caseMap_d {
  export { caseMap_d_camelToDashCase as camelToDashCase, caseMap_d_dashToCamelCase as dashToCamelCase };
}

// Types from "externs/polymer-internal-shared-types.js"

interface StampedTemplate extends DocumentFragment {
  __noInsertionPoint: boolean;
  nodeList: Node[];
  $: {[key: string]: Node};
  templateInfo?: TemplateInfo;
}

interface NodeInfo {
  id: string;
  events: {name: string, value: string}[];
  hasInsertionPoint: boolean;
  templateInfo: TemplateInfo;
  parentInfo: NodeInfo;
  parentIndex: number;
  infoIndex: number;
  bindings: Binding[];
}

interface TemplateInfo {
  nodeInfoList: NodeInfo[];
  nodeList: Node[];
  stripWhitespace: boolean;
  hasInsertionPoint?: boolean;
  hostProps: Object;
  propertyEffects: Object;
  childNodes: Node[];
  wasPreBound: boolean;
}

interface LiteralBindingPart {
  literal: string;
  compoundIndex?: number;
}

interface MethodArg {
  literal: boolean;
  name: string;
  value: string|number;
  rootProperty?: string;
  structured?: boolean;
  wildcard?: boolean;
}

interface ExpressionBindingPart {
  mode: string;
  negate: boolean;
  source: string;
  dependencies: Array<MethodArg|string>;
  customEvent: boolean;
  signature: Object|null;
  event: string;
}

type BindingPart = LiteralBindingPart|ExpressionBindingPart;

interface Binding {
  kind: string;
  target: string;
  parts: BindingPart[];
  literal?: string;
  isCompound: boolean;
  listenerEvent?: string;
  listenerNegate?: boolean;
}

interface AsyncInterface {
  run: (fn: Function, delay?: number) => number;
  cancel: (handle: number) => void;
}

// Types from "lib/utils/gestures.html"

interface GestureRecognizer {
  reset: () => void;
  mousedown?: (e: MouseEvent) => void;
  mousemove?: (e: MouseEvent) => void;
  mouseup?: (e: MouseEvent) => void;
  touchstart?: (e: TouchEvent) => void;
  touchmove?: (e: TouchEvent) => void;
  touchend?: (e: TouchEvent) => void;
  click?: (e: MouseEvent) => void;
}

/**
 * Not defined in the TypeScript DOM library.
 * See https://developer.mozilla.org/en-US/docs/Web/API/IdleDeadline
 */
interface IdleDeadline {
  didTimeout: boolean;
  timeRemaining(): number;
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.

/**
 * Async interface wrapper around `setTimeout`.
 */
declare namespace timeOut {


  /**
   * Returns a sub-module with the async interface providing the provided
   * delay.
   *
   * @returns An async timeout interface
   */
  function after(delay?: number): AsyncInterface;


  /**
   * Enqueues a function called in the next task.
   *
   * @returns Handle used for canceling task
   */
  function run(fn: Function, delay?: number): number;


  /**
   * Cancels a previously enqueued `timeOut` callback.
   */
  function cancel(handle: number): void;
}


/**
 * Async interface wrapper around `requestAnimationFrame`.
 */
declare namespace animationFrame {


  /**
   * Enqueues a function called at `requestAnimationFrame` timing.
   *
   * @returns Handle used for canceling task
   */
  function run(fn: (p0: number) => void): number;


  /**
   * Cancels a previously enqueued `animationFrame` callback.
   */
  function cancel(handle: number): void;
}


/**
 * Async interface wrapper around `requestIdleCallback`.  Falls back to
 * `setTimeout` on browsers that do not support `requestIdleCallback`.
 */
declare namespace idlePeriod {


  /**
   * Enqueues a function called at `requestIdleCallback` timing.
   *
   * @returns Handle used for canceling task
   */
  function run(fn: (p0: IdleDeadline) => void): number;


  /**
   * Cancels a previously enqueued `idlePeriod` callback.
   */
  function cancel(handle: number): void;
}


/**
 * Async interface for enqueuing callbacks that run at microtask timing.
 *
 * Note that microtask timing is achieved via a single `MutationObserver`,
 * and thus callbacks enqueued with this API will all run in a single
 * batch, and not interleaved with other microtasks such as promises.
 * Promises are avoided as an implementation choice for the time being
 * due to Safari bugs that cause Promises to lack microtask guarantees.
 */
declare namespace microTask {


  /**
   * Enqueues a function called at microtask timing.
   *
   * @returns Handle used for canceling task
   */
  function run(callback?: Function): number;


  /**
   * Cancels a previously enqueued `microTask` callback.
   */
  function cancel(handle: number): void;
}

declare const async_d_animationFrame: typeof animationFrame;
declare const async_d_idlePeriod: typeof idlePeriod;
declare const async_d_microTask: typeof microTask;
declare const async_d_timeOut: typeof timeOut;
declare namespace async_d {
  export { async_d_animationFrame as animationFrame, async_d_idlePeriod as idlePeriod, async_d_microTask as microTask, async_d_timeOut as timeOut };
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today



interface PropertiesChangedConstructor {
  new(...args: any[]): PropertiesChanged;

  /**
   * Creates property accessors for the given property names.
   *
   * @param props Object whose keys are names of accessors.
   */
  createProperties(props: object): void;

  /**
   * Returns an attribute name that corresponds to the given property.
   * The attribute name is the lowercased property name. Override to
   * customize this mapping.
   *
   * @param property Property to convert
   * @returns Attribute name corresponding to the given property.
   */
  attributeNameForProperty(property: string): string;

  /**
   * Override point to provide a type to which to deserialize a value to
   * a given property.
   *
   * @param name Name of property
   */
  typeForProperty(name: string): void;
}



/**
 * Element class mixin that provides basic meta-programming for creating one
 * or more property accessors (getter/setter pair) that enqueue an async
 * (batched) `_propertiesChanged` callback.
 *
 * For basic usage of this mixin, call `MyClass.createProperties(props)`
 * once at class definition time to create property accessors for properties
 * named in props, implement `_propertiesChanged` to react as desired to
 * property changes, and implement `static get observedAttributes()` and
 * include lowercase versions of any property names that should be set from
 * attributes. Last, call `this._enableProperties()` in the element's
 * `connectedCallback` to enable the accessors.
 */
declare function PropertiesChanged<T extends new (...args: any[]) => {}>(base: T): T & PropertiesChangedConstructor;

interface PropertiesChanged {

  /**
   * Creates a setter/getter pair for the named property with its own
   * local storage.  The getter returns the value in the local storage,
   * and the setter calls `_setProperty`, which updates the local storage
   * for the property and enqueues a `_propertiesChanged` callback.
   *
   * This method may be called on a prototype or an instance.  Calling
   * this method may overwrite a property value that already exists on
   * the prototype/instance by creating the accessor.
   *
   * @param property Name of the property
   * @param readOnly When true, no setter is created; the
   *   protected `_setProperty` function must be used to set the property
   */
  _createPropertyAccessor(property: string, readOnly?: boolean): void;

  /**
   * Adds the given `property` to a map matching attribute names
   * to property names, using `attributeNameForProperty`. This map is
   * used when deserializing attribute values to properties.
   *
   * @param property Name of the property
   */
  _addPropertyToAttributeMap(property: string): any;

  /**
   * Defines a property accessor for the given property.
   *
   * @param property Name of the property
   * @param readOnly When true, no setter is created
   */
  _definePropertyAccessor(property: string, readOnly?: boolean): void;

  /**
   * Lifecycle callback called when properties are enabled via
   * `_enableProperties`.
   *
   * Users may override this function to implement behavior that is
   * dependent on the element having its property data initialized, e.g.
   * from defaults (initialized from `constructor`, `_initializeProperties`),
   * `attributeChangedCallback`, or values propagated from host e.g. via
   * bindings.  `super.ready()` must be called to ensure the data system
   * becomes enabled.
   */
  ready(): void;

  /**
   * Initializes the local storage for property accessors.
   *
   * Provided as an override point for performing any setup work prior
   * to initializing the property accessor system.
   */
  _initializeProperties(): void;

  /**
   * Called at ready time with bag of instance properties that overwrote
   * accessors when the element upgraded.
   *
   * The default implementation sets these properties back into the
   * setter at ready time.  This method is provided as an override
   * point for customizing or providing more efficient initialization.
   *
   * @param props Bag of property values that were overwritten
   *   when creating property accessors.
   */
  _initializeInstanceProperties(props: object|null): void;

  /**
   * Updates the local storage for a property (via `_setPendingProperty`)
   * and enqueues a `_proeprtiesChanged` callback.
   *
   * @param property Name of the property
   * @param value Value to set
   */
  _setProperty(property: string, value: any): void;

  /**
   * Returns the value for the given property.
   *
   * @param property Name of property
   * @returns Value for the given property
   */
  _getProperty(property: string): any;

  /**
   * Updates the local storage for a property, records the previous value,
   * and adds it to the set of "pending changes" that will be passed to the
   * `_propertiesChanged` callback.  This method does not enqueue the
   * `_propertiesChanged` callback.
   *
   * @param property Name of the property
   * @param value Value to set
   * @param ext Not used here; affordance for closure
   * @returns Returns true if the property changed
   */
  _setPendingProperty(property: string, value: any, ext?: boolean): boolean;

  /**
   * @param property Name of the property
   * @returns Returns true if the property is pending.
   */
  _isPropertyPending(property: string): boolean;

  /**
   * Marks the properties as invalid, and enqueues an async
   * `_propertiesChanged` callback.
   */
  _invalidateProperties(): void;

  /**
   * Call to enable property accessor processing. Before this method is
   * called accessor values will be set but side effects are
   * queued. When called, any pending side effects occur immediately.
   * For elements, generally `connectedCallback` is a normal spot to do so.
   * It is safe to call this method multiple times as it only turns on
   * property accessors once.
   */
  _enableProperties(): void;

  /**
   * Calls the `_propertiesChanged` callback with the current set of
   * pending changes (and old values recorded when pending changes were
   * set), and resets the pending set of changes. Generally, this method
   * should not be called in user code.
   */
  _flushProperties(): void;

  /**
   * Called in `_flushProperties` to determine if `_propertiesChanged`
   * should be called. The default implementation returns true if
   * properties are pending. Override to customize when
   * `_propertiesChanged` is called.
   *
   * @param currentProps Bag of all current accessor values
   * @param changedProps Bag of properties changed since the last
   *   call to `_propertiesChanged`
   * @param oldProps Bag of previous values for each property
   *   in `changedProps`
   * @returns true if changedProps is truthy
   */
  _shouldPropertiesChange(currentProps: object, changedProps: object|null, oldProps: object|null): boolean;

  /**
   * Callback called when any properties with accessors created via
   * `_createPropertyAccessor` have been set.
   *
   * @param currentProps Bag of all current accessor values
   * @param changedProps Bag of properties changed since the last
   *   call to `_propertiesChanged`
   * @param oldProps Bag of previous values for each property
   *   in `changedProps`
   */
  _propertiesChanged(currentProps: object, changedProps: object|null, oldProps: object|null): void;

  /**
   * Method called to determine whether a property value should be
   * considered as a change and cause the `_propertiesChanged` callback
   * to be enqueued.
   *
   * The default implementation returns `true` if a strict equality
   * check fails. The method always returns false for `NaN`.
   *
   * Override this method to e.g. provide stricter checking for
   * Objects/Arrays when using immutable patterns.
   *
   * @param property Property name
   * @param value New property value
   * @param old Previous property value
   * @returns Whether the property should be considered a change
   *   and enqueue a `_proeprtiesChanged` callback
   */
  _shouldPropertyChange(property: string, value: any, old: any): boolean;

  /**
   * Implements native Custom Elements `attributeChangedCallback` to
   * set an attribute value to a property via `_attributeToProperty`.
   *
   * @param name Name of attribute that changed
   * @param old Old attribute value
   * @param value New attribute value
   * @param namespace Attribute namespace.
   */
  attributeChangedCallback(name: string, old: string|null, value: string|null, namespace: string|null): void;

  /**
   * Deserializes an attribute to its associated property.
   *
   * This method calls the `_deserializeValue` method to convert the string to
   * a typed value.
   *
   * @param attribute Name of attribute to deserialize.
   * @param value of the attribute.
   * @param type type to deserialize to, defaults to the value
   * returned from `typeForProperty`
   */
  _attributeToProperty(attribute: string, value: string|null, type?: any): void;

  /**
   * Serializes a property to its associated attribute.
   *
   * @param property Property name to reflect.
   * @param attribute Attribute name to reflect to.
   * @param value Property value to refect.
   */
  _propertyToAttribute(property: string, attribute?: string, value?: any): void;

  /**
   * Sets a typed value to an HTML attribute on a node.
   *
   * This method calls the `_serializeValue` method to convert the typed
   * value to a string.  If the `_serializeValue` method returns `undefined`,
   * the attribute will be removed (this is the default for boolean
   * type `false`).
   *
   * @param node Element to set attribute to.
   * @param value Value to serialize.
   * @param attribute Attribute name to serialize to.
   */
  _valueToNodeAttribute(node: Element|null, value: any, attribute: string): void;

  /**
   * Converts a typed JavaScript value to a string.
   *
   * This method is called when setting JS property values to
   * HTML attributes.  Users may override this method to provide
   * serialization for custom types.
   *
   * @param value Property value to serialize.
   * @returns String serialized from the provided
   * property  value.
   */
  _serializeValue(value: any): string|undefined;

  /**
   * Converts a string to a typed JavaScript value.
   *
   * This method is called when reading HTML attribute values to
   * JS properties.  Users may override this method to provide
   * deserialization for custom `type`s. Types for `Boolean`, `String`,
   * and `Number` convert attributes to the expected types.
   *
   * @param value Value to deserialize.
   * @param type Type to deserialize the string to.
   * @returns Typed value deserialized from the provided string.
   */
  _deserializeValue(value: string|null, type?: any): any;
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today



interface PropertyAccessorsConstructor {
  new(...args: any[]): PropertyAccessors;

  /**
   * Returns an attribute name that corresponds to the given property.
   * By default, converts camel to dash case, e.g. `fooBar` to `foo-bar`.
   *
   * @param property Property to convert
   * @returns Attribute name corresponding to the given property.
   */
  attributeNameForProperty(property: string): string;

  /**
   * Generates property accessors for all attributes in the standard
   * static `observedAttributes` array.
   *
   * Attribute names are mapped to property names using the `dash-case` to
   * `camelCase` convention
   */
  createPropertiesForAttributes(): void;
}



/**
 * Element class mixin that provides basic meta-programming for creating one
 * or more property accessors (getter/setter pair) that enqueue an async
 * (batched) `_propertiesChanged` callback.
 *
 * For basic usage of this mixin:
 *
 * -   Declare attributes to observe via the standard `static get
 *     observedAttributes()`. Use `dash-case` attribute names to represent
 *     `camelCase` property names.
 * -   Implement the `_propertiesChanged` callback on the class.
 * -   Call `MyClass.createPropertiesForAttributes()` **once** on the class to
 *     generate property accessors for each observed attribute. This must be
 *     called before the first instance is created, for example, by calling it
 *     before calling `customElements.define`. It can also be called lazily from
 *     the element's `constructor`, as long as it's guarded so that the call is
 *     only made once, when the first instance is created.
 * -   Call `this._enableProperties()` in the element's `connectedCallback` to
 *     enable the accessors.
 *
 * Any `observedAttributes` will automatically be
 * deserialized via `attributeChangedCallback` and set to the associated
 * property using `dash-case`-to-`camelCase` convention.
 */
declare function PropertyAccessors<T extends new (...args: any[]) => {}>(base: T): T & PropertyAccessorsConstructor & PropertiesChangedConstructor;

interface PropertyAccessors extends PropertiesChanged {

  /**
   * Overrides PropertiesChanged implementation to save existing prototype
   * property value so that it can be reset.
   *
   * @param property Name of the property
   * @param readOnly When true, no setter is created
   *
   * When calling on a prototype, any overwritten values are saved in
   * `__dataProto`, and it is up to the subclasser to decide how/when
   * to set those properties back into the accessor.  When calling on an
   * instance, the overwritten value is set via `_setPendingProperty`,
   * and the user should call `_invalidateProperties` or `_flushProperties`
   * for the values to take effect.
   */
  _definePropertyAccessor(property: string, readOnly?: boolean): void;

  /**
   * Overrides PropertiesChanged implementation to initialize values for
   * accessors created for values that already existed on the element
   * prototype.
   */
  _initializeProperties(): void;

  /**
   * Returns true if the specified property has a pending change.
   *
   * @param prop Property name
   * @returns True if property has a pending change
   */
  _isPropertyPending(prop: string): boolean;

  /**
   * Overrides PropertiesChanged implemention to serialize objects as JSON.
   *
   * @param value Property value to serialize.
   * @returns String serialized from the provided property
   *     value.
   */
  _serializeValue(value: any): string|undefined;

  /**
   * Converts a string to a typed JavaScript value.
   *
   * This method is called by Polymer when reading HTML attribute values to
   * JS properties.  Users may override this method on Polymer element
   * prototypes to provide deserialization for custom `type`s.  Note,
   * the `type` argument is the value of the `type` field provided in the
   * `properties` configuration object for a given property, and is
   * by convention the constructor for the type to deserialize.
   *
   * @param value Attribute value to deserialize.
   * @param type Type to deserialize the string to.
   * @returns Typed value deserialized from the provided string.
   */
  _deserializeValue(value: string|null, type?: any): any;

  /**
   * Called at instance time with bag of properties that were overwritten
   * by accessors on the prototype when accessors were created.
   *
   * The default implementation sets these properties back into the
   * setter at instance time.  This method is provided as an override
   * point for customizing or providing more efficient initialization.
   *
   * @param props Bag of property values that were overwritten
   *   when creating property accessors.
   */
  _initializeProtoProperties(props: object|null): void;

  /**
   * Ensures the element has the given attribute. If it does not,
   * assigns the given value to the attribute.
   *
   * @param attribute Name of attribute to ensure is set.
   * @param value of the attribute.
   */
  _ensureAttribute(attribute: string, value: string): void;

  /**
   * Returns true if this library created an accessor for the given property.
   *
   * @param property Property name
   * @returns True if an accessor was created
   */
  _hasAccessor(property: string): boolean;
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today



interface TemplateStampConstructor {
  new(...args: any[]): TemplateStamp;

  /**
   * Scans a template to produce template metadata.
   *
   * Template-specific metadata are stored in the object returned, and node-
   * specific metadata are stored in objects in its flattened `nodeInfoList`
   * array.  Only nodes in the template that were parsed as nodes of
   * interest contain an object in `nodeInfoList`.  Each `nodeInfo` object
   * contains an `index` (`childNodes` index in parent) and optionally
   * `parent`, which points to node info of its parent (including its index).
   *
   * The template metadata object returned from this method has the following
   * structure (many fields optional):
   *
   * ```js
   *   {
   *     // Flattened list of node metadata (for nodes that generated metadata)
   *     nodeInfoList: [
   *       {
   *         // `id` attribute for any nodes with id's for generating `$` map
   *         id: {string},
   *         // `on-event="handler"` metadata
   *         events: [
   *           {
   *             name: {string},   // event name
   *             value: {string},  // handler method name
   *           }, ...
   *         ],
   *         // Notes when the template contained a `<slot>` for shady DOM
   *         // optimization purposes
   *         hasInsertionPoint: {boolean},
   *         // For nested `<template>`` nodes, nested template metadata
   *         templateInfo: {object}, // nested template metadata
   *         // Metadata to allow efficient retrieval of instanced node
   *         // corresponding to this metadata
   *         parentInfo: {number},   // reference to parent nodeInfo>
   *         parentIndex: {number},  // index in parent's `childNodes` collection
   *         infoIndex: {number},    // index of this `nodeInfo` in `templateInfo.nodeInfoList`
   *       },
   *       ...
   *     ],
   *     // When true, the template had the `strip-whitespace` attribute
   *     // or was nested in a template with that setting
   *     stripWhitespace: {boolean},
   *     // For nested templates, nested template content is moved into
   *     // a document fragment stored here; this is an optimization to
   *     // avoid the cost of nested template cloning
   *     content: {DocumentFragment}
   *   }
   * ```
   *
   * This method kicks off a recursive treewalk as follows:
   *
   * ```
   *    _parseTemplate <---------------------+
   *      _parseTemplateContent              |
   *        _parseTemplateNode  <------------|--+
   *          _parseTemplateNestedTemplate --+  |
   *          _parseTemplateChildNodes ---------+
   *          _parseTemplateNodeAttributes
   *            _parseTemplateNodeAttribute
   *
   * ```
   *
   * These methods may be overridden to add custom metadata about templates
   * to either `templateInfo` or `nodeInfo`.
   *
   * Note that this method may be destructive to the template, in that
   * e.g. event annotations may be removed after being noted in the
   * template metadata.
   *
   * @param template Template to parse
   * @param outerTemplateInfo Template metadata from the outer
   *   template, for parsing nested templates
   * @returns Parsed template metadata
   */
  _parseTemplate(template: HTMLTemplateElement, outerTemplateInfo?: TemplateInfo|null): TemplateInfo;

  /**
   * See docs for _parseTemplateNode.
   *
   * @param template .
   * @param templateInfo .
   * @param nodeInfo .
   * @returns .
   */
  _parseTemplateContent(template: HTMLTemplateElement, templateInfo: TemplateInfo, nodeInfo: NodeInfo): boolean;

  /**
   * Parses template node and adds template and node metadata based on
   * the current node, and its `childNodes` and `attributes`.
   *
   * This method may be overridden to add custom node or template specific
   * metadata based on this node.
   *
   * @param node Node to parse
   * @param templateInfo Template metadata for current template
   * @param nodeInfo Node metadata for current template.
   * @returns `true` if the visited node added node-specific
   *   metadata to `nodeInfo`
   */
  _parseTemplateNode(node: Node|null, templateInfo: TemplateInfo, nodeInfo: NodeInfo): boolean;

  /**
   * Parses template child nodes for the given root node.
   *
   * This method also wraps whitelisted legacy template extensions
   * (`is="dom-if"` and `is="dom-repeat"`) with their equivalent element
   * wrappers, collapses text nodes, and strips whitespace from the template
   * if the `templateInfo.stripWhitespace` setting was provided.
   *
   * @param root Root node whose `childNodes` will be parsed
   * @param templateInfo Template metadata for current template
   * @param nodeInfo Node metadata for current template.
   */
  _parseTemplateChildNodes(root: Node|null, templateInfo: TemplateInfo, nodeInfo: NodeInfo): void;

  /**
   * Parses template content for the given nested `<template>`.
   *
   * Nested template info is stored as `templateInfo` in the current node's
   * `nodeInfo`. `template.content` is removed and stored in `templateInfo`.
   * It will then be the responsibility of the host to set it back to the
   * template and for users stamping nested templates to use the
   * `_contentForTemplate` method to retrieve the content for this template
   * (an optimization to avoid the cost of cloning nested template content).
   *
   * @param node Node to parse (a <template>)
   * @param outerTemplateInfo Template metadata for current template
   *   that includes the template `node`
   * @param nodeInfo Node metadata for current template.
   * @returns `true` if the visited node added node-specific
   *   metadata to `nodeInfo`
   */
  _parseTemplateNestedTemplate(node: HTMLTemplateElement|null, outerTemplateInfo: TemplateInfo|null, nodeInfo: NodeInfo): boolean;

  /**
   * Parses template node attributes and adds node metadata to `nodeInfo`
   * for nodes of interest.
   *
   * @param node Node to parse
   * @param templateInfo Template metadata for current
   *     template
   * @param nodeInfo Node metadata for current template.
   * @returns `true` if the visited node added node-specific
   *   metadata to `nodeInfo`
   */
  _parseTemplateNodeAttributes(node: Element|null, templateInfo: TemplateInfo, nodeInfo: NodeInfo): boolean;

  /**
   * Parses a single template node attribute and adds node metadata to
   * `nodeInfo` for attributes of interest.
   *
   * This implementation adds metadata for `on-event="handler"` attributes
   * and `id` attributes.
   *
   * @param node Node to parse
   * @param templateInfo Template metadata for current template
   * @param nodeInfo Node metadata for current template.
   * @param name Attribute name
   * @param value Attribute value
   * @returns `true` if the visited node added node-specific
   *   metadata to `nodeInfo`
   */
  _parseTemplateNodeAttribute(node: Element|null, templateInfo: TemplateInfo, nodeInfo: NodeInfo, name: string, value: string): boolean;

  /**
   * Returns the `content` document fragment for a given template.
   *
   * For nested templates, Polymer performs an optimization to cache nested
   * template content to avoid the cost of cloning deeply nested templates.
   * This method retrieves the cached content for a given template.
   *
   * @param template Template to retrieve `content` for
   * @returns Content fragment
   */
  _contentForTemplate(template: HTMLTemplateElement|null): DocumentFragment|null;
}



/**
 * Element mixin that provides basic template parsing and stamping, including
 * the following template-related features for stamped templates:
 *
 * - Declarative event listeners (`on-eventname="listener"`)
 * - Map of node id's to stamped node instances (`this.$.id`)
 * - Nested template content caching/removal and re-installation (performance
 *   optimization)
 */
declare function TemplateStamp<T extends new (...args: any[]) => {}>(base: T): T & TemplateStampConstructor;

interface TemplateStamp {

  /**
   * Clones the provided template content and returns a document fragment
   * containing the cloned dom.
   *
   * The template is parsed (once and memoized) using this library's
   * template parsing features, and provides the following value-added
   * features:
   * * Adds declarative event listeners for `on-event="handler"` attributes
   * * Generates an "id map" for all nodes with id's under `$` on returned
   *   document fragment
   * * Passes template info including `content` back to templates as
   *   `_templateInfo` (a performance optimization to avoid deep template
   *   cloning)
   *
   * Note that the memoized template parsing process is destructive to the
   * template: attributes for bindings and declarative event listeners are
   * removed after being noted in notes, and any nested `<template>.content`
   * is removed and stored in notes as well.
   *
   * @param template Template to stamp
   * @param templateInfo Optional template info associated
   *   with the template to be stamped; if omitted the template will be
   *   automatically parsed.
   * @returns Cloned template content
   */
  _stampTemplate(template: HTMLTemplateElement, templateInfo?: TemplateInfo|null): StampedTemplate;

  /**
   * Adds an event listener by method name for the event provided.
   *
   * This method generates a handler function that looks up the method
   * name at handling time.
   *
   * @param node Node to add listener on
   * @param eventName Name of event
   * @param methodName Name of method
   * @param context Context the method will be called on (defaults
   *   to `node`)
   * @returns Generated handler function
   */
  _addMethodEventListenerToNode(node: EventTarget, eventName: string, methodName: string, context?: any): Function|null;

  /**
   * Override point for adding custom or simulated event handling.
   *
   * @param node Node to add event listener to
   * @param eventName Name of event
   * @param handler Listener function to add
   */
  _addEventListenerToNode(node: EventTarget, eventName: string, handler: (p0: Event) => void): void;

  /**
   * Override point for adding custom or simulated event handling.
   *
   * @param node Node to remove event listener from
   * @param eventName Name of event
   * @param handler Listener function to remove
   */
  _removeEventListenerFromNode(node: EventTarget, eventName: string, handler: (p0: Event) => void): void;
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today



interface PropertyEffectsConstructor {
  new(...args: any[]): PropertyEffects;

  /**
   * Overrides default `TemplateStamp` implementation to add support for
   * parsing bindings from `TextNode`'s' `textContent`.  A `bindings`
   * array is added to `nodeInfo` and populated with binding metadata
   * with information capturing the binding target, and a `parts` array
   * with one or more metadata objects capturing the source(s) of the
   * binding.
   *
   * @param node Node to parse
   * @param templateInfo Template metadata for current template
   * @param nodeInfo Node metadata for current template node
   * @returns `true` if the visited node added node-specific
   *   metadata to `nodeInfo`
   */
  _parseTemplateNode(node: Node|null, templateInfo: TemplateInfo|null, nodeInfo: NodeInfo|null): boolean;

  /**
   * Overrides default `TemplateStamp` implementation to add support for
   * binding the properties that a nested template depends on to the template
   * as `_host_<property>`.
   *
   * @param node Node to parse
   * @param templateInfo Template metadata for current template
   * @param nodeInfo Node metadata for current template node
   * @returns `true` if the visited node added node-specific
   *   metadata to `nodeInfo`
   */
  _parseTemplateNestedTemplate(node: Node|null, templateInfo: TemplateInfo|null, nodeInfo: NodeInfo|null): boolean;

  /**
   * Overrides default `TemplateStamp` implementation to add support for
   * parsing bindings from attributes.  A `bindings`
   * array is added to `nodeInfo` and populated with binding metadata
   * with information capturing the binding target, and a `parts` array
   * with one or more metadata objects capturing the source(s) of the
   * binding.
   *
   * @param node Node to parse
   * @param templateInfo Template metadata for current template
   * @param nodeInfo Node metadata for current template node
   * @param name Attribute name
   * @param value Attribute value
   * @returns `true` if the visited node added node-specific
   *   metadata to `nodeInfo`
   */
  _parseTemplateNodeAttribute(node: Element|null, templateInfo: TemplateInfo|null, nodeInfo: NodeInfo|null, name: string, value: string): boolean;

  /**
   * Ensures an accessor exists for the specified property, and adds
   * to a list of "property effects" that will run when the accessor for
   * the specified property is set.  Effects are grouped by "type", which
   * roughly corresponds to a phase in effect processing.  The effect
   * metadata should be in the following form:
   *
   *     {
   *       fn: effectFunction, // Reference to function to call to perform effect
   *       info: { ... }       // Effect metadata passed to function
   *       trigger: {          // Optional triggering metadata; if not provided
   *         name: string      // the property is treated as a wildcard
   *         structured: boolean
   *         wildcard: boolean
   *       }
   *     }
   *
   * Effects are called from `_propertiesChanged` in the following order by
   * type:
   *
   * 1. COMPUTE
   * 2. PROPAGATE
   * 3. REFLECT
   * 4. OBSERVE
   * 5. NOTIFY
   *
   * Effect functions are called with the following signature:
   *
   *     effectFunction(inst, path, props, oldProps, info, hasPaths)
   *
   * @param property Property that should trigger the effect
   * @param type Effect type, from this.PROPERTY_EFFECT_TYPES
   * @param effect Effect metadata object
   */
  addPropertyEffect(property: string, type: string, effect?: object|null): void;

  /**
   * Creates a single-property observer for the given property.
   *
   * @param property Property name
   * @param method Function or name of observer method to call
   * @param dynamicFn Whether the method name should be included as
   *   a dependency to the effect.
   */
  createPropertyObserver(property: string, method: string|((p0: any, p1: any) => any), dynamicFn?: boolean): void;

  /**
   * Creates a multi-property "method observer" based on the provided
   * expression, which should be a string in the form of a normal JavaScript
   * function signature: `'methodName(arg1, [..., argn])'`.  Each argument
   * should correspond to a property or path in the context of this
   * prototype (or instance), or may be a literal string or number.
   *
   * @param expression Method expression
   * @param dynamicFn Boolean or object map indicating
   * @returns whether method names should be included as a dependency to the effect.
   */
  createMethodObserver(expression: string, dynamicFn?: boolean|object|null): void;

  /**
   * Causes the setter for the given property to dispatch `<property>-changed`
   * events to notify of changes to the property.
   *
   * @param property Property name
   */
  createNotifyingProperty(property: string): void;

  /**
   * Creates a read-only accessor for the given property.
   *
   * To set the property, use the protected `_setProperty` API.
   * To create a custom protected setter (e.g. `_setMyProp()` for
   * property `myProp`), pass `true` for `protectedSetter`.
   *
   * Note, if the property will have other property effects, this method
   * should be called first, before adding other effects.
   *
   * @param property Property name
   * @param protectedSetter Creates a custom protected setter
   *   when `true`.
   */
  createReadOnlyProperty(property: string, protectedSetter?: boolean): void;

  /**
   * Causes the setter for the given property to reflect the property value
   * to a (dash-cased) attribute of the same name.
   *
   * @param property Property name
   */
  createReflectedProperty(property: string): void;

  /**
   * Creates a computed property whose value is set to the result of the
   * method described by the given `expression` each time one or more
   * arguments to the method changes.  The expression should be a string
   * in the form of a normal JavaScript function signature:
   * `'methodName(arg1, [..., argn])'`
   *
   * @param property Name of computed property to set
   * @param expression Method expression
   * @param dynamicFn Boolean or object map indicating whether
   *   method names should be included as a dependency to the effect.
   */
  createComputedProperty(property: string, expression: string, dynamicFn?: boolean|object|null): void;

  /**
   * Parses the provided template to ensure binding effects are created
   * for them, and then ensures property accessors are created for any
   * dependent properties in the template.  Binding effects for bound
   * templates are stored in a linked list on the instance so that
   * templates can be efficiently stamped and unstamped.
   *
   * @param template Template containing binding
   *   bindings
   * @returns Template metadata object
   */
  bindTemplate(template: HTMLTemplateElement): TemplateInfo;

  /**
   * Adds a property effect to the given template metadata, which is run
   * at the "propagate" stage of `_propertiesChanged` when the template
   * has been bound to the element via `_bindTemplate`.
   *
   * The `effect` object should match the format in `_addPropertyEffect`.
   *
   * @param templateInfo Template metadata to add effect to
   * @param prop Property that should trigger the effect
   * @param effect Effect metadata object
   */
  _addTemplatePropertyEffect(templateInfo: object|null, prop: string, effect?: object|null): void;

  /**
   * Called to parse text in a template (either attribute values or
   * textContent) into binding metadata.
   *
   * Any overrides of this method should return an array of binding part
   * metadata  representing one or more bindings found in the provided text
   * and any "literal" text in between.  Any non-literal parts will be passed
   * to `_evaluateBinding` when any dependencies change.  The only required
   * fields of each "part" in the returned array are as follows:
   *
   * - `dependencies` - Array containing trigger metadata for each property
   *   that should trigger the binding to update
   * - `literal` - String containing text if the part represents a literal;
   *   in this case no `dependencies` are needed
   *
   * Additional metadata for use by `_evaluateBinding` may be provided in
   * each part object as needed.
   *
   * The default implementation handles the following types of bindings
   * (one or more may be intermixed with literal strings):
   * - Property binding: `[[prop]]`
   * - Path binding: `[[object.prop]]`
   * - Negated property or path bindings: `[[!prop]]` or `[[!object.prop]]`
   * - Two-way property or path bindings (supports negation):
   *   `{{prop}}`, `{{object.prop}}`, `{{!prop}}` or `{{!object.prop}}`
   * - Inline computed method (supports negation):
   *   `[[compute(a, 'literal', b)]]`, `[[!compute(a, 'literal', b)]]`
   *
   * The default implementation uses a regular expression for best
   * performance. However, the regular expression uses a white-list of
   * allowed characters in a data-binding, which causes problems for
   * data-bindings that do use characters not in this white-list.
   *
   * Instead of updating the white-list with all allowed characters,
   * there is a StrictBindingParser (see lib/mixins/strict-binding-parser)
   * that uses a state machine instead. This state machine is able to handle
   * all characters. However, it is slightly less performant, therefore we
   * extracted it into a separate optional mixin.
   *
   * @param text Text to parse from attribute or textContent
   * @param templateInfo Current template metadata
   * @returns Array of binding part metadata
   */
  _parseBindings(text: string, templateInfo: object|null): BindingPart[]|null;

  /**
   * Called to evaluate a previously parsed binding part based on a set of
   * one or more changed dependencies.
   *
   * @param inst Element that should be used as
   *     scope for binding dependencies
   * @param part Binding part metadata
   * @param path Property/path that triggered this effect
   * @param props Bag of current property changes
   * @param oldProps Bag of previous values for changed properties
   * @param hasPaths True with `props` contains one or more paths
   * @returns Value the binding part evaluated to
   */
  _evaluateBinding(inst: PropertyEffects, part: BindingPart|null, path: string, props: object|null, oldProps: object|null, hasPaths: boolean): any;
}



/**
 * Element class mixin that provides meta-programming for Polymer's template
 * binding and data observation (collectively, "property effects") system.
 *
 * This mixin uses provides the following key static methods for adding
 * property effects to an element class:
 * - `addPropertyEffect`
 * - `createPropertyObserver`
 * - `createMethodObserver`
 * - `createNotifyingProperty`
 * - `createReadOnlyProperty`
 * - `createReflectedProperty`
 * - `createComputedProperty`
 * - `bindTemplate`
 *
 * Each method creates one or more property accessors, along with metadata
 * used by this mixin's implementation of `_propertiesChanged` to perform
 * the property effects.
 *
 * Underscored versions of the above methods also exist on the element
 * prototype for adding property effects on instances at runtime.
 *
 * Note that this mixin overrides several `PropertyAccessors` methods, in
 * many cases to maintain guarantees provided by the Polymer 1.x features;
 * notably it changes property accessors to be synchronous by default
 * whereas the default when using `PropertyAccessors` standalone is to be
 * async by default.
 */
declare function PropertyEffects<T extends new (...args: any[]) => {}>(base: T): T & PropertyEffectsConstructor & TemplateStampConstructor & PropertyAccessorsConstructor & PropertiesChangedConstructor;

interface PropertyEffects extends TemplateStamp, PropertyAccessors, PropertiesChanged {
  _overrideLegacyUndefined: boolean;
  readonly PROPERTY_EFFECT_TYPES: any;

  /**
   * Stamps the provided template and performs instance-time setup for
   * Polymer template features, including data bindings, declarative event
   * listeners, and the `this.$` map of `id`'s to nodes.  A document fragment
   * is returned containing the stamped DOM, ready for insertion into the
   * DOM.
   *
   * This method may be called more than once; however note that due to
   * `shadycss` polyfill limitations, only styles from templates prepared
   * using `ShadyCSS.prepareTemplate` will be correctly polyfilled (scoped
   * to the shadow root and support CSS custom properties), and note that
   * `ShadyCSS.prepareTemplate` may only be called once per element. As such,
   * any styles required by in runtime-stamped templates must be included
   * in the main element template.
   *
   * @param template Template to stamp
   * @param templateInfo Optional bound template info associated
   *   with the template to be stamped; if omitted the template will be
   *   automatically bound.
   * @returns Cloned template content
   */
  _stampTemplate(template: HTMLTemplateElement, templateInfo?: TemplateInfo|null): StampedTemplate;

  /**
   * Overrides `PropertyAccessors` so that property accessor
   * side effects are not enabled until after client dom is fully ready.
   * Also calls `_flushClients` callback to ensure client dom is enabled
   * that was not enabled as a result of flushing properties.
   */
  ready(): void;
  _initializeProperties(): void;

  /**
   * Overrides `PropertyAccessors` implementation to avoid setting
   * `_setProperty`'s `shouldNotify: true`.
   *
   * @param props Properties to initialize on the instance
   */
  _initializeInstanceProperties(props: object|null): void;

  /**
   * Overrides base implementation to ensure all accessors set `shouldNotify`
   * to true, for per-property notification tracking.
   *
   * @param property Name of the property
   * @param value Value to set
   */
  _setProperty(property: string, value: any): void;

  /**
   * Overrides the `PropertiesChanged` implementation to introduce special
   * dirty check logic depending on the property & value being set:
   *
   * 1. Any value set to a path (e.g. 'obj.prop': 42 or 'obj.prop': {...})
   *    Stored in `__dataTemp`, dirty checked against `__dataTemp`
   * 2. Object set to simple property (e.g. 'prop': {...})
   *    Stored in `__dataTemp` and `__data`, dirty checked against
   *    `__dataTemp` by default implementation of `_shouldPropertyChange`
   * 3. Primitive value set to simple property (e.g. 'prop': 42)
   *    Stored in `__data`, dirty checked against `__data`
   *
   * The dirty-check is important to prevent cycles due to two-way
   * notification, but paths and objects are only dirty checked against any
   * previous value set during this turn via a "temporary cache" that is
   * cleared when the last `_propertiesChanged` exits. This is so:
   * a. any cached array paths (e.g. 'array.3.prop') may be invalidated
   *    due to array mutations like shift/unshift/splice; this is fine
   *    since path changes are dirty-checked at user entry points like `set`
   * b. dirty-checking for objects only lasts one turn to allow the user
   *    to mutate the object in-place and re-set it with the same identity
   *    and have all sub-properties re-propagated in a subsequent turn.
   *
   * The temp cache is not necessarily sufficient to prevent invalid array
   * paths, since a splice can happen during the same turn (with pathological
   * user code); we could introduce a "fixup" for temporarily cached array
   * paths if needed: https://github.com/Polymer/polymer/issues/4227
   *
   * @param property Name of the property
   * @param value Value to set
   * @param shouldNotify True if property should fire notification
   *   event (applies only for `notify: true` properties)
   * @returns Returns true if the property changed
   */
  _setPendingProperty(property: string, value: any, shouldNotify?: boolean): boolean;

  /**
   * Overrides `PropertyAccessor`'s default async queuing of
   * `_propertiesChanged`: if `__dataReady` is false (has not yet been
   * manually flushed), the function no-ops; otherwise flushes
   * `_propertiesChanged` synchronously.
   */
  _invalidateProperties(): void;

  /**
   * Implements `PropertyAccessors`'s properties changed callback.
   *
   * Runs each class of effects for the batch of changed properties in
   * a specific order (compute, propagate, reflect, observe, notify).
   *
   * @param currentProps Bag of all current accessor values
   * @param changedProps Bag of properties changed since the last
   *   call to `_propertiesChanged`
   * @param oldProps Bag of previous values for each property
   *   in `changedProps`
   */
  _propertiesChanged(currentProps: object, changedProps: object|null, oldProps: object|null): void;

  /**
   * Overrides `PropertyAccessors` implementation to provide a
   * more efficient implementation of initializing properties from
   * the prototype on the instance.
   *
   * @param props Properties to initialize on the prototype
   */
  _initializeProtoProperties(props: object|null): void;
  _registerHost(): void;

  /**
   * Equivalent to static `addPropertyEffect` API but can be called on
   * an instance to add effects at runtime.  See that method for
   * full API docs.
   *
   * @param property Property that should trigger the effect
   * @param type Effect type, from this.PROPERTY_EFFECT_TYPES
   * @param effect Effect metadata object
   */
  _addPropertyEffect(property: string, type: string, effect?: object|null): void;

  /**
   * Removes the given property effect.
   *
   * @param property Property the effect was associated with
   * @param type Effect type, from this.PROPERTY_EFFECT_TYPES
   * @param effect Effect metadata object to remove
   */
  _removePropertyEffect(property: string, type: string, effect?: object|null): void;

  /**
   * Returns whether the current prototype/instance has a property effect
   * of a certain type.
   *
   * @param property Property name
   * @param type Effect type, from this.PROPERTY_EFFECT_TYPES
   * @returns True if the prototype/instance has an effect of this
   *     type
   */
  _hasPropertyEffect(property: string, type?: string): boolean;

  /**
   * Returns whether the current prototype/instance has a "read only"
   * accessor for the given property.
   *
   * @param property Property name
   * @returns True if the prototype/instance has an effect of this
   *     type
   */
  _hasReadOnlyEffect(property: string): boolean;

  /**
   * Returns whether the current prototype/instance has a "notify"
   * property effect for the given property.
   *
   * @param property Property name
   * @returns True if the prototype/instance has an effect of this
   *     type
   */
  _hasNotifyEffect(property: string): boolean;

  /**
   * Returns whether the current prototype/instance has a "reflect to
   * attribute" property effect for the given property.
   *
   * @param property Property name
   * @returns True if the prototype/instance has an effect of this
   *     type
   */
  _hasReflectEffect(property: string): boolean;

  /**
   * Returns whether the current prototype/instance has a "computed"
   * property effect for the given property.
   *
   * @param property Property name
   * @returns True if the prototype/instance has an effect of this
   *     type
   */
  _hasComputedEffect(property: string): boolean;

  /**
   * Sets a pending property or path.  If the root property of the path in
   * question had no accessor, the path is set, otherwise it is enqueued
   * via `_setPendingProperty`.
   *
   * This function isolates relatively expensive functionality necessary
   * for the public API (`set`, `setProperties`, `notifyPath`, and property
   * change listeners via {{...}} bindings), such that it is only done
   * when paths enter the system, and not at every propagation step.  It
   * also sets a `__dataHasPaths` flag on the instance which is used to
   * fast-path slower path-matching code in the property effects host paths.
   *
   * `path` can be a path string or array of path parts as accepted by the
   * public API.
   *
   * @param path Path to set
   * @param value Value to set
   * @param shouldNotify Set to true if this change should
   *  cause a property notification event dispatch
   * @param isPathNotification If the path being set is a path
   *   notification of an already changed value, as opposed to a request
   *   to set and notify the change.  In the latter `false` case, a dirty
   *   check is performed and then the value is set to the path before
   *   enqueuing the pending property change.
   * @returns Returns true if the property/path was enqueued in
   *   the pending changes bag.
   */
  _setPendingPropertyOrPath(path: string|Array<number|string>, value: any, shouldNotify?: boolean, isPathNotification?: boolean): boolean;

  /**
   * Applies a value to a non-Polymer element/node's property.
   *
   * The implementation makes a best-effort at binding interop:
   * Some native element properties have side-effects when
   * re-setting the same value (e.g. setting `<input>.value` resets the
   * cursor position), so we do a dirty-check before setting the value.
   * However, for better interop with non-Polymer custom elements that
   * accept objects, we explicitly re-set object changes coming from the
   * Polymer world (which may include deep object changes without the
   * top reference changing), erring on the side of providing more
   * information.
   *
   * Users may override this method to provide alternate approaches.
   *
   * @param node The node to set a property on
   * @param prop The property to set
   * @param value The value to set
   */
  _setUnmanagedPropertyToNode(node: Node, prop: string, value: any): void;

  /**
   * Enqueues the given client on a list of pending clients, whose
   * pending property changes can later be flushed via a call to
   * `_flushClients`.
   *
   * @param client PropertyEffects client to enqueue
   */
  _enqueueClient(client: object|null): void;

  /**
   * Flushes any clients previously enqueued via `_enqueueClient`, causing
   * their `_flushProperties` method to run.
   */
  _flushClients(): void;

  /**
   * Perform any initial setup on client dom. Called before the first
   * `_flushProperties` call on client dom and before any element
   * observers are called.
   */
  _readyClients(): void;

  /**
   * Sets a bag of property changes to this instance, and
   * synchronously processes all effects of the properties as a batch.
   *
   * Property names must be simple properties, not paths.  Batched
   * path propagation is not supported.
   *
   * @param props Bag of one or more key-value pairs whose key is
   *   a property and value is the new value to set for that property.
   * @param setReadOnly When true, any private values set in
   *   `props` will be set. By default, `setProperties` will not set
   *   `readOnly: true` root properties.
   */
  setProperties(props: object|null, setReadOnly?: boolean): void;

  /**
   * Called to propagate any property changes to stamped template nodes
   * managed by this element.
   *
   * @param changedProps Bag of changed properties
   * @param oldProps Bag of previous values for changed properties
   * @param hasPaths True with `props` contains one or more paths
   */
  _propagatePropertyChanges(changedProps: object|null, oldProps: object|null, hasPaths: boolean): void;
  _runEffectsForTemplate(templateInfo: any, changedProps: any, oldProps: any, hasPaths: any): void;

  /**
   * Aliases one data path as another, such that path notifications from one
   * are routed to the other.
   *
   * @param to Target path to link.
   * @param from Source path to link.
   */
  linkPaths(to: string|Array<string|number>, from: string|Array<string|number>): void;

  /**
   * Removes a data path alias previously established with `_linkPaths`.
   *
   * Note, the path to unlink should be the target (`to`) used when
   * linking the paths.
   *
   * @param path Target path to unlink.
   */
  unlinkPaths(path: string|Array<string|number>): void;

  /**
   * Notify that an array has changed.
   *
   * Example:
   *
   *     this.items = [ {name: 'Jim'}, {name: 'Todd'}, {name: 'Bill'} ];
   *     ...
   *     this.items.splice(1, 1, {name: 'Sam'});
   *     this.items.push({name: 'Bob'});
   *     this.notifySplices('items', [
   *       { index: 1, removed: [{name: 'Todd'}], addedCount: 1,
   *         object: this.items, type: 'splice' },
   *       { index: 3, removed: [], addedCount: 1,
   *         object: this.items, type: 'splice'}
   *     ]);
   *
   * @param path Path that should be notified.
   * @param splices Array of splice records indicating ordered
   *   changes that occurred to the array. Each record should have the
   *   following fields:
   *    * index: index at which the change occurred
   *    * removed: array of items that were removed from this index
   *    * addedCount: number of new items added at this index
   *    * object: a reference to the array in question
   *    * type: the string literal 'splice'
   *
   *   Note that splice records _must_ be normalized such that they are
   *   reported in index order (raw results from `Object.observe` are not
   *   ordered and must be normalized/merged before notifying).
   */
  notifySplices(path: string, splices: any[]|null): void;

  /**
   * Convenience method for reading a value from a path.
   *
   * Note, if any part in the path is undefined, this method returns
   * `undefined` (this method does not throw when dereferencing undefined
   * paths).
   *
   * @param path Path to the value
   *   to read.  The path may be specified as a string (e.g. `foo.bar.baz`)
   *   or an array of path parts (e.g. `['foo.bar', 'baz']`).  Note that
   *   bracketed expressions are not supported; string-based path parts
   *   *must* be separated by dots.  Note that when dereferencing array
   *   indices, the index may be used as a dotted part directly
   *   (e.g. `users.12.name` or `['users', 12, 'name']`).
   * @param root Root object from which the path is evaluated.
   * @returns Value at the path, or `undefined` if any part of the path
   *   is undefined.
   */
  get(path: string|Array<string|number>, root?: object|null): any;

  /**
   * Convenience method for setting a value to a path and notifying any
   * elements bound to the same path.
   *
   * Note, if any part in the path except for the last is undefined,
   * this method does nothing (this method does not throw when
   * dereferencing undefined paths).
   *
   * @param path Path to the value
   *   to write.  The path may be specified as a string (e.g. `'foo.bar.baz'`)
   *   or an array of path parts (e.g. `['foo.bar', 'baz']`).  Note that
   *   bracketed expressions are not supported; string-based path parts
   *   *must* be separated by dots.  Note that when dereferencing array
   *   indices, the index may be used as a dotted part directly
   *   (e.g. `'users.12.name'` or `['users', 12, 'name']`).
   * @param value Value to set at the specified path.
   * @param root Root object from which the path is evaluated.
   *   When specified, no notification will occur.
   */
  set(path: string|Array<string|number>, value: any, root?: object|null): void;

  /**
   * Adds items onto the end of the array at the path specified.
   *
   * The arguments after `path` and return value match that of
   * `Array.prototype.push`.
   *
   * This method notifies other paths to the same array that a
   * splice occurred to the array.
   *
   * @param path Path to array.
   * @param items Items to push onto array
   * @returns New length of the array.
   */
  push(path: string|Array<string|number>, ...items: any[]): number;

  /**
   * Removes an item from the end of array at the path specified.
   *
   * The arguments after `path` and return value match that of
   * `Array.prototype.pop`.
   *
   * This method notifies other paths to the same array that a
   * splice occurred to the array.
   *
   * @param path Path to array.
   * @returns Item that was removed.
   */
  pop(path: string|Array<string|number>): any;

  /**
   * Starting from the start index specified, removes 0 or more items
   * from the array and inserts 0 or more new items in their place.
   *
   * The arguments after `path` and return value match that of
   * `Array.prototype.splice`.
   *
   * This method notifies other paths to the same array that a
   * splice occurred to the array.
   *
   * @param path Path to array.
   * @param start Index from which to start removing/inserting.
   * @param deleteCount Number of items to remove.
   * @param items Items to insert into array.
   * @returns Array of removed items.
   */
  splice(path: string|Array<string|number>, start: number, deleteCount?: number, ...items: any[]): any[];

  /**
   * Removes an item from the beginning of array at the path specified.
   *
   * The arguments after `path` and return value match that of
   * `Array.prototype.pop`.
   *
   * This method notifies other paths to the same array that a
   * splice occurred to the array.
   *
   * @param path Path to array.
   * @returns Item that was removed.
   */
  shift(path: string|Array<string|number>): any;

  /**
   * Adds items onto the beginning of the array at the path specified.
   *
   * The arguments after `path` and return value match that of
   * `Array.prototype.push`.
   *
   * This method notifies other paths to the same array that a
   * splice occurred to the array.
   *
   * @param path Path to array.
   * @param items Items to insert info array
   * @returns New length of the array.
   */
  unshift(path: string|Array<string|number>, ...items: any[]): number;

  /**
   * Notify that a path has changed.
   *
   * Example:
   *
   *     this.item.user.name = 'Bob';
   *     this.notifyPath('item.user.name');
   *
   * @param path Path that should be notified.
   * @param value Value at the path (optional).
   */
  notifyPath(path: string, value?: any): void;

  /**
   * Equivalent to static `createReadOnlyProperty` API but can be called on
   * an instance to add effects at runtime.  See that method for
   * full API docs.
   *
   * @param property Property name
   * @param protectedSetter Creates a custom protected setter
   *   when `true`.
   */
  _createReadOnlyProperty(property: string, protectedSetter?: boolean): void;

  /**
   * Equivalent to static `createPropertyObserver` API but can be called on
   * an instance to add effects at runtime.  See that method for
   * full API docs.
   *
   * @param property Property name
   * @param method Function or name of observer method
   *     to call
   * @param dynamicFn Whether the method name should be included as
   *   a dependency to the effect.
   */
  _createPropertyObserver(property: string, method: string|((p0: any, p1: any) => any), dynamicFn?: boolean): void;

  /**
   * Equivalent to static `createMethodObserver` API but can be called on
   * an instance to add effects at runtime.  See that method for
   * full API docs.
   *
   * @param expression Method expression
   * @param dynamicFn Boolean or object map indicating
   *   whether method names should be included as a dependency to the effect.
   */
  _createMethodObserver(expression: string, dynamicFn?: boolean|object|null): void;

  /**
   * Equivalent to static `createNotifyingProperty` API but can be called on
   * an instance to add effects at runtime.  See that method for
   * full API docs.
   *
   * @param property Property name
   */
  _createNotifyingProperty(property: string): void;

  /**
   * Equivalent to static `createReflectedProperty` API but can be called on
   * an instance to add effects at runtime.  See that method for
   * full API docs.
   *
   * @param property Property name
   */
  _createReflectedProperty(property: string): void;

  /**
   * Equivalent to static `createComputedProperty` API but can be called on
   * an instance to add effects at runtime.  See that method for
   * full API docs.
   *
   * @param property Name of computed property to set
   * @param expression Method expression
   * @param dynamicFn Boolean or object map indicating
   *   whether method names should be included as a dependency to the effect.
   */
  _createComputedProperty(property: string, expression: string, dynamicFn?: boolean|object|null): void;

  /**
   * Equivalent to static `bindTemplate` API but can be called on an instance
   * to add effects at runtime.  See that method for full API docs.
   *
   * This method may be called on the prototype (for prototypical template
   * binding, to avoid creating accessors every instance) once per prototype,
   * and will be called with `runtimeBinding: true` by `_stampTemplate` to
   * create and link an instance of the template metadata associated with a
   * particular stamping.
   *
   * @param template Template containing binding
   * bindings
   * @param instanceBinding When false (default), performs
   * "prototypical" binding of the template and overwrites any previously
   * bound template for the class. When true (as passed from
   * `_stampTemplate`), the template info is instanced and linked into the
   * list of bound templates.
   * @returns Template metadata object; for `runtimeBinding`,
   * this is an instance of the prototypical template info
   */
  _bindTemplate(template: HTMLTemplateElement, instanceBinding?: boolean): TemplateInfo;

  /**
   * Removes and unbinds the nodes previously contained in the provided
   * DocumentFragment returned from `_stampTemplate`.
   *
   * @param dom DocumentFragment previously returned
   *   from `_stampTemplate` associated with the nodes to be removed
   */
  _removeBoundDom(dom: StampedTemplate): void;
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today



interface PropertiesMixinConstructor {
  new(...args: any[]): PropertiesMixin;

  /**
   * Overrides `PropertiesChanged` method to return type specified in the
   * static `properties` object for the given property.
   *
   * @param name Name of property
   * @returns Type to which to deserialize attribute
   */
  typeForProperty(name: string): any;

  /**
   * Finalizes an element definition, including ensuring any super classes
   * are also finalized. This includes ensuring property
   * accessors exist on the element prototype. This method calls
   * `_finalizeClass` to finalize each constructor in the prototype chain.
   */
  finalize(): void;

  /**
   * Finalize an element class. This includes ensuring property
   * accessors exist on the element prototype. This method is called by
   * `finalize` and finalizes the class constructor.
   */
  _finalizeClass(): void;
}



/**
 * Mixin that provides a minimal starting point to using the PropertiesChanged
 * mixin by providing a mechanism to declare properties in a static
 * getter (e.g. static get properties() { return { foo: String } }). Changes
 * are reported via the `_propertiesChanged` method.
 *
 * This mixin provides no specific support for rendering. Users are expected
 * to create a ShadowRoot and put content into it and update it in whatever
 * way makes sense. This can be done in reaction to properties changing by
 * implementing `_propertiesChanged`.
 */
declare function PropertiesMixin<T extends new (...args: any[]) => {}>(base: T): T & PropertiesMixinConstructor & PropertiesChangedConstructor;

interface PropertiesMixin extends PropertiesChanged {

  /**
   * Overrides `PropertiesChanged` method and adds a call to
   * `finalize` which lazily configures the element's property accessors.
   */
  _initializeProperties(): void;

  /**
   * Called when the element is added to a document.
   * Calls `_enableProperties` to turn on property system from
   * `PropertiesChanged`.
   */
  connectedCallback(): void;

  /**
   * Called when the element is removed from a document
   */
  disconnectedCallback(): void;
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.




/**
 * Resolves the given URL against the provided `baseUri'.
 *
 * Note that this function performs no resolution for URLs that start
 * with `/` (absolute URLs) or `#` (hash identifiers).  For general purpose
 * URL resolution, use `window.URL`.
 *
 * @returns resolved URL
 */
declare function resolveUrl(url: string, baseURI?: string|null): string;



/**
 * Resolves any relative URL's in the given CSS text against the provided
 * `ownerDocument`'s `baseURI`.
 *
 * @returns Processed CSS text with resolved URL's
 */
declare function resolveCss(cssText: string, baseURI: string): string;



/**
 * Returns a path from a given `url`. The path includes the trailing
 * `/` from the url.
 *
 * @returns resolved path
 */
declare function pathFromUrl(url: string): string;

declare const resolveUrl_d_pathFromUrl: typeof pathFromUrl;
declare const resolveUrl_d_resolveCss: typeof resolveCss;
declare const resolveUrl_d_resolveUrl: typeof resolveUrl;
declare namespace resolveUrl_d {
  export { resolveUrl_d_pathFromUrl as pathFromUrl, resolveUrl_d_resolveCss as resolveCss, resolveUrl_d_resolveUrl as resolveUrl };
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today



/**
 * The `dom-module` element registers the dom it contains to the name given
 * by the module's id attribute. It provides a unified database of dom
 * accessible via its static `import` API.
 *
 * A key use case of `dom-module` is for providing custom element `<template>`s
 * via HTML imports that are parsed by the native HTML parser, that can be
 * relocated during a bundling pass and still looked up by `id`.
 *
 * Example:
 *
 *     <dom-module id="foo">
 *       <img src="stuff.png">
 *     </dom-module>
 *
 * Then in code in some other location that cannot access the dom-module above
 *
 *     let img = customElements.get('dom-module').import('foo', 'img');
 */
declare class DomModule extends HTMLElement {

  /**
   * The absolute URL of the original location of this `dom-module`.
   *
   * This value will differ from this element's `ownerDocument` in the
   * following ways:
   * - Takes into account any `assetpath` attribute added during bundling
   *   to indicate the original location relative to the bundled location
   * - Uses the HTMLImports polyfill's `importForElement` API to ensure
   *   the path is relative to the import document's location since
   *   `ownerDocument` is not currently polyfilled
   *    
   */
  readonly assetpath: any;

  /**
   * Retrieves the element specified by the css `selector` in the module
   * registered by `id`. For example, this.import('foo', 'img');
   *
   * @param id The id of the dom-module in which to search.
   * @param selector The css selector by which to find the element.
   * @returns Returns the element which matches `selector` in the
   * module registered at the specified `id`.
   */
  static import(id: string, selector?: string): Element|null;

  /**
   * @param name Name of attribute.
   * @param old Old value of attribute.
   * @param value Current value of attribute.
   * @param namespace Attribute namespace.
   */
  attributeChangedCallback(name: string, old: string|null, value: string|null, namespace: string|null): void;

  /**
   * Registers the dom-module at a given id. This method should only be called
   * when a dom-module is imperatively created. For
   * example, `document.createElement('dom-module').register('foo')`.
   *
   * @param id The id at which to register the dom-module.
   */
  register(id?: string): void;
}

declare global {

  interface HTMLElementTagNameMap {
    "dom-module": DomModule;
  }
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today



interface ElementMixinConstructor {
  new(...args: any[]): ElementMixin;

  /**
   * Overrides `PropertyEffects` to add map of dynamic functions on
   * template info, for consumption by `PropertyEffects` template binding
   * code. This map determines which method templates should have accessors
   * created for them.
   *
   * @param template Template
   * @param templateInfo Template metadata for current template
   * @param nodeInfo Node metadata for current template.
   * @returns .
   */
  _parseTemplateContent(template: HTMLTemplateElement, templateInfo: TemplateInfo, nodeInfo: NodeInfo): boolean;

  /**
   * Override of PropertiesChanged createProperties to create accessors
   * and property effects for all of the properties.
   *
   * @param props .
   */
  createProperties(props: object): void;

  /**
   * Overrides `PropertyEffects` to warn on use of undeclared properties in
   * template.
   *
   * @param templateInfo Template metadata to add effect to
   * @param prop Property that should trigger the effect
   * @param effect Effect metadata object
   */
  _addTemplatePropertyEffect(templateInfo: object|null, prop: string, effect?: object|null): void;

  /**
   * Override of PropertiesMixin _finalizeClass to create observers and
   * find the template.
   */
  _finalizeClass(): void;
  _prepareTemplate(): void;

  /**
   * Creates observers for the given `observers` array.
   * Leverages `PropertyEffects` to create observers.
   *
   * @param observers Array of observer descriptors for
   *   this class
   * @param dynamicFns Object containing keys for any properties
   *   that are functions and should trigger the effect when the function
   *   reference is changed
   */
  createObservers(observers: object|null, dynamicFns: object|null): void;

  /**
   * Gather style text for a style element in the template.
   *
   * @param cssText Text containing styling to process
   * @param baseURI Base URI to rebase CSS paths against
   * @returns The processed CSS text
   */
  _processStyleText(cssText: string, baseURI: string): string;

  /**
   * Configures an element `proto` to function with a given `template`.
   * The element name `is` and extends `ext` must be specified for ShadyCSS
   * style scoping.
   *
   * @param is Tag name (or type extension name) for this element
   */
  _finalizeTemplate(is: string): void;
}



/**
 * Element class mixin that provides the core API for Polymer's meta-programming
 * features including template stamping, data-binding, attribute deserialization,
 * and property change observation.
 *
 * Subclassers may provide the following static getters to return metadata
 * used to configure Polymer's features for the class:
 *
 * - `static get is()`: When the template is provided via a `dom-module`,
 *   users should return the `dom-module` id from a static `is` getter.  If
 *   no template is needed or the template is provided directly via the
 *   `template` getter, there is no need to define `is` for the element.
 *
 * - `static get template()`: Users may provide the template directly (as
 *   opposed to via `dom-module`) by implementing a static `template` getter.
 *   The getter must return an `HTMLTemplateElement`.
 *
 * - `static get properties()`: Should return an object describing
 *   property-related metadata used by Polymer features (key: property name
 *   value: object containing property metadata). Valid keys in per-property
 *   metadata include:
 *   - `type` (String|Number|Object|Array|...): Used by
 *     `attributeChangedCallback` to determine how string-based attributes
 *     are deserialized to JavaScript property values.
 *   - `notify` (boolean): Causes a change in the property to fire a
 *     non-bubbling event called `<property>-changed`. Elements that have
 *     enabled two-way binding to the property use this event to observe changes.
 *   - `readOnly` (boolean): Creates a getter for the property, but no setter.
 *     To set a read-only property, use the private setter method
 *     `_setProperty(property, value)`.
 *   - `observer` (string): Observer method name that will be called when
 *     the property changes. The arguments of the method are
 *     `(value, previousValue)`.
 *   - `computed` (string): String describing method and dependent properties
 *     for computing the value of this property (e.g. `'computeFoo(bar, zot)'`).
 *     Computed properties are read-only by default and can only be changed
 *     via the return value of the computing method.
 *
 * - `static get observers()`: Array of strings describing multi-property
 *   observer methods and their dependent properties (e.g.
 *   `'observeABC(a, b, c)'`).
 *
 * The base class provides default implementations for the following standard
 * custom element lifecycle callbacks; users may override these, but should
 * call the super method to ensure
 * - `constructor`: Run when the element is created or upgraded
 * - `connectedCallback`: Run each time the element is connected to the
 *   document
 * - `disconnectedCallback`: Run each time the element is disconnected from
 *   the document
 * - `attributeChangedCallback`: Run each time an attribute in
 *   `observedAttributes` is set or removed (note: this element's default
 *   `observedAttributes` implementation will automatically return an array
 *   of dash-cased attributes based on `properties`)
 */
declare function ElementMixin<T extends new (...args: any[]) => {}>(base: T): T & ElementMixinConstructor & PropertyEffectsConstructor & TemplateStampConstructor & PropertyAccessorsConstructor & PropertiesChangedConstructor & PropertiesMixinConstructor;

interface ElementMixin extends PropertyEffects, TemplateStamp, PropertyAccessors, PropertiesChanged, PropertiesMixin {
  _template: HTMLTemplateElement|null;
  _importPath: string;
  rootPath: string;
  importPath: string;
  root: StampedTemplate|HTMLElement|ShadowRoot|null;
  $: {[key: string]: Element};

  /**
   * Stamps the element template.
   */
  ready(): void;

  /**
   * Overrides the default `PropertyAccessors` to ensure class
   * metaprogramming related to property accessors and effects has
   * completed (calls `finalize`).
   *
   * It also initializes any property defaults provided via `value` in
   * `properties` metadata.
   */
  _initializeProperties(): void;

  /**
   * Implements `PropertyEffects`'s `_readyClients` call. Attaches
   * element dom by calling `_attachDom` with the dom stamped from the
   * element's template via `_stampTemplate`. Note that this allows
   * client dom to be attached to the element prior to any observers
   * running.
   */
  _readyClients(): void;

  /**
   * Provides a default implementation of the standard Custom Elements
   * `connectedCallback`.
   *
   * The default implementation enables the property effects system and
   * flushes any pending properties, and updates shimmed CSS properties
   * when using the ShadyCSS scoping/custom properties polyfill.
   */
  connectedCallback(): void;

  /**
   * Determines if a property dfeault can be applied. For example, this
   * prevents a default from being applied when a property that has no
   * accessor is overridden by its host before upgrade (e.g. via a binding).
   *
   * @param property Name of the property
   * @returns Returns true if the property default can be applied.
   */
  _canApplyPropertyDefault(property: string): boolean;

  /**
   * Attaches an element's stamped dom to itself. By default,
   * this method creates a `shadowRoot` and adds the dom to it.
   * However, this method may be overridden to allow an element
   * to put its dom in another location.
   *
   * @param dom to attach to the element.
   * @returns node to which the dom has been attached.
   */
  _attachDom(dom: StampedTemplate|null): ShadowRoot|null;

  /**
   * When using the ShadyCSS scoping and custom property shim, causes all
   * shimmed styles in this element (and its subtree) to be updated
   * based on current custom property values.
   *
   * The optional parameter overrides inline custom property styles with an
   * object of properties where the keys are CSS properties, and the values
   * are strings.
   *
   * Example: `this.updateStyles({'--color': 'blue'})`
   *
   * These properties are retained unless a value of `null` is set.
   *
   * Note: This function does not support updating CSS mixins.
   * You can not dynamically change the value of an `@apply`.
   *
   * @param properties Bag of custom property key/values to
   *   apply to this element.
   */
  updateStyles(properties?: object|null): void;

  /**
   * Rewrites a given URL relative to a base URL. The base URL defaults to
   * the original location of the document containing the `dom-module` for
   * this element. This method will return the same URL before and after
   * bundling.
   *
   * Note that this function performs no resolution for URLs that start
   * with `/` (absolute URLs) or `#` (hash identifiers).  For general purpose
   * URL resolution, use `window.URL`.
   *
   * @param url URL to resolve.
   * @param base Optional base URL to resolve against, defaults
   * to the element's `importPath`
   * @returns Rewritten URL relative to base
   */
  resolveUrl(url: string, base?: string): string;
}

/**
 * A template literal tag that creates an HTML <template> element from the
 * contents of the string.
 *
 * This allows you to write a Polymer Template in JavaScript.
 *
 * Templates can be composed by interpolating `HTMLTemplateElement`s in
 * expressions in the JavaScript template literal. The nested template's
 * `innerHTML` is included in the containing template.  The only other
 * values allowed in expressions are those returned from `htmlLiteral`
 * which ensures only literal values from JS source ever reach the HTML, to
 * guard against XSS risks.
 *
 * All other values are disallowed in expressions to help prevent XSS
 * attacks; however, `htmlLiteral` can be used to compose static
 * string values into templates. This is useful to compose strings into
 * places that do not accept html, like the css text of a `style`
 * element.
 *
 * Example:
 *
 *     static get template() {
 *       return html`
 *         <style>:host{ content:"..." }</style>
 *         <div class="shadowed">${this.partialTemplate}</div>
 *         ${super.template}
 *       `;
 *     }
 *     static get partialTemplate() { return html`<span>Partial!</span>`; }
 *
 * @returns Constructed HTMLTemplateElement
 */
declare function html(strings: TemplateStringsArray, ...values: any[]): HTMLTemplateElement;

// tslint:disable:variable-name Describing an API that's defined elsewhere.



declare const PolymerElement_Base: typeof HTMLElement & ElementMixinConstructor & PropertyEffectsConstructor & TemplateStampConstructor & PropertyAccessorsConstructor & PropertiesChangedConstructor & PropertiesMixinConstructor

/**
 * Base class that provides the core API for Polymer's meta-programming
 * features including template stamping, data-binding, attribute deserialization,
 * and property change observation.
 */
declare class PolymerElement extends PolymerElement_Base {
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today



interface OptionalMutableDataConstructor {
  new(...args: any[]): OptionalMutableData;
}



/**
 * Element class mixin to add the optional ability to skip strict
 * dirty-checking for objects and arrays (always consider them to be
 * "dirty") by setting a `mutable-data` attribute on an element instance.
 *
 * By default, `PropertyEffects` performs strict dirty checking on
 * objects, which means that any deep modifications to an object or array will
 * not be propagated unless "immutable" data patterns are used (i.e. all object
 * references from the root to the mutation were changed).
 *
 * Polymer also provides a proprietary data mutation and path notification API
 * (e.g. `notifyPath`, `set`, and array mutation API's) that allow efficient
 * mutation and notification of deep changes in an object graph to all elements
 * bound to the same object graph.
 *
 * In cases where neither immutable patterns nor the data mutation API can be
 * used, applying this mixin will allow Polymer to skip dirty checking for
 * objects and arrays (always consider them to be "dirty").  This allows a
 * user to make a deep modification to a bound object graph, and then either
 * simply re-set the object (e.g. `this.items = this.items`) or call `notifyPath`
 * (e.g. `this.notifyPath('items')`) to update the tree.  Note that all
 * elements that wish to be updated based on deep mutations must apply this
 * mixin or otherwise skip strict dirty checking for objects/arrays.
 * Specifically, any elements in the binding tree between the source of a
 * mutation and the consumption of it must enable this mixin or apply the
 * `MutableData` mixin.
 *
 * While this mixin adds the ability to forgo Object/Array dirty checking,
 * the `mutableData` flag defaults to false and must be set on the instance.
 *
 * Note, the performance characteristics of propagating large object graphs
 * will be worse by relying on `mutableData: true` as opposed to using
 * strict dirty checking with immutable patterns or Polymer's path notification
 * API.
 */
declare function OptionalMutableData<T extends new (...args: any[]) => {}>(base: T): T & OptionalMutableDataConstructor;

interface OptionalMutableData {

  /**
   * Instance-level flag for configuring the dirty-checking strategy
   * for this element.  When true, Objects and Arrays will skip dirty
   * checking, otherwise strict equality checking will be used.
   */
  mutableData: boolean|null|undefined;

  /**
   * Overrides `PropertyEffects` to provide option for skipping
   * strict equality checking for Objects and Arrays.
   *
   * When `this.mutableData` is true on this instance, this method
   * pulls the value to dirty check against from the `__dataTemp` cache
   * (rather than the normal `__data` cache) for Objects.  Since the temp
   * cache is cleared at the end of a turn, this implementation allows
   * side-effects of deep object changes to be processed by re-setting the
   * same object (using the temp cache as an in-turn backstop to prevent
   * cycles due to 2-way notification).
   *
   * @param property Property name
   * @param value New property value
   * @param old Previous property value
   * @returns Whether the property should be considered a change
   */
  _shouldPropertyChange(property: string, value: any, old: any): boolean;
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today



declare class Debouncer {
  constructor();

  /**
   * Creates a debouncer if no debouncer is passed as a parameter
   * or it cancels an active debouncer otherwise. The following
   * example shows how a debouncer can be called multiple times within a
   * microtask and "debounced" such that the provided callback function is
   * called once. Add this method to a custom element:
   *
   * ```js
   * import {microTask} from '@polymer/polymer/lib/utils/async.js';
   * import {Debouncer} from '@polymer/polymer/lib/utils/debounce.js';
   * // ...
   *
   * _debounceWork() {
   *   this._debounceJob = Debouncer.debounce(this._debounceJob,
   *       microTask, () => this._doWork());
   * }
   * ```
   *
   * If the `_debounceWork` method is called multiple times within the same
   * microtask, the `_doWork` function will be called only once at the next
   * microtask checkpoint.
   *
   * Note: In testing it is often convenient to avoid asynchrony. To accomplish
   * this with a debouncer, you can use `enqueueDebouncer` and
   * `flush`. For example, extend the above example by adding
   * `enqueueDebouncer(this._debounceJob)` at the end of the
   * `_debounceWork` method. Then in a test, call `flush` to ensure
   * the debouncer has completed.
   *
   * @param debouncer Debouncer object.
   * @param asyncModule Object with Async interface
   * @param callback Callback to run.
   * @returns Returns a debouncer object.
   */
  static debounce(debouncer: Debouncer|null, asyncModule: AsyncInterface, callback: () => any): Debouncer;

  /**
   * Sets the scheduler; that is, a module with the Async interface,
   * a callback and optional arguments to be passed to the run function
   * from the async module.
   *
   * @param asyncModule Object with Async interface.
   * @param callback Callback to run.
   */
  setConfig(asyncModule: AsyncInterface, callback: () => any): void;

  /**
   * Cancels an active debouncer and returns a reference to itself.
   */
  cancel(): void;

  /**
   * Cancels a debouncer's async callback.
   */
  _cancelAsync(): void;

  /**
   * Flushes an active debouncer and returns a reference to itself.
   */
  flush(): void;

  /**
   * Returns true if the debouncer is active.
   *
   * @returns True if active.
   */
  isActive(): boolean;
}



/**
 * Adds a `Debouncer` to a list of globally flushable tasks.
 */
declare function enqueueDebouncer(debouncer: Debouncer): void;



/**
 * Flushes any enqueued debouncers
 *
 * @returns Returns whether any debouncers were flushed
 */
declare function flushDebouncers(): boolean;

type debounce_d_Debouncer = Debouncer;
declare const debounce_d_Debouncer: typeof Debouncer;
declare const debounce_d_enqueueDebouncer: typeof enqueueDebouncer;
declare const debounce_d_flushDebouncers: typeof flushDebouncers;
declare namespace debounce_d {
  export { debounce_d_Debouncer as Debouncer, debounce_d_enqueueDebouncer as enqueueDebouncer, debounce_d_flushDebouncers as flushDebouncers };
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.




/**
 * Finds the element rendered on the screen at the provided coordinates.
 *
 * Similar to `document.elementFromPoint`, but pierces through
 * shadow roots.
 *
 * @returns Returns the deepest shadowRoot inclusive element
 * found at the screen position given.
 */
declare function deepTargetFind(x: number, y: number): Element|null;



/**
 * Adds an event listener to a node for the given gesture type.
 *
 * @returns Returns true if a gesture event listener was added.
 */
declare function addListener(node: EventTarget, evType: string, handler: (p0: Event) => void): boolean;



/**
 * Removes an event listener from a node for the given gesture type.
 *
 * @returns Returns true if a gesture event listener was removed.
 */
declare function removeListener(node: EventTarget, evType: string, handler: (p0: Event) => void): boolean;



/**
 * Registers a new gesture event recognizer for adding new custom
 * gesture event types.
 */
declare function register(recog: GestureRecognizer): void;



/**
 * Sets scrolling direction on node.
 *
 * This value is checked on first move, thus it should be called prior to
 * adding event listeners.
 */
declare function setTouchAction(node: EventTarget, value: string): void;



/**
 * Prevents the dispatch and default action of the given event name.
 */
declare function prevent(evName: string): void;



/**
 * Reset the 2500ms timeout on processing mouse input after detecting touch input.
 *
 * Touch inputs create synthesized mouse inputs anywhere from 0 to 2000ms after the touch.
 * This method should only be called during testing with simulated touch inputs.
 * Calling this method in production may cause duplicate taps or other Gestures.
 */
declare function resetMouseCanceller(): void;


interface GestureEvent extends Event {
    x: number;
    y: number;
    sourceEvent: Event;
}

interface DownEvent extends GestureEvent {
}

interface UpEvent extends GestureEvent {
}

interface TapEvent extends GestureEvent {
    model: any;
    detail: {
        sourceEvent: Event;
        x: number;
        y: number;
    }
}

interface TrackEvent extends GestureEvent {
    detail: TrackEventDetail;
}

interface TrackEventDetail {
    /**
         * state - a string indicating the tracking state:
         * - start - fired when tracking is first detected (finger/button down and moved past a pre-set distance threshold)
         * - track - fired while tracking
     * - end - fired when tracking ends
    */
    state: "start" | "track" | "end";
    /** clientX coordinate for event */
    dx: number;
    /** change in pixels vertically since the first track event */
    dy: number;
    /** change in pixels horizontally since last track event */
    ddx: number;
    /** change in pixels vertically since last track event */
    ddy: number;
    /** a function that may be called to determine the element currently being hovered */
    hover(): Element;
}

type gestures_d_DownEvent = DownEvent;
type gestures_d_GestureEvent = GestureEvent;
type gestures_d_TapEvent = TapEvent;
type gestures_d_TrackEvent = TrackEvent;
type gestures_d_TrackEventDetail = TrackEventDetail;
type gestures_d_UpEvent = UpEvent;
declare const gestures_d_addListener: typeof addListener;
declare const gestures_d_deepTargetFind: typeof deepTargetFind;
declare const gestures_d_prevent: typeof prevent;
declare const gestures_d_register: typeof register;
declare const gestures_d_removeListener: typeof removeListener;
declare const gestures_d_resetMouseCanceller: typeof resetMouseCanceller;
declare const gestures_d_setTouchAction: typeof setTouchAction;
declare namespace gestures_d {
  export { type gestures_d_DownEvent as DownEvent, type gestures_d_GestureEvent as GestureEvent, type gestures_d_TapEvent as TapEvent, type gestures_d_TrackEvent as TrackEvent, type gestures_d_TrackEventDetail as TrackEventDetail, type gestures_d_UpEvent as UpEvent, gestures_d_addListener as addListener, gestures_d_deepTargetFind as deepTargetFind, gestures_d_prevent as prevent, gestures_d_register as register, gestures_d_removeListener as removeListener, gestures_d_resetMouseCanceller as resetMouseCanceller, gestures_d_setTouchAction as setTouchAction };
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today



interface GestureEventListenersConstructor {
  new(...args: any[]): GestureEventListeners;
}



/**
 * Element class mixin that provides API for adding Polymer's cross-platform
 * gesture events to nodes.
 *
 * The API is designed to be compatible with override points implemented
 * in `TemplateStamp` such that declarative event listeners in
 * templates will support gesture events when this mixin is applied along with
 * `TemplateStamp`.
 */
declare function GestureEventListeners<T extends new (...args: any[]) => {}>(base: T): T & GestureEventListenersConstructor;

interface GestureEventListeners {

  /**
   * Add the event listener to the node if it is a gestures event.
   *
   * @param node Node to add event listener to
   * @param eventName Name of event
   * @param handler Listener function to add
   */
  _addEventListenerToNode(node: EventTarget, eventName: string, handler: (p0: Event) => void): void;

  /**
   * Remove the event listener to the node if it is a gestures event.
   *
   * @param node Node to remove event listener from
   * @param eventName Name of event
   * @param handler Listener function to remove
   */
  _removeEventListenerFromNode(node: EventTarget, eventName: string, handler: (p0: Event) => void): void;
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.



declare const DomBind_Base: typeof HTMLElement & GestureEventListenersConstructor & OptionalMutableDataConstructor & PropertyEffectsConstructor & TemplateStampConstructor & PropertyAccessorsConstructor & PropertiesChangedConstructor;

/**
 * Custom element to allow using Polymer's template features (data binding,
 * declarative event listeners, etc.) in the main document without defining
 * a new custom element.
 *
 * `<template>` tags utilizing bindings may be wrapped with the `<dom-bind>`
 * element, which will immediately stamp the wrapped template into the main
 * document and bind elements to the `dom-bind` element itself as the
 * binding scope.
 */
declare class DomBind extends DomBind_Base {

  /**
   * @param name Name of attribute that changed
   * @param old Old attribute value
   * @param value New attribute value
   * @param namespace Attribute namespace.
   */
  attributeChangedCallback(name: string, old: string|null, value: string|null, namespace: string|null): void;
  connectedCallback(): void;
  disconnectedCallback(): void;

  /**
   * Forces the element to render its content. This is typically only
   * necessary to call if HTMLImports with the async attribute are used.
   */
  render(): void;
}

declare global {

  interface HTMLElementTagNameMap {
    "dom-bind": DomBind;
  }
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.




/**
 * Forces several classes of asynchronously queued tasks to flush:
 * - Debouncers added via `enqueueDebouncer`
 * - ShadyDOM distribution
 */
declare function flush$1(): void;

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today



declare function showHideChildren(): void;

declare const TemplateInstanceBase_Base: typeof HTMLElement & PropertyEffectsConstructor & TemplateStampConstructor & PropertyAccessorsConstructor & PropertiesChangedConstructor;

declare class TemplateInstanceBase extends TemplateInstanceBase_Base {
  root: StampedTemplate;
  children: any;

  /**
   * Find the parent model of this template instance.  The parent model
   * is either another templatize instance that had option `parentModel: true`,
   * or else the host element.
   */
  readonly parentModel: PropertyEffects;
  _methodHost: PropertyEffects;

  /**
   * Override point for adding custom or simulated event handling.
   *
   * @param node Node to add event listener to
   * @param eventName Name of event
   * @param handler Listener function to add
   */
  _addEventListenerToNode(node: Node, eventName: string, handler: (p0: Event) => void): void;

  /**
   * Overrides default property-effects implementation to intercept
   * textContent bindings while children are "hidden" and cache in
   * private storage for later retrieval.
   *
   * @param node The node to set a property on
   * @param prop The property to set
   * @param value The value to set
   */
  _setUnmanagedPropertyToNode(node: Node, prop: string, value: any): void;

  /**
   * Forwards a host property to this instance.  This method should be
   * called on instances from the `options.forwardHostProp` callback
   * to propagate changes of host properties to each instance.
   *
   * Note this method enqueues the change, which are flushed as a batch.
   *
   * @param prop Property or path name
   * @param value Value of the property to forward
   */
  forwardHostProp(prop: string, value: any): void;

  /**
   * Shows or hides the template instance top level child elements. For
   * text nodes, `textContent` is removed while "hidden" and replaced when
   * "shown."
   *
   * @param hide Set to true to hide the children;
   * set to false to show them.
   */
  _showHideChildren(hide: boolean): void;

  /**
   * Stub of HTMLElement's `dispatchEvent`, so that effects that may
   * dispatch events safely no-op.
   *
   * @param event Event to dispatch
   * @returns Always true.
   */
  dispatchEvent(event: Event|null): boolean;
}


/**
 * Returns an anonymous `PropertyEffects` class bound to the
 * `<template>` provided.  Instancing the class will result in the
 * template being stamped into a document fragment stored as the instance's
 * `root` property, after which it can be appended to the DOM.
 *
 * Templates may utilize all Polymer data-binding features as well as
 * declarative event listeners.  Event listeners and inline computing
 * functions in the template will be called on the host of the template.
 *
 * The constructor returned takes a single argument dictionary of initial
 * property values to propagate into template bindings.  Additionally
 * host properties can be forwarded in, and instance properties can be
 * notified out by providing optional callbacks in the `options` dictionary.
 *
 * Valid configuration in `options` are as follows:
 *
 * - `forwardHostProp(property, value)`: Called when a property referenced
 *   in the template changed on the template's host. As this library does
 *   not retain references to templates instanced by the user, it is the
 *   templatize owner's responsibility to forward host property changes into
 *   user-stamped instances.  The `instance.forwardHostProp(property, value)`
 *    method on the generated class should be called to forward host
 *   properties into the template to prevent unnecessary property-changed
 *   notifications. Any properties referenced in the template that are not
 *   defined in `instanceProps` will be notified up to the template's host
 *   automatically.
 * - `instanceProps`: Dictionary of property names that will be added
 *   to the instance by the templatize owner.  These properties shadow any
 *   host properties, and changes within the template to these properties
 *   will result in `notifyInstanceProp` being called.
 * - `mutableData`: When `true`, the generated class will skip strict
 *   dirty-checking for objects and arrays (always consider them to be
 *   "dirty").
 * - `notifyInstanceProp(instance, property, value)`: Called when
 *   an instance property changes.  Users may choose to call `notifyPath`
 *   on e.g. the owner to notify the change.
 * - `parentModel`: When `true`, events handled by declarative event listeners
 *   (`on-event="handler"`) will be decorated with a `model` property pointing
 *   to the template instance that stamped it.  It will also be returned
 *   from `instance.parentModel` in cases where template instance nesting
 *   causes an inner model to shadow an outer model.
 *
 * All callbacks are called bound to the `owner`. Any context
 * needed for the callbacks (such as references to `instances` stamped)
 * should be stored on the `owner` such that they can be retrieved via
 * `this`.
 *
 * When `options.forwardHostProp` is declared as an option, any properties
 * referenced in the template will be automatically forwarded from the host of
 * the `<template>` to instances, with the exception of any properties listed in
 * the `options.instanceProps` object.  `instanceProps` are assumed to be
 * managed by the owner of the instances, either passed into the constructor
 * or set after the fact.  Note, any properties passed into the constructor will
 * always be set to the instance (regardless of whether they would normally
 * be forwarded from the host).
 *
 * Note that `templatize()` can be run only once for a given `<template>`.
 * Further calls will result in an error. Also, there is a special
 * behavior if the template was duplicated through a mechanism such as
 * `<dom-repeat>` or `<test-fixture>`. In this case, all calls to
 * `templatize()` return the same class for all duplicates of a template.
 * The class returned from `templatize()` is generated only once using
 * the `options` from the first call. This means that any `options`
 * provided to subsequent calls will be ignored. Therefore, it is very
 * important not to close over any variables inside the callbacks. Also,
 * arrow functions must be avoided because they bind the outer `this`.
 * Inside the callbacks, any contextual information can be accessed
 * through `this`, which points to the `owner`.
 *
 * @returns Generated class bound
 *   to the template provided
 */
declare function templatize(template: HTMLTemplateElement, owner?: PropertyEffects|null, options?: object|null): {new(p0?: object|null): TemplateInstanceBase};


/**
 * Returns the template "model" associated with a given element, which
 * serves as the binding scope for the template instance the element is
 * contained in. A template model is an instance of
 * `TemplateInstanceBase`, and should be used to manipulate data
 * associated with this template instance.
 *
 * Example:
 *
 *   let model = modelForElement(el);
 *   if (model.index < 10) {
 *     model.set('item.checked', true);
 *   }
 *
 * @returns Template instance representing the
 *   binding scope for the element
 */
declare function modelForElement(template: HTMLElement|null, node?: Node|null): TemplateInstanceBase|null;

type templatize_d_TemplateInstanceBase = TemplateInstanceBase;
declare const templatize_d_TemplateInstanceBase: typeof TemplateInstanceBase;
declare const templatize_d_modelForElement: typeof modelForElement;
declare const templatize_d_showHideChildren: typeof showHideChildren;
declare const templatize_d_templatize: typeof templatize;
declare namespace templatize_d {
  export { templatize_d_TemplateInstanceBase as TemplateInstanceBase, templatize_d_modelForElement as modelForElement, templatize_d_showHideChildren as showHideChildren, templatize_d_templatize as templatize };
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.



declare class DomIfBase extends PolymerElement {
  _templateInfo: TemplateInfo|undefined;

  /**
   * A boolean indicating whether this template should stamp.
   */
  if: boolean|null|undefined;

  /**
   * When true, elements will be removed from DOM and discarded when `if`
   * becomes false and re-created and added back to the DOM when `if`
   * becomes true.  By default, stamped elements will be hidden but left
   * in the DOM when `if` becomes false, which is generally results
   * in better performance.
   */
  restamp: boolean|null|undefined;

  /**
   * When the global `suppressTemplateNotifications` setting is used, setting
   * `notifyDomChange: true` will enable firing `dom-change` events on this
   * element.
   */
  notifyDomChange: boolean|null|undefined;
  connectedCallback(): void;
  disconnectedCallback(): void;

  /**
   * Forces the element to render its content. Normally rendering is
   * asynchronous to a provoking change. This is done for efficiency so
   * that multiple changes trigger only a single render. The render method
   * should be called if, for example, template rendering is required to
   * validate application state.
   */
  render(): void;

  /**
   * Abstract API to be implemented by subclass: Returns true if a template
   * instance has been created and inserted.
   *
   * @returns True when an instance has been created.
   */
  __hasInstance(): boolean;

  /**
   * Abstract API to be implemented by subclass: Returns the child nodes stamped
   * from a template instance.
   *
   * @returns Array of child nodes stamped from the template
   * instance.
   */
  __getInstanceNodes(): Array<Node|null>|null;

  /**
   * Abstract API to be implemented by subclass: Creates an instance of the
   * template and inserts it into the given parent node.
   *
   * @param parentNode The parent node to insert the instance into
   */
  __createAndInsertInstance(parentNode: Node|null): void;

  /**
   * Abstract API to be implemented by subclass: Removes nodes created by an
   * instance of a template and any associated cleanup.
   */
  __teardownInstance(): void;

  /**
   * Abstract API to be implemented by subclass: Shows or hides any template
   * instance childNodes based on the `if` state of the element and its
   * `__hideTemplateChildren__` property.
   */
  _showHideChildren(): void;
}

declare global {

  interface HTMLElementTagNameMap {
    "dom-if": DomIfBase;
  }
}

/**
 * The `<dom-if>` element will stamp a light-dom `<template>` child when
 * the `if` property becomes truthy, and the template can use Polymer
 * data-binding and declarative event features when used in the context of
 * a Polymer element's template.
 *
 * When `if` becomes falsy, the stamped content is hidden but not
 * removed from dom. When `if` subsequently becomes truthy again, the content
 * is simply re-shown. This approach is used due to its favorable performance
 * characteristics: the expense of creating template content is paid only
 * once and lazily.
 *
 * Set the `restamp` property to true to force the stamped content to be
 * created / destroyed when the `if` condition changes.
 */
declare class DomIf extends DomIfBase {
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today



declare const DomRepeat_Base: typeof PolymerElement & OptionalMutableDataConstructor;

/**
 * The `<dom-repeat>` element will automatically stamp and binds one instance
 * of template content to each object in a user-provided array.
 * `dom-repeat` accepts an `items` property, and one instance of the template
 * is stamped for each item into the DOM at the location of the `dom-repeat`
 * element.  The `item` property will be set on each instance's binding
 * scope, thus templates should bind to sub-properties of `item`.
 *
 * Example:
 *
 * ```html
 * <dom-module id="employee-list">
 *
 *   <template>
 *
 *     <div> Employee list: </div>
 *     <dom-repeat items="{{employees}}">
 *       <template>
 *         <div>First name: <span>{{item.first}}</span></div>
 *         <div>Last name: <span>{{item.last}}</span></div>
 *       </template>
 *     </dom-repeat>
 *
 *   </template>
 *
 * </dom-module>
 * ```
 *
 * With the following custom element definition:
 *
 * ```js
 * class EmployeeList extends PolymerElement {
 *   static get is() { return 'employee-list'; }
 *   static get properties() {
 *     return {
 *       employees: {
 *         value() {
 *           return [
 *             {first: 'Bob', last: 'Smith'},
 *             {first: 'Sally', last: 'Johnson'},
 *             ...
 *           ];
 *         }
 *       }
 *     };
 *   }
 * }
 * ```
 *
 * Notifications for changes to items sub-properties will be forwarded to template
 * instances, which will update via the normal structured data notification system.
 *
 * Mutations to the `items` array itself should be made using the Array
 * mutation API's on the PropertyEffects mixin (`push`, `pop`, `splice`,
 * `shift`, `unshift`), and template instances will be kept in sync with the
 * data in the array.
 *
 * Events caught by event handlers within the `dom-repeat` template will be
 * decorated with a `model` property, which represents the binding scope for
 * each template instance.  The model should be used to manipulate data on the
 * instance, for example `event.model.set('item.checked', true);`.
 *
 * Alternatively, the model for a template instance for an element stamped by
 * a `dom-repeat` can be obtained using the `modelForElement` API on the
 * `dom-repeat` that stamped it, for example
 * `this.$.domRepeat.modelForElement(event.target).set('item.checked', true);`.
 * This may be useful for manipulating instance data of event targets obtained
 * by event handlers on parents of the `dom-repeat` (event delegation).
 *
 * A view-specific filter/sort may be applied to each `dom-repeat` by supplying a
 * `filter` and/or `sort` property.  This may be a string that names a function on
 * the host, or a function may be assigned to the property directly.  The functions
 * should implemented following the standard `Array` filter/sort API.
 *
 * In order to re-run the filter or sort functions based on changes to sub-fields
 * of `items`, the `observe` property may be set as a space-separated list of
 * `item` sub-fields that should cause a re-filter/sort when modified.  If
 * the filter or sort function depends on properties not contained in `items`,
 * the user should observe changes to those properties and call `render` to update
 * the view based on the dependency change.
 *
 * For example, for an `dom-repeat` with a filter of the following:
 *
 * ```js
 * isEngineer(item) {
 *   return item.type == 'engineer' || item.manager.type == 'engineer';
 * }
 * ```
 *
 * Then the `observe` property should be configured as follows:
 *
 * ```html
 * <dom-repeat items="{{employees}}" filter="isEngineer" observe="type manager.type">
 * ```
 */
declare class DomRepeat extends DomRepeat_Base {
  _templateInfo: TemplateInfo|null;

  /**
   * An array containing items determining how many instances of the template
   * to stamp and that that each template instance should bind to.
   */
  items: any[]|null|undefined;

  /**
   * The name of the variable to add to the binding scope for the array
   * element associated with a given template instance.
   */
  as: string|null|undefined;

  /**
   * The name of the variable to add to the binding scope with the index
   * of the instance in the sorted and filtered list of rendered items.
   * Note, for the index in the `this.items` array, use the value of the
   * `itemsIndexAs` property.
   */
  indexAs: string|null|undefined;

  /**
   * The name of the variable to add to the binding scope with the index
   * of the instance in the `this.items` array. Note, for the index of
   * this instance in the sorted and filtered list of rendered items,
   * use the value of the `indexAs` property.
   */
  itemsIndexAs: string|null|undefined;

  /**
   * A function that should determine the sort order of the items.  This
   * property should either be provided as a string, indicating a method
   * name on the element's host, or else be an actual function.  The
   * function should match the sort function passed to `Array.sort`.
   * Using a sort function has no effect on the underlying `items` array.
   */
  sort: Function|null|undefined;

  /**
   * A function that can be used to filter items out of the view.  This
   * property should either be provided as a string, indicating a method
   * name on the element's host, or else be an actual function.  The
   * function should match the sort function passed to `Array.filter`.
   * Using a filter function has no effect on the underlying `items` array.
   */
  filter: Function|null|undefined;

  /**
   * When using a `filter` or `sort` function, the `observe` property
   * should be set to a space-separated list of the names of item
   * sub-fields that should trigger a re-sort or re-filter when changed.
   * These should generally be fields of `item` that the sort or filter
   * function depends on.
   */
  observe: string|null|undefined;

  /**
   * When using a `filter` or `sort` function, the `delay` property
   * determines a debounce time in ms after a change to observed item
   * properties that must pass before the filter or sort is re-run.
   * This is useful in rate-limiting shuffling of the view when
   * item changes may be frequent.
   */
  delay: number|null|undefined;

  /**
   * Count of currently rendered items after `filter` (if any) has been applied.
   * If "chunking mode" is enabled, `renderedItemCount` is updated each time a
   * set of template instances is rendered.
   */
  readonly renderedItemCount: number|null|undefined;

  /**
   * When greater than zero, defines an initial count of template instances
   * to render after setting the `items` array, before the next paint, and
   * puts the `dom-repeat` into "chunking mode".  The remaining items (and
   * any future items as a result of pushing onto the array) will be created
   * and rendered incrementally at each animation frame thereof until all
   * instances have been rendered.
   */
  initialCount: number|null|undefined;

  /**
   * When `initialCount` is used, this property defines a frame rate (in
   * fps) to target by throttling the number of instances rendered each
   * frame to not exceed the budget for the target frame rate.  The
   * framerate is effectively the number of `requestAnimationFrame`s that
   * it tries to allow to actually fire in a given second. It does this
   * by measuring the time between `rAF`s and continuously adjusting the
   * number of items created each `rAF` to maintain the target framerate.
   * Setting this to a higher number allows lower latency and higher
   * throughput for event handlers and other tasks, but results in a
   * longer time for the remaining items to complete rendering.
   */
  targetFramerate: number|null|undefined;
  readonly _targetFrameTime: number|null|undefined;

  /**
   * When the global `suppressTemplateNotifications` setting is used, setting
   * `notifyDomChange: true` will enable firing `dom-change` events on this
   * element.
   */
  notifyDomChange: boolean|null|undefined;

  /**
   * When chunking is enabled via `initialCount` and the `items` array is
   * set to a new array, this flag controls whether the previously rendered
   * instances are reused or not.
   *
   * When `true`, any previously rendered template instances are updated in
   * place to their new item values synchronously in one shot, and then any
   * further items (if any) are chunked out.  When `false`, the list is
   * returned back to its `initialCount` (any instances over the initial
   * count are discarded) and the remainder of the list is chunked back in.
   * Set this to `true` to avoid re-creating the list and losing scroll
   * position, although note that when changing the list to completely
   * different data the render thread will be blocked until all existing
   * instances are updated to their new data.
   */
  reuseChunkedInstances: boolean|null|undefined;
  connectedCallback(): void;
  disconnectedCallback(): void;

  /**
   * Forces the element to render its content. Normally rendering is
   * asynchronous to a provoking change. This is done for efficiency so
   * that multiple changes trigger only a single render. The render method
   * should be called if, for example, template rendering is required to
   * validate application state.
   */
  render(): void;

  /**
   * Shows or hides the template instance top level child elements. For
   * text nodes, `textContent` is removed while "hidden" and replaced when
   * "shown."
   *
   * @param hidden Set to true to hide the children;
   * set to false to show them.
   */
  _showHideChildren(hidden: boolean): void;

  /**
   * Returns the item associated with a given element stamped by
   * this `dom-repeat`.
   *
   * Note, to modify sub-properties of the item,
   * `modelForElement(el).set('item.<sub-prop>', value)`
   * should be used.
   *
   * @param el Element for which to return the item.
   * @returns Item associated with the element.
   */
  itemForElement(el: HTMLElement): any;

  /**
   * Returns the inst index for a given element stamped by this `dom-repeat`.
   * If `sort` is provided, the index will reflect the sorted order (rather
   * than the original array order).
   *
   * @param el Element for which to return the index.
   * @returns Row index associated with the element (note this may
   *   not correspond to the array index if a user `sort` is applied).
   */
  indexForElement(el: HTMLElement): number|null;

  /**
   * Returns the template "model" associated with a given element, which
   * serves as the binding scope for the template instance the element is
   * contained in. A template model
   * should be used to manipulate data associated with this template instance.
   *
   * Example:
   *
   *   let model = modelForElement(el);
   *   if (model.index < 10) {
   *     model.set('item.checked', true);
   *   }
   *
   * @param el Element for which to return a template model.
   * @returns Model representing the binding scope for
   *   the element.
   */
  modelForElement(el: HTMLElement): TemplateInstanceBase|null;
}

declare global {

  interface HTMLElementTagNameMap {
    "dom-repeat": DomRepeat;
  }
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today



interface DirMixinConstructor {
  new(...args: any[]): DirMixin;

  /**
   * @param cssText .
   * @param baseURI .
   * @returns .
   */
  _processStyleText(cssText: string, baseURI: string): string;

  /**
   * Replace `:dir` in the given CSS text
   *
   * @param text CSS text to replace DIR
   * @returns Modified CSS
   */
  _replaceDirInCssText(text: string): string;
}



/**
 * Element class mixin that allows elements to use the `:dir` CSS Selector to
 * have text direction specific styling.
 *
 * With this mixin, any stylesheet provided in the template will transform
 * `:dir` into `:host([dir])` and sync direction with the page via the
 * element's `dir` attribute.
 *
 * Elements can opt out of the global page text direction by setting the `dir`
 * attribute directly in `ready()` or in HTML.
 *
 * Caveats:
 * - Applications must set `<html dir="ltr">` or `<html dir="rtl">` to sync
 *   direction
 * - Automatic left-to-right or right-to-left styling is sync'd with the
 *   `<html>` element only.
 * - Changing `dir` at runtime is supported.
 * - Opting out of the global direction styling is permanent
 */
declare function DirMixin<T extends new (...args: any[]) => {}>(base: T): T & DirMixinConstructor & PropertyAccessorsConstructor & PropertiesChangedConstructor;

interface DirMixin extends PropertyAccessors, PropertiesChanged {
  ready(): void;
  connectedCallback(): void;
  disconnectedCallback(): void;
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today



/**
 * Class that listens for changes (additions or removals) to
 * "flattened nodes" on a given `node`. The list of flattened nodes consists
 * of a node's children and, for any children that are `<slot>` elements,
 * the expanded flattened list of `assignedNodes`.
 * For example, if the observed node has children `<a></a><slot></slot><b></b>`
 * and the `<slot>` has one `<div>` assigned to it, then the flattened
 * nodes list is `<a></a><div></div><b></b>`. If the `<slot>` has other
 * `<slot>` elements assigned to it, these are flattened as well.
 *
 * The provided `callback` is called whenever any change to this list
 * of flattened nodes occurs, where an addition or removal of a node is
 * considered a change. The `callback` is called with one argument, an object
 * containing an array of any `addedNodes` and `removedNodes`.
 *
 * Note: the callback is called asynchronous to any changes
 * at a microtask checkpoint. This is because observation is performed using
 * `MutationObserver` and the `<slot>` element's `slotchange` event which
 * are asynchronous.
 *
 * An example:
 * ```js
 * class TestSelfObserve extends PolymerElement {
 *   static get is() { return 'test-self-observe';}
 *   connectedCallback() {
 *     super.connectedCallback();
 *     this._observer = new FlattenedNodesObserver(this, (info) => {
 *       this.info = info;
 *     });
 *   }
 *   disconnectedCallback() {
 *     super.disconnectedCallback();
 *     this._observer.disconnect();
 *   }
 * }
 * customElements.define(TestSelfObserve.is, TestSelfObserve);
 * ```
 */
declare class FlattenedNodesObserver {

  /**
   * eslint-disable-next-line
   */
  constructor(target: any, callback: any);

  /**
   * eslint-disable-next-line
   */
  static getFlattenedNodes(node: any): any;

  /**
   * Activates an observer. This method is automatically called when
   * a `FlattenedNodesObserver` is created. It should only be called to
   * re-activate an observer that has been deactivated via the `disconnect` method.
   */
  connect(): void;

  /**
   * Deactivates the flattened nodes observer. After calling this method
   * the observer callback will not be called when changes to flattened nodes
   * occur. The `connect` method may be subsequently called to reactivate
   * the observer.
   */
  disconnect(): void;

  /**
   * Flushes the observer causing any pending changes to be immediately
   * delivered the observer callback. By default these changes are delivered
   * asynchronously at the next microtask checkpoint.
   *
   * @returns Returns true if any pending changes caused the observer
   * callback to run.
   */
  flush(): boolean;
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today



interface LegacyElementMixinConstructor {
  new(...args: any[]): LegacyElementMixin;
}



/**
 * Element class mixin that provides Polymer's "legacy" API intended to be
 * backward-compatible to the greatest extent possible with the API
 * found on the Polymer 1.x `Polymer.Base` prototype applied to all elements
 * defined using the `Polymer({...})` function.
 */
declare function LegacyElementMixin<T extends new (...args: any[]) => {}>(base: T): T & LegacyElementMixinConstructor & ElementMixinConstructor & PropertyEffectsConstructor & TemplateStampConstructor & PropertyAccessorsConstructor & PropertiesChangedConstructor & PropertiesMixinConstructor & GestureEventListenersConstructor & DirMixinConstructor;

interface LegacyElementMixin extends ElementMixin, PropertyEffects, TemplateStamp, PropertyAccessors, PropertiesChanged, PropertiesMixin, GestureEventListeners, DirMixin {
  isAttached: boolean;
  _debouncers: {[key: string]: Function|null}|null;
  _legacyForceObservedAttributes: boolean|undefined;

  /**
   * Return the element whose local dom within which this element
   * is contained. This is a shorthand for
   * `this.getRootNode().host`.
   */
  readonly domHost: Node|null;
  is: string;

  /**
   * Overrides the default `Polymer.PropertyEffects` implementation to
   * add support for installing `hostAttributes` and `listeners`.
   */
  ready(): void;

  /**
   * Overrides the default `Polymer.PropertyEffects` implementation to
   * add support for class initialization via the `_registered` callback.
   * This is called only when the first instance of the element is created.
   */
  _initializeProperties(): void;
  _enableProperties(): void;

  /**
   * Provides an override implementation of `attributeChangedCallback`
   * which adds the Polymer legacy API's `attributeChanged` method.
   *
   * @param name Name of attribute.
   * @param old Old value of attribute.
   * @param value Current value of attribute.
   * @param namespace Attribute namespace.
   */
  attributeChangedCallback(name: string, old: string|null, value: string|null, namespace: string|null): void;

  /**
   * Provides an implementation of `connectedCallback`
   * which adds Polymer legacy API's `attached` method.
   */
  connectedCallback(): void;

  /**
   * Provides an implementation of `disconnectedCallback`
   * which adds Polymer legacy API's `detached` method.
   */
  disconnectedCallback(): void;
  _canApplyPropertyDefault(property: any): any;

  /**
   * Legacy callback called during the `constructor`, for overriding
   * by the user.
   */
  created(): void;

  /**
   * Sets the value of an attribute.
   * @param name The name of the attribute to change.
   * @param value The new attribute value.
   */
  setAttribute(name: string, value: string): void;

  /**
   * Removes an attribute.
   *
   * @param name The name of the attribute to remove.
   */
  removeAttribute(name: string): void;

  /**
   * Legacy callback called during `connectedCallback`, for overriding
   * by the user.
   */
  attached(): void;

  /**
   * Legacy callback called during `disconnectedCallback`, for overriding
   * by the user.
   */
  detached(): void;

  /**
   * Legacy callback called during `attributeChangedChallback`, for overriding
   * by the user.
   *
   * @param name Name of attribute.
   * @param old Old value of attribute.
   * @param value Current value of attribute.
   */
  attributeChanged(name: string, old: string|null, value: string|null): void;
  _takeAttributes(): void;

  /**
   * Called automatically when an element is initializing.
   * Users may override this method to perform class registration time
   * work. The implementation should ensure the work is performed
   * only once for the class.
   */
  _registered(): void;

  /**
   * Ensures an element has required attributes. Called when the element
   * is being readied via `ready`. Users should override to set the
   * element's required attributes. The implementation should be sure
   * to check and not override existing attributes added by
   * the user of the element. Typically, setting attributes should be left
   * to the element user and not done here; reasonable exceptions include
   * setting aria roles and focusability.
   */
  _ensureAttributes(): void;

  /**
   * Adds element event listeners. Called when the element
   * is being readied via `ready`. Users should override to
   * add any required element event listeners.
   * In performance critical elements, the work done here should be kept
   * to a minimum since it is done before the element is rendered. In
   * these elements, consider adding listeners asynchronously so as not to
   * block render.
   */
  _applyListeners(): void;

  /**
   * Converts a typed JavaScript value to a string.
   *
   * Note this method is provided as backward-compatible legacy API
   * only.  It is not directly called by any Polymer features. To customize
   * how properties are serialized to attributes for attribute bindings and
   * `reflectToAttribute: true` properties as well as this method, override
   * the `_serializeValue` method provided by `Polymer.PropertyAccessors`.
   *
   * @param value Value to deserialize
   * @returns Serialized value
   */
  serialize(value: any): string|undefined;

  /**
   * Converts a string to a typed JavaScript value.
   *
   * Note this method is provided as backward-compatible legacy API
   * only.  It is not directly called by any Polymer features.  To customize
   * how attributes are deserialized to properties for in
   * `attributeChangedCallback`, override `_deserializeValue` method
   * provided by `Polymer.PropertyAccessors`.
   *
   * @param value String to deserialize
   * @param type Type to deserialize the string to
   * @returns Returns the deserialized value in the `type` given.
   */
  deserialize(value: string, type: any): any;

  /**
   * Serializes a property to its associated attribute.
   *
   * Note this method is provided as backward-compatible legacy API
   * only.  It is not directly called by any Polymer features.
   *
   * @param property Property name to reflect.
   * @param attribute Attribute name to reflect.
   * @param value Property value to reflect.
   */
  reflectPropertyToAttribute(property: string, attribute?: string, value?: any): void;

  /**
   * Sets a typed value to an HTML attribute on a node.
   *
   * Note this method is provided as backward-compatible legacy API
   * only.  It is not directly called by any Polymer features.
   *
   * @param value Value to serialize.
   * @param attribute Attribute name to serialize to.
   * @param node Element to set attribute to.
   */
  serializeValueToAttribute(value: any, attribute: string, node: Element|null): void;

  /**
   * Copies own properties (including accessor descriptors) from a source
   * object to a target object.
   *
   * @param prototype Target object to copy properties to.
   * @param api Source object to copy properties from.
   * @returns prototype object that was passed as first argument.
   */
  extend(prototype: object|null, api: object|null): object|null;

  /**
   * Copies props from a source object to a target object.
   *
   * Note, this method uses a simple `for...in` strategy for enumerating
   * properties.  To ensure only `ownProperties` are copied from source
   * to target and that accessor implementations are copied, use `extend`.
   *
   * @param target Target object to copy properties to.
   * @param source Source object to copy properties from.
   * @returns Target object that was passed as first argument.
   */
  mixin(target: object, source: object): object;

  /**
   * Sets the prototype of an object.
   *
   * Note this method is provided as backward-compatible legacy API
   * only.  It is not directly called by any Polymer features.
   *
   * @param object The object on which to set the prototype.
   * @param prototype The prototype that will be set on the given
   * `object`.
   * @returns Returns the given `object` with its prototype set
   * to the given `prototype` object.
   */
  chainObject(object: object|null, prototype: object|null): object|null;

  /**
   * Calls `importNode` on the `content` of the `template` specified and
   * returns a document fragment containing the imported content.
   *
   * @param template HTML template element to instance.
   * @returns Document fragment containing the imported
   *   template content.
   */
  instanceTemplate(template: HTMLTemplateElement|null): DocumentFragment;

  /**
   * Dispatches a custom event with an optional detail value.
   *
   * @param type Name of event type.
   * @param detail Detail value containing event-specific
   *   payload.
   * @param options Object specifying options.  These may include:
   *  `bubbles` (boolean, defaults to `true`),
   *  `cancelable` (boolean, defaults to false), and
   *  `node` on which to fire the event (HTMLElement, defaults to `this`).
   * @returns The new event that was fired.
   */
  fire(type: string, detail?: any, options?: {bubbles?: boolean, cancelable?: boolean, composed?: boolean}): Event;

  /**
   * Convenience method to add an event listener on a given element,
   * late bound to a named method on this element.
   *
   * @param node Element to add event listener to.
   * @param eventName Name of event to listen for.
   * @param methodName Name of handler method on `this` to call.
   */
  listen(node: EventTarget|null, eventName: string, methodName: string): void;

  /**
   * Convenience method to remove an event listener from a given element,
   * late bound to a named method on this element.
   *
   * @param node Element to remove event listener from.
   * @param eventName Name of event to stop listening to.
   * @param methodName Name of handler method on `this` to not call
   *      anymore.
   */
  unlisten(node: EventTarget|null, eventName: string, methodName: string): void;

  /**
   * Override scrolling behavior to all direction, one direction, or none.
   *
   * Valid scroll directions:
   *   - 'all': scroll in any direction
   *   - 'x': scroll only in the 'x' direction
   *   - 'y': scroll only in the 'y' direction
   *   - 'none': disable scrolling for this node
   *
   * @param direction Direction to allow scrolling
   * Defaults to `all`.
   * @param node Element to apply scroll direction setting.
   * Defaults to `this`.
   */
  setScrollDirection(direction?: string, node?: Element|null): void;

  /**
   * Convenience method to run `querySelector` on this local DOM scope.
   *
   * This function calls `Polymer.dom(this.root).querySelector(slctr)`.
   *
   * @param slctr Selector to run on this local DOM scope
   * @returns Element found by the selector, or null if not found.
   */
  $$(slctr: string): Element|null;

  /**
   * Force this element to distribute its children to its local dom.
   * This should not be necessary as of Polymer 2.0.2 and is provided only
   * for backwards compatibility.
   */
  distributeContent(): void;

  /**
   * Returns a list of nodes that are the effective childNodes. The effective
   * childNodes list is the same as the element's childNodes except that
   * any `<content>` elements are replaced with the list of nodes distributed
   * to the `<content>`, the result of its `getDistributedNodes` method.
   *
   * @returns List of effective child nodes.
   */
  getEffectiveChildNodes(): Node[];

  /**
   * Returns a list of nodes distributed within this element that match
   * `selector`. These can be dom children or elements distributed to
   * children that are insertion points.
   *
   * @param selector Selector to run.
   * @returns List of distributed elements that match selector.
   */
  queryDistributedElements(selector: string): Node[];

  /**
   * Returns a list of elements that are the effective children. The effective
   * children list is the same as the element's children except that
   * any `<content>` elements are replaced with the list of elements
   * distributed to the `<content>`.
   *
   * @returns List of effective children.
   */
  getEffectiveChildren(): Node[];

  /**
   * Returns a string of text content that is the concatenation of the
   * text content's of the element's effective childNodes (the elements
   * returned by <a href="#getEffectiveChildNodes>getEffectiveChildNodes</a>.
   *
   * @returns List of effective children.
   */
  getEffectiveTextContent(): string;

  /**
   * Returns the first effective childNode within this element that
   * match `selector`. These can be dom child nodes or elements distributed
   * to children that are insertion points.
   *
   * @param selector Selector to run.
   * @returns First effective child node that matches selector.
   */
  queryEffectiveChildren(selector: string): Node|null;

  /**
   * Returns a list of effective childNodes within this element that
   * match `selector`. These can be dom child nodes or elements distributed
   * to children that are insertion points.
   *
   * @param selector Selector to run.
   * @returns List of effective child nodes that match
   *     selector.
   */
  queryAllEffectiveChildren(selector: string): Node[];

  /**
   * Returns a list of nodes distributed to this element's `<slot>`.
   *
   * If this element contains more than one `<slot>` in its local DOM,
   * an optional selector may be passed to choose the desired content.
   *
   * @param slctr CSS selector to choose the desired
   *   `<slot>`.  Defaults to `content`.
   * @returns List of distributed nodes for the `<slot>`.
   */
  getContentChildNodes(slctr?: string): Node[];

  /**
   * Returns a list of element children distributed to this element's
   * `<slot>`.
   *
   * If this element contains more than one `<slot>` in its
   * local DOM, an optional selector may be passed to choose the desired
   * content.  This method differs from `getContentChildNodes` in that only
   * elements are returned.
   *
   * @param slctr CSS selector to choose the desired
   *   `<content>`.  Defaults to `content`.
   * @returns List of distributed nodes for the
   *   `<slot>`.
   */
  getContentChildren(slctr?: string): HTMLElement[];

  /**
   * Checks whether an element is in this element's light DOM tree.
   *
   * @param node The element to be checked.
   * @returns true if node is in this element's light DOM tree.
   */
  isLightDescendant(node: Node|null): boolean;

  /**
   * Checks whether an element is in this element's local DOM tree.
   *
   * @param node The element to be checked.
   * @returns true if node is in this element's local DOM tree.
   */
  isLocalDescendant(node: Element): boolean;

  /**
   * No-op for backwards compatibility. This should now be handled by
   * ShadyCss library.
   *
   * @param container Container element to scope
   * @param shouldObserve if true, start a mutation observer for added nodes to the container
   * @returns Returns a new MutationObserver on `container` if `shouldObserve` is true.
   */
  scopeSubtree(container: Element, shouldObserve?: boolean): MutationObserver|null;

  /**
   * Returns the computed style value for the given property.
   *
   * @param property The css property name.
   * @returns Returns the computed css property value for the given
   * `property`.
   */
  getComputedStyleValue(property: string): string;

  /**
   * Call `debounce` to collapse multiple requests for a named task into
   * one invocation which is made after the wait time has elapsed with
   * no new request.  If no wait time is given, the callback will be called
   * at microtask timing (guaranteed before paint).
   *
   *     debouncedClickAction(e) {
   *       // will not call `processClick` more than once per 100ms
   *       this.debounce('click', function() {
   *        this.processClick();
   *       } 100);
   *     }
   *
   * @param jobName String to identify the debounce job.
   * @param callback Function that is called (with `this`
   *   context) when the wait time elapses.
   * @param wait Optional wait time in milliseconds (ms) after the
   *   last signal that must elapse before invoking `callback`
   * @returns Returns a debouncer object on which exists the
   * following methods: `isActive()` returns true if the debouncer is
   * active; `cancel()` cancels the debouncer if it is active;
   * `flush()` immediately invokes the debounced callback if the debouncer
   * is active.
   */
  debounce(jobName: string, callback: () => void, wait?: number): object;

  /**
   * Returns whether a named debouncer is active.
   *
   * @param jobName The name of the debouncer started with `debounce`
   * @returns Whether the debouncer is active (has not yet fired).
   */
  isDebouncerActive(jobName: string): boolean;

  /**
   * Immediately calls the debouncer `callback` and inactivates it.
   *
   * @param jobName The name of the debouncer started with `debounce`
   */
  flushDebouncer(jobName: string): void;

  /**
   * Cancels an active debouncer.  The `callback` will not be called.
   *
   * @param jobName The name of the debouncer started with `debounce`
   */
  cancelDebouncer(jobName: string): void;

  /**
   * Runs a callback function asynchronously.
   *
   * By default (if no waitTime is specified), async callbacks are run at
   * microtask timing, which will occur before paint.
   *
   * @param callback The callback function to run, bound to
   *     `this`.
   * @param waitTime Time to wait before calling the
   *   `callback`.  If unspecified or 0, the callback will be run at microtask
   *   timing (before paint).
   * @returns Handle that may be used to cancel the async job.
   */
  async(callback: Function, waitTime?: number): number;

  /**
   * Cancels an async operation started with `async`.
   *
   * @param handle Handle returned from original `async` call to
   *   cancel.
   */
  cancelAsync(handle: number): void;

  /**
   * Convenience method for creating an element and configuring it.
   *
   * @param tag HTML element tag to create.
   * @param props Object of properties to configure on the
   *    instance.
   * @returns Newly created and configured element.
   */
  create(tag: string, props?: object|null): Element;

  /**
   * Polyfill for Element.prototype.matches, which is sometimes still
   * prefixed.
   *
   * @param selector Selector to test.
   * @param node Element to test the selector against.
   * @returns Whether the element matches the selector.
   */
  elementMatches(selector: string, node?: Element): boolean;

  /**
   * Toggles an HTML attribute on or off.
   *
   * @param name HTML attribute name
   * @param bool Boolean to force the attribute on or off.
   *    When unspecified, the state of the attribute will be reversed.
   * @returns true if the attribute now exists
   */
  toggleAttribute(name: string, bool?: boolean): boolean;

  /**
   * Toggles a CSS class on or off.
   *
   * @param name CSS class name
   * @param bool Boolean to force the class on or off.
   *    When unspecified, the state of the class will be reversed.
   * @param node Node to target.  Defaults to `this`.
   */
  toggleClass(name: string, bool?: boolean, node?: Element|null): void;

  /**
   * Cross-platform helper for setting an element's CSS `transform` property.
   *
   * @param transformText Transform setting.
   * @param node Element to apply the transform to.
   * Defaults to `this`
   */
  transform(transformText: string, node?: Element|null): void;

  /**
   * Cross-platform helper for setting an element's CSS `translate3d`
   * property.
   *
   * @param x X offset.
   * @param y Y offset.
   * @param z Z offset.
   * @param node Element to apply the transform to.
   * Defaults to `this`.
   */
  translate3d(x: number|string, y: number|string, z: number|string, node?: Element|null): void;

  /**
   * Removes an item from an array, if it exists.
   *
   * If the array is specified by path, a change notification is
   * generated, so that observers, data bindings and computed
   * properties watching that path can update.
   *
   * If the array is passed directly, **no change
   * notification is generated**.
   *
   * @param arrayOrPath Path to array from
   *     which to remove the item
   *   (or the array itself).
   * @param item Item to remove.
   * @returns Array containing item removed.
   */
  arrayDelete(arrayOrPath: string|Array<number|string>, item: any): any[]|null;

  /**
   * Facades `console.log`/`warn`/`error` as override point.
   *
   * @param level One of 'log', 'warn', 'error'
   * @param args Array of strings or objects to log
   */
  _logger(level: string, args: any[]|null): void;

  /**
   * Facades `console.log` as an override point.
   *
   * @param args Array of strings or objects to log
   */
  _log(...args: any[]): void;

  /**
   * Facades `console.warn` as an override point.
   *
   * @param args Array of strings or objects to log
   */
  _warn(...args: any[]): void;

  /**
   * Facades `console.error` as an override point.
   *
   * @param args Array of strings or objects to log
   */
  _error(...args: any[]): void;

  /**
   * Formats a message using the element type an a method name.
   *
   * @param methodName Method name to associate with message
   * @param args Array of strings or objects to log
   * @returns Array with formatting information for `console`
   *   logging.
   */
  _logf(methodName: string, ...args: any[]): any[];
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today




/**
 * Applies a "legacy" behavior or array of behaviors to the provided class.
 *
 * Note: this method will automatically also apply the `LegacyElementMixin`
 * to ensure that any legacy behaviors can rely on legacy Polymer API on
 * the underlying element.
 *
 * @returns Returns a new Element class extended by the
 * passed in `behaviors` and also by `LegacyElementMixin`.
 */
declare function mixinBehaviors<T>(behaviors: object|object[], klass: {new(): T}): {new(): T};

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today




/**
 * Sets the global rootPath property used by `ElementMixin` and
 * available via `rootPath`.
 */
declare function setRootPath(path: string): void;


type SanitizeDOMValueFunction =
    (value: unknown, name: string, type: 'property'|'attribute',
     node: Node|null|undefined) => unknown;



/**
 * Sets the global sanitizeDOMValue available via this module's exported
 * `sanitizeDOMValue` variable.
 */
declare function setSanitizeDOMValue(newSanitizeDOMValue: SanitizeDOMValueFunction|undefined): void;



/**
 * Gets sanitizeDOMValue, for environments that don't well support `export let`.
 *
 * @returns sanitizeDOMValue
 */
declare function getSanitizeDOMValue(): SanitizeDOMValueFunction|undefined;



/**
 * Sets `passiveTouchGestures` globally for all elements using Polymer Gestures.
 */
declare function setPassiveTouchGestures(usePassive: boolean): void;



/**
 * Sets `strictTemplatePolicy` globally for all elements
 */
declare function setStrictTemplatePolicy(useStrictPolicy: boolean): void;



/**
 * Sets `lookupTemplateFromDomModule` globally for all elements
 */
declare function setAllowTemplateFromDomModule(allowDomModule: boolean): void;



/**
 * Sets `legacyOptimizations` globally for all elements to enable optimizations
 * when only legacy based elements are used.
 */
declare function setLegacyOptimizations(useLegacyOptimizations: boolean): void;



/**
 * Sets `legacyWarnings` globally for all elements to migration warnings.
 */
declare function setLegacyWarnings(useLegacyWarnings: boolean): void;



/**
 * Sets `syncInitialRender` globally for all elements to enable synchronous
 * initial rendering.
 */
declare function setSyncInitialRender(useSyncInitialRender: boolean): void;



/**
 * Sets `legacyUndefined` globally for all elements to enable legacy
 * multi-property behavior for undefined values.
 */
declare function setLegacyUndefined(useLegacyUndefined: boolean): void;



/**
 * Sets `orderedComputed` globally for all elements to enable ordered computed
 * property computation.
 */
declare function setOrderedComputed(useOrderedComputed: boolean): void;



/**
 * Sets `setCancelSyntheticEvents` globally for all elements to cancel synthetic click events.
 */
declare function setCancelSyntheticClickEvents(useCancelSyntheticClickEvents: boolean): void;



/**
 * Sets `removeNestedTemplates` globally, to eliminate nested templates
 * inside `dom-if` and `dom-repeat` as part of template parsing.
 */
declare function setRemoveNestedTemplates(useRemoveNestedTemplates: boolean): void;



/**
 * Sets `fastDomIf` globally, to put `dom-if` in a performance-optimized mode.
 */
declare function setFastDomIf(useFastDomIf: boolean): void;



/**
 * Sets `suppressTemplateNotifications` globally, to disable `dom-change` and
 * `rendered-item-count` events from `dom-if` and `dom-repeat`.
 */
declare function setSuppressTemplateNotifications(suppress: boolean): void;



/**
 * Sets `legacyNoObservedAttributes` globally, to disable `observedAttributes`.
 */
declare function setLegacyNoObservedAttributes(noObservedAttributes: boolean): void;



/**
 * Sets `useAdoptedStyleSheetsWithBuiltCSS` globally.
 */
declare function setUseAdoptedStyleSheetsWithBuiltCSS(value: boolean): void;

declare const useShadow: boolean;
declare const useNativeCSSProperties: boolean;
declare const useNativeCustomElements: boolean;
declare const supportsAdoptingStyleSheets: boolean;
declare let legacyOptimizations: boolean;

type settings_d_SanitizeDOMValueFunction = SanitizeDOMValueFunction;
declare const settings_d_getSanitizeDOMValue: typeof getSanitizeDOMValue;
declare const settings_d_legacyOptimizations: typeof legacyOptimizations;
declare const settings_d_setAllowTemplateFromDomModule: typeof setAllowTemplateFromDomModule;
declare const settings_d_setCancelSyntheticClickEvents: typeof setCancelSyntheticClickEvents;
declare const settings_d_setFastDomIf: typeof setFastDomIf;
declare const settings_d_setLegacyNoObservedAttributes: typeof setLegacyNoObservedAttributes;
declare const settings_d_setLegacyOptimizations: typeof setLegacyOptimizations;
declare const settings_d_setLegacyUndefined: typeof setLegacyUndefined;
declare const settings_d_setLegacyWarnings: typeof setLegacyWarnings;
declare const settings_d_setOrderedComputed: typeof setOrderedComputed;
declare const settings_d_setPassiveTouchGestures: typeof setPassiveTouchGestures;
declare const settings_d_setRemoveNestedTemplates: typeof setRemoveNestedTemplates;
declare const settings_d_setRootPath: typeof setRootPath;
declare const settings_d_setSanitizeDOMValue: typeof setSanitizeDOMValue;
declare const settings_d_setStrictTemplatePolicy: typeof setStrictTemplatePolicy;
declare const settings_d_setSuppressTemplateNotifications: typeof setSuppressTemplateNotifications;
declare const settings_d_setSyncInitialRender: typeof setSyncInitialRender;
declare const settings_d_setUseAdoptedStyleSheetsWithBuiltCSS: typeof setUseAdoptedStyleSheetsWithBuiltCSS;
declare const settings_d_supportsAdoptingStyleSheets: typeof supportsAdoptingStyleSheets;
declare const settings_d_useNativeCSSProperties: typeof useNativeCSSProperties;
declare const settings_d_useNativeCustomElements: typeof useNativeCustomElements;
declare const settings_d_useShadow: typeof useShadow;
declare namespace settings_d {
  export { type settings_d_SanitizeDOMValueFunction as SanitizeDOMValueFunction, settings_d_getSanitizeDOMValue as getSanitizeDOMValue, settings_d_legacyOptimizations as legacyOptimizations, settings_d_setAllowTemplateFromDomModule as setAllowTemplateFromDomModule, settings_d_setCancelSyntheticClickEvents as setCancelSyntheticClickEvents, settings_d_setFastDomIf as setFastDomIf, settings_d_setLegacyNoObservedAttributes as setLegacyNoObservedAttributes, settings_d_setLegacyOptimizations as setLegacyOptimizations, settings_d_setLegacyUndefined as setLegacyUndefined, settings_d_setLegacyWarnings as setLegacyWarnings, settings_d_setOrderedComputed as setOrderedComputed, settings_d_setPassiveTouchGestures as setPassiveTouchGestures, settings_d_setRemoveNestedTemplates as setRemoveNestedTemplates, settings_d_setRootPath as setRootPath, settings_d_setSanitizeDOMValue as setSanitizeDOMValue, settings_d_setStrictTemplatePolicy as setStrictTemplatePolicy, settings_d_setSuppressTemplateNotifications as setSuppressTemplateNotifications, settings_d_setSyncInitialRender as setSyncInitialRender, settings_d_setUseAdoptedStyleSheetsWithBuiltCSS as setUseAdoptedStyleSheetsWithBuiltCSS, settings_d_supportsAdoptingStyleSheets as supportsAdoptingStyleSheets, settings_d_useNativeCSSProperties as useNativeCSSProperties, settings_d_useNativeCustomElements as useNativeCustomElements, settings_d_useShadow as useShadow };
}

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today




/**
 * Flushes all `beforeNextRender` tasks, followed by all `afterNextRender`
 * tasks.
 */
declare function flush(): void;



/**
 * Enqueues a callback which will be run before the next render, at
 * `requestAnimationFrame` timing.
 *
 * This method is useful for enqueuing work that requires DOM measurement,
 * since measurement may not be reliable in custom element callbacks before
 * the first render, as well as for batching measurement tasks in general.
 *
 * Tasks in this queue may be flushed by calling `flush()`.
 */
declare function beforeNextRender(context: any, callback: (...p0: any[]) => void, args?: any[]): void;



/**
 * Enqueues a callback which will be run after the next render, equivalent
 * to one task (`setTimeout`) after the next `requestAnimationFrame`.
 *
 * This method is useful for tuning the first-render performance of an
 * element or application by deferring non-critical work until after the
 * first paint.  Typical non-render-critical work may include adding UI
 * event listeners and aria attributes.
 */
declare function afterNextRender(context: any, callback: (...p0: any[]) => void, args?: any[]): void;

declare const renderStatus_d_afterNextRender: typeof afterNextRender;
declare const renderStatus_d_beforeNextRender: typeof beforeNextRender;
declare const renderStatus_d_flush: typeof flush;
declare namespace renderStatus_d {
  export { renderStatus_d_afterNextRender as afterNextRender, renderStatus_d_beforeNextRender as beforeNextRender, renderStatus_d_flush as flush };
}

/**
 * DO NOT EDIT
 *
 * This file was automatically generated by
 *   https://github.com/Polymer/tools/tree/master/packages/gen-typescript-declarations
 *
 * To modify these typings, edit the source file(s):
 *   iron-fit-behavior.js
 */



/**
 * `Polymer.IronFitBehavior` fits an element in another element using `max-height`
 * and `max-width`, and optionally centers it in the window or another element.
 *
 * The element will only be sized and/or positioned if it has not already been
 * sized and/or positioned by CSS.
 *
 * CSS properties            | Action
 * --------------------------|-------------------------------------------
 * `position` set            | Element is not centered horizontally or vertically
 * `top` or `bottom` set     | Element is not vertically centered
 * `left` or `right` set     | Element is not horizontally centered
 * `max-height` set          | Element respects `max-height`
 * `max-width` set           | Element respects `max-width`
 *
 * `Polymer.IronFitBehavior` can position an element into another element using
 * `verticalAlign` and `horizontalAlign`. This will override the element's css
 * position.
 *
 *     <div class="container">
 *       <iron-fit-impl vertical-align="top" horizontal-align="auto">
 *         Positioned into the container
 *       </iron-fit-impl>
 *     </div>
 *
 * Use `noOverlap` to position the element around another element without
 * overlapping it.
 *
 *     <div class="container">
 *       <iron-fit-impl no-overlap vertical-align="auto" horizontal-align="auto">
 *         Positioned around the container
 *       </iron-fit-impl>
 *     </div>
 *
 * Use `horizontalOffset, verticalOffset` to offset the element from its
 * `positionTarget`; `Polymer.IronFitBehavior` will collapse these in order to
 * keep the element within `fitInto` boundaries, while preserving the element's
 * CSS margin values.
 *
 *     <div class="container">
 *       <iron-fit-impl vertical-align="top" vertical-offset="20">
 *         With vertical offset
 *       </iron-fit-impl>
 *     </div>
 */
interface IronFitBehavior {

  /**
   * The element that will receive a `max-height`/`width`. By default it is
   * the same as `this`, but it can be set to a child element. This is useful,
   * for example, for implementing a scrolling region inside the element.
   */
  sizingTarget: Element;

  /**
   * The element to fit `this` into.
   */
  fitInto: object|null|undefined;

  /**
   * Will position the element around the positionTarget without overlapping
   * it.
   */
  noOverlap: boolean|null|undefined;

  /**
   * The element that should be used to position the element. If not set, it
   * will default to the parent node.
   */
  positionTarget: Element;

  /**
   * The orientation against which to align the element horizontally
   * relative to the `positionTarget`. Possible values are "left", "right",
   * "center", "auto".
   */
  horizontalAlign: string|null|undefined;

  /**
   * The orientation against which to align the element vertically
   * relative to the `positionTarget`. Possible values are "top", "bottom",
   * "middle", "auto".
   */
  verticalAlign: string|null|undefined;

  /**
   * If true, it will use `horizontalAlign` and `verticalAlign` values as
   * preferred alignment and if there's not enough space, it will pick the
   * values which minimize the cropping.
   */
  dynamicAlign: boolean|null|undefined;

  /**
   * A pixel value that will be added to the position calculated for the
   * given `horizontalAlign`, in the direction of alignment. You can think
   * of it as increasing or decreasing the distance to the side of the
   * screen given by `horizontalAlign`.
   *
   * If `horizontalAlign` is "left" or "center", this offset will increase or
   * decrease the distance to the left side of the screen: a negative offset
   * will move the dropdown to the left; a positive one, to the right.
   *
   * Conversely if `horizontalAlign` is "right", this offset will increase
   * or decrease the distance to the right side of the screen: a negative
   * offset will move the dropdown to the right; a positive one, to the left.
   */
  horizontalOffset: number|null|undefined;

  /**
   * A pixel value that will be added to the position calculated for the
   * given `verticalAlign`, in the direction of alignment. You can think
   * of it as increasing or decreasing the distance to the side of the
   * screen given by `verticalAlign`.
   *
   * If `verticalAlign` is "top" or "middle", this offset will increase or
   * decrease the distance to the top side of the screen: a negative offset
   * will move the dropdown upwards; a positive one, downwards.
   *
   * Conversely if `verticalAlign` is "bottom", this offset will increase
   * or decrease the distance to the bottom side of the screen: a negative
   * offset will move the dropdown downwards; a positive one, upwards.
   */
  verticalOffset: number|null|undefined;

  /**
   * Set to true to auto-fit on attach.
   */
  autoFitOnAttach: boolean|null|undefined;

  /**
   * If true and scrollbars are added to `sizingTarget` after it is
   * positioned, the size of the added scrollbars will be added to its
   * `maxWidth` and `maxHeight`.
   */
  expandSizingTargetForScrollbars: boolean|null|undefined;
  _fitInfo: object|null;
  readonly _fitWidth: any;
  readonly _fitHeight: any;
  readonly _fitLeft: any;
  readonly _fitTop: any;

  /**
   * The element that should be used to position the element,
   * if no position target is configured.
   *    
   */
  readonly _defaultPositionTarget: any;

  /**
   * The horizontal align value, accounting for the RTL/LTR text direction.
   *    
   */
  readonly _localeHorizontalAlign: any;
  attached(): void;
  detached(): void;

  /**
   * Positions and fits the element into the `fitInto` element.
   */
  fit(): void;

  /**
   * Memoize information needed to position and size the target element.
   */
  _discoverInfo(): void;

  /**
   * Resets the target element's position and size constraints, and clear
   * the memoized data.
   */
  resetFit(): void;

  /**
   * Equivalent to calling `resetFit()` and `fit()`. Useful to call this after
   * the element or the `fitInto` element has been resized, or if any of the
   * positioning properties (e.g. `horizontalAlign, verticalAlign`) is updated.
   * It preserves the scroll position of the sizingTarget.
   */
  refit(): void;

  /**
   * Positions the element according to `horizontalAlign, verticalAlign`.
   */
  position(): void;

  /**
   * Constrains the size of the element to `fitInto` by setting `max-height`
   * and/or `max-width`.
   */
  constrain(): void;
  _sizeDimension(rect: any, positionedBy: any, start: any, end: any, extent: any): void;

  /**
   * Centers horizontally and vertically if not already positioned. This also
   * sets `position:fixed`.
   */
  center(): void;
}

declare const IronFitBehavior: object;

/**
 * DO NOT EDIT
 *
 * This file was automatically generated by
 *   https://github.com/Polymer/tools/tree/master/packages/gen-typescript-declarations
 *
 * To modify these typings, edit the source file(s):
 *   iron-resizable-behavior.js
 */



/**
 * `IronResizableBehavior` is a behavior that can be used in Polymer elements to
 * coordinate the flow of resize events between "resizers" (elements that
 * control the size or hidden state of their children) and "resizables" (elements
 * that need to be notified when they are resized or un-hidden by their parents
 * in order to take action on their new measurements).
 *
 * Elements that perform measurement should add the `IronResizableBehavior`
 * behavior to their element definition and listen for the `iron-resize` event on
 * themselves. This event will be fired when they become showing after having
 * been hidden, when they are resized explicitly by another resizable, or when
 * the window has been resized.
 *
 * Note, the `iron-resize` event is non-bubbling.
 */
interface IronResizableBehavior {

  /**
   * The closest ancestor element that implements `IronResizableBehavior`.
   */
  _parentResizable: object|null|undefined;

  /**
   * True if this element is currently notifying its descendant elements of
   * resize.
   */
  _notifyingDescendant: boolean|null|undefined;
  created(): void;
  attached(): void;
  detached(): void;

  /**
   * Can be called to manually notify a resizable and its descendant
   * resizables of a resize change.
   */
  notifyResize(): void;

  /**
   * Used to assign the closest resizable ancestor to this resizable
   * if the ancestor detects a request for notifications.
   */
  assignParentResizable(parentResizable: any): void;

  /**
   * Used to remove a resizable descendant from the list of descendants
   * that should be notified of a resize change.
   */
  stopResizeNotificationsFor(target: any): void;

  /**
   * Subscribe this element to listen to iron-resize events on the given target.
   *
   * Preferred over target.listen because the property renamer does not
   * understand to rename when the target is not specifically "this"
   *
   * @param target Element to listen to for iron-resize events.
   */
  _subscribeIronResize(target: HTMLElement): void;

  /**
   * Unsubscribe this element from listening to to iron-resize events on the
   * given target.
   *
   * Preferred over target.unlisten because the property renamer does not
   * understand to rename when the target is not specifically "this"
   *
   * @param target Element to listen to for iron-resize events.
   */
  _unsubscribeIronResize(target: HTMLElement): void;

  /**
   * This method can be overridden to filter nested elements that should or
   * should not be notified by the current element. Return true if an element
   * should be notified, or false if it should not be notified.
   *
   * @param element A candidate descendant element that
   * implements `IronResizableBehavior`.
   * @returns True if the `element` should be notified of resize.
   */
  resizerShouldNotify(element: HTMLElement|null): boolean;
  _onDescendantIronResize(event: any): void;
  _fireResize(): void;
  _onIronRequestResizeNotifications(event: any): void;
  _parentResizableChanged(parentResizable: any): void;
  _notifyDescendant(descendant: any): void;
  _requestResizeNotifications(): void;
  _findParent(): void;
}

declare const IronResizableBehavior: object;

/**
 * DO NOT EDIT
 *
 * This file was automatically generated by
 *   https://github.com/Polymer/tools/tree/master/packages/gen-typescript-declarations
 *
 * To modify these typings, edit the source file(s):
 *   iron-a11y-keys-behavior.js
 */



/**
 * `Polymer.IronA11yKeysBehavior` provides a normalized interface for processing
 * keyboard commands that pertain to [WAI-ARIA best
 * practices](http://www.w3.org/TR/wai-aria-practices/#kbd_general_binding). The
 * element takes care of browser differences with respect to Keyboard events and
 * uses an expressive syntax to filter key presses.
 *
 * Use the `keyBindings` prototype property to express what combination of keys
 * will trigger the callback. A key binding has the format
 * `"KEY+MODIFIER:EVENT": "callback"` (`"KEY": "callback"` or
 * `"KEY:EVENT": "callback"` are valid as well). Some examples:
 *
 *      keyBindings: {
 *        'space': '_onKeydown', // same as 'space:keydown'
 *        'shift+tab': '_onKeydown',
 *        'enter:keypress': '_onKeypress',
 *        'esc:keyup': '_onKeyup'
 *      }
 *
 * The callback will receive with an event containing the following information
 * in `event.detail`:
 *
 *      _onKeydown: function(event) {
 *        console.log(event.detail.combo); // KEY+MODIFIER, e.g. "shift+tab"
 *        console.log(event.detail.key); // KEY only, e.g. "tab"
 *        console.log(event.detail.event); // EVENT, e.g. "keydown"
 *        console.log(event.detail.keyboardEvent); // the original KeyboardEvent
 *      }
 *
 * Use the `keyEventTarget` attribute to set up event handlers on a specific
 * node.
 *
 * See the [demo source
 * code](https://github.com/PolymerElements/iron-a11y-keys-behavior/blob/master/demo/x-key-aware.html)
 * for an example.
 */
interface IronA11yKeysBehavior {

  /**
   * The EventTarget that will be firing relevant KeyboardEvents. Set it to
   * `null` to disable the listeners.
   */
  keyEventTarget: EventTarget|null;

  /**
   * If true, this property will cause the implementing element to
   * automatically stop propagation on any handled KeyboardEvents.
   */
  stopKeyboardEventPropagation: boolean|null|undefined;
  _boundKeyHandlers: any[]|null|undefined;

  /**
   * own properties of everything on the "prototype".
   */
  _imperativeKeyBindings: object|null|undefined;

  /**
   * To be used to express what combination of keys  will trigger the relative
   * callback. e.g. `keyBindings: { 'esc': '_onEscPressed'}`
   */
  keyBindings: object;
  registered(): void;
  attached(): void;
  detached(): void;

  /**
   * Can be used to imperatively add a key binding to the implementing
   * element. This is the imperative equivalent of declaring a keybinding
   * in the `keyBindings` prototype property.
   */
  addOwnKeyBinding(eventString: string, handlerName: string): void;

  /**
   * When called, will remove all imperatively-added key bindings.
   */
  removeOwnKeyBindings(): void;

  /**
   * Returns true if a keyboard event matches `eventString`.
   */
  keyboardEventMatchesKeys(event: KeyboardEvent|null, eventString: string): boolean;
  _collectKeyBindings(): any;
  _prepKeyBindings(): void;
  _addKeyBinding(eventString: any, handlerName: any): void;
  _resetKeyEventListeners(): void;
  _listenKeyEventListeners(): void;
  _unlistenKeyEventListeners(): void;
  _onKeyBindingEvent(keyBindings: any, event: any): void;
  _triggerKeyHandler(keyCombo: any, handlerName: any, keyboardEvent: any): void;
}

declare const IronA11yKeysBehavior: object;

/**
 * DO NOT EDIT
 *
 * This file was automatically generated by
 *   https://github.com/Polymer/tools/tree/master/packages/gen-typescript-declarations
 *
 * To modify these typings, edit the source file(s):
 *   iron-overlay-behavior.js
 */



interface IronOverlayBehaviorImpl {

  /**
   * True if the overlay is currently displayed.
   */
  opened: boolean|null|undefined;

  /**
   * True if the overlay was canceled when it was last closed.
   */
  readonly canceled: boolean|null|undefined;

  /**
   * Set to true to display a backdrop behind the overlay. It traps the focus
   * within the light DOM of the overlay.
   */
  withBackdrop: boolean|null|undefined;

  /**
   * Set to true to disable auto-focusing the overlay or child nodes with
   * the `autofocus` attribute` when the overlay is opened.
   */
  noAutoFocus: boolean|null|undefined;

  /**
   * Set to true to disable canceling the overlay with the ESC key.
   */
  noCancelOnEscKey: boolean|null|undefined;

  /**
   * Set to true to disable canceling the overlay by clicking outside it.
   */
  noCancelOnOutsideClick: boolean|null|undefined;

  /**
   * Contains the reason(s) this overlay was last closed (see
   * `iron-overlay-closed`). `IronOverlayBehavior` provides the `canceled`
   * reason; implementers of the behavior can provide other reasons in
   * addition to `canceled`.
   */
  closingReason: object|null|undefined;

  /**
   * Set to true to enable restoring of focus when overlay is closed.
   */
  restoreFocusOnClose: boolean|null|undefined;

  /**
   * Set to true to allow clicks to go through overlays.
   * When the user clicks outside this overlay, the click may
   * close the overlay below.
   */
  allowClickThrough: boolean|null|undefined;

  /**
   * Set to true to keep overlay always on top.
   */
  alwaysOnTop: boolean|null|undefined;

  /**
   * Determines which action to perform when scroll outside an opened overlay
   * happens. Possible values: lock - blocks scrolling from happening, refit -
   * computes the new position on the overlay cancel - causes the overlay to
   * close
   */
  scrollAction: string|null|undefined;

  /**
   * The node being focused.
   */
  _focusedChild: Node|null;

  /**
   * The backdrop element.
   */
  readonly backdropElement: Element;

  /**
   * Returns the node to give focus to.
   */
  readonly _focusNode: Node;

  /**
   * Array of nodes that can receive focus (overlay included), ordered by
   * `tabindex`. This is used to retrieve which is the first and last focusable
   * nodes in order to wrap the focus for overlays `with-backdrop`.
   *
   * If you know what is your content (specifically the first and last focusable
   * children), you can override this method to return only `[firstFocusable,
   * lastFocusable];`
   */
  readonly _focusableNodes: Node[];
  ready(): void;
  attached(): void;
  detached(): void;

  /**
   * Toggle the opened state of the overlay.
   */
  toggle(): void;

  /**
   * Open the overlay.
   */
  open(): void;

  /**
   * Close the overlay.
   */
  close(): void;

  /**
   * Cancels the overlay.
   *
   * @param event The original event
   */
  cancel(event?: Event|null): void;

  /**
   * Invalidates the cached tabbable nodes. To be called when any of the
   * focusable content changes (e.g. a button is disabled).
   */
  invalidateTabbables(): void;
  _ensureSetup(): void;

  /**
   * Called when `opened` changes.
   */
  _openedChanged(opened?: boolean): void;
  _canceledChanged(): void;
  _withBackdropChanged(): void;

  /**
   * tasks which must occur before opening; e.g. making the element visible.
   */
  _prepareRenderOpened(): void;

  /**
   * Tasks which cause the overlay to actually open; typically play an
   * animation.
   */
  _renderOpened(): void;

  /**
   * Tasks which cause the overlay to actually close; typically play an
   * animation.
   */
  _renderClosed(): void;

  /**
   * Tasks to be performed at the end of open action. Will fire
   * `iron-overlay-opened`.
   */
  _finishRenderOpened(): void;

  /**
   * Tasks to be performed at the end of close action. Will fire
   * `iron-overlay-closed`.
   */
  _finishRenderClosed(): void;
  _preparePositioning(): void;
  _finishPositioning(): void;

  /**
   * Applies focus according to the opened state.
   */
  _applyFocus(): void;

  /**
   * Cancels (closes) the overlay. Call when click happens outside the overlay.
   */
  _onCaptureClick(event: Event): void;

  /**
   * Keeps track of the focused child. If withBackdrop, traps focus within
   * overlay.
   */
  _onCaptureFocus(event: Event): void;

  /**
   * Handles the ESC key event and cancels (closes) the overlay.
   */
  _onCaptureEsc(event: Event): void;

  /**
   * Handles TAB key events to track focus changes.
   * Will wrap focus for overlays withBackdrop.
   */
  _onCaptureTab(event: Event): void;

  /**
   * Refits if the overlay is opened and not animating.
   */
  _onIronResize(): void;

  /**
   * Will call notifyResize if overlay is opened.
   * Can be overridden in order to avoid multiple observers on the same node.
   */
  _onNodesChange(): void;
}

declare const IronOverlayBehaviorImpl: object;


/**
 *   Use `Polymer.IronOverlayBehavior` to implement an element that can be hidden
 *   or shown, and displays on top of other content. It includes an optional
 *   backdrop, and can be used to implement a variety of UI controls including
 *   dialogs and drop downs. Multiple overlays may be displayed at once.
 *
 *   See the [demo source
 *   code](https://github.com/PolymerElements/iron-overlay-behavior/blob/master/demo/simple-overlay.html)
 *   for an example.
 *
 *   ### Closing and canceling
 *
 *   An overlay may be hidden by closing or canceling. The difference between close
 *   and cancel is user intent. Closing generally implies that the user
 *   acknowledged the content on the overlay. By default, it will cancel whenever
 *   the user taps outside it or presses the escape key. This behavior is
 *   configurable with the `no-cancel-on-esc-key` and the
 *   `no-cancel-on-outside-click` properties. `close()` should be called explicitly
 *   by the implementer when the user interacts with a control in the overlay
 *   element. When the dialog is canceled, the overlay fires an
 *   'iron-overlay-canceled' event. Call `preventDefault` on this event to prevent
 *   the overlay from closing.
 *
 *   ### Positioning
 *
 *   By default the element is sized and positioned to fit and centered inside the
 *   window. You can position and size it manually using CSS. See
 *   `Polymer.IronFitBehavior`.
 *
 *   ### Backdrop
 *
 *   Set the `with-backdrop` attribute to display a backdrop behind the overlay.
 *   The backdrop is appended to `<body>` and is of type `<iron-overlay-backdrop>`.
 *   See its doc page for styling options.
 *
 *   In addition, `with-backdrop` will wrap the focus within the content in the
 *   light DOM. Override the [`_focusableNodes`
 *   getter](#Polymer.IronOverlayBehavior:property-_focusableNodes) to achieve a
 *   different behavior.
 *
 *   ### Limitations
 *
 *   The element is styled to appear on top of other content by setting its
 *   `z-index` property. You must ensure no element has a stacking context with a
 *   higher `z-index` than its parent stacking context. You should place this
 *   element as a child of `<body>` whenever possible.
 *
 *   
 */
interface IronOverlayBehavior extends IronFitBehavior, IronResizableBehavior, IronOverlayBehaviorImpl {
}

declare const IronOverlayBehavior: object;

/**
 * DO NOT EDIT
 *
 * This file was automatically generated by
 *   https://github.com/Polymer/tools/tree/master/packages/gen-typescript-declarations
 *
 * To modify these typings, edit the source file(s):
 *   iron-media-query.js
 */



/**
 * `iron-media-query` can be used to data bind to a CSS media query.
 * The `query` property is a bare CSS media query.
 * The `query-matches` property is a boolean representing whether the page matches
 * that media query.
 *
 * Example:
 *
 * ```html
 * <iron-media-query query="(min-width: 600px)" query-matches="{{queryMatches}}">
 * </iron-media-query>
 * ```
 */
interface IronMediaQueryElement extends LegacyElementMixin, HTMLElement {

  /**
   * The Boolean return value of the media query.
   */
  readonly queryMatches: boolean|null|undefined;

  /**
   * The CSS media query to evaluate.
   */
  query: string|null|undefined;

  /**
   * If true, the query attribute is assumed to be a complete media query
   * string rather than a single media feature.
   */
  full: boolean|null|undefined;
  _boundMQHandler: (p0: MediaQueryList|null) => any;
  _mq: MediaQueryList|null;
  attached(): void;
  detached(): void;
  _add(): void;
  _remove(): void;
  queryChanged(): void;
  queryHandler(mq: any): void;
}


declare global {

  interface HTMLElementTagNameMap {
    "iron-media-query": IronMediaQueryElement;
  }
}

declare module "@polymer/polymer/lib/utils/gestures" {
    interface GestureEvent extends Event {
        x: number;
        y: number;
        sourceEvent: Event;
    }
    interface DownEvent extends GestureEvent {
    }
    interface UpEvent extends GestureEvent {
    }
    interface TapEvent extends GestureEvent {
        model: any;
        detail: {
            sourceEvent: Event;
            x: number;
            y: number;
        };
    }
    interface TrackEvent extends GestureEvent {
        detail: TrackEventDetail;
    }
    interface TrackEventDetail {
        state: "start" | "track" | "end";
        dx: number;
        dy: number;
        ddx: number;
        ddy: number;
        hover(): Element;
    }
}
declare namespace IronFocusablesHelper {
    function getTabbableNodes(node: Node): HTMLElement[];
    function isFocusable(element: HTMLElement): boolean;
    function isTabbable(element: HTMLElement): boolean;
}
interface FlattenedNodesObserverInfo {
    target: Element;
    addedNodes: Element[];
    removedNodes: Element[];
}

type polymer_DomBind = DomBind;
declare const polymer_DomBind: typeof DomBind;
type polymer_DomIf = DomIf;
declare const polymer_DomIf: typeof DomIf;
type polymer_DomModule = DomModule;
declare const polymer_DomModule: typeof DomModule;
type polymer_DomRepeat = DomRepeat;
declare const polymer_DomRepeat: typeof DomRepeat;
type polymer_FlattenedNodesObserver = FlattenedNodesObserver;
declare const polymer_FlattenedNodesObserver: typeof FlattenedNodesObserver;
type polymer_FlattenedNodesObserverInfo = FlattenedNodesObserverInfo;
type polymer_GestureEventListeners = GestureEventListeners;
type polymer_GestureEventListenersConstructor = GestureEventListenersConstructor;
declare const polymer_IronFocusablesHelper: typeof IronFocusablesHelper;
declare const polymer_IronOverlayBehavior: typeof IronOverlayBehavior;
declare const polymer_IronOverlayBehaviorImpl: typeof IronOverlayBehaviorImpl;
type polymer_PolymerElement = PolymerElement;
declare const polymer_PolymerElement: typeof PolymerElement;
declare const polymer_dedupingMixin: typeof dedupingMixin;
declare const polymer_enqueueDebouncer: typeof enqueueDebouncer;
declare const polymer_html: typeof html;
declare const polymer_mixinBehaviors: typeof mixinBehaviors;
declare namespace polymer {
  export { async_d as Async, caseMap_d as CaseMap, debounce_d as Debounce, polymer_DomBind as DomBind, polymer_DomIf as DomIf, polymer_DomModule as DomModule, polymer_DomRepeat as DomRepeat, polymer_FlattenedNodesObserver as FlattenedNodesObserver, type polymer_FlattenedNodesObserverInfo as FlattenedNodesObserverInfo, type polymer_GestureEventListeners as GestureEventListeners, type polymer_GestureEventListenersConstructor as GestureEventListenersConstructor, gestures_d as Gestures, polymer_IronFocusablesHelper as IronFocusablesHelper, polymer_IronOverlayBehavior as IronOverlayBehavior, polymer_IronOverlayBehaviorImpl as IronOverlayBehaviorImpl, polymer_PolymerElement as PolymerElement, renderStatus_d as Render, settings_d as Settings, templatize_d as Templatize, resolveUrl_d as Url, polymer_dedupingMixin as dedupingMixin, polymer_enqueueDebouncer as enqueueDebouncer, flush$1 as flush, polymer_html as html, polymer_mixinBehaviors as mixinBehaviors };
}

declare abstract class TemplateConfig<T> extends WebComponent {
    private __template;
    readonly hasTemplate: boolean;
    private _setHasTemplate;
    as: string;
    asModel: (model: T) => any;
    constructor();
    connectedCallback(): void;
    get template(): HTMLTemplateElement;
    stamp(obj: T, as?: string, asModel?: (model: T) => any): DocumentFragment;
}

declare class PersistentObjectAttributeConfig extends TemplateConfig<PersistentObjectAttribute$1> {
    private _calculateHeight;
    private _calculateWidth;
    private height;
    private width;
    type: string;
    name: string;
    noLabel: boolean;
    parentId: string;
    parentObjectId: string;
    calculateHeight(attr: PersistentObjectAttribute$1): number;
    calculateWidth(attr: PersistentObjectAttribute$1): number;
}

declare class PersistentObjectConfig extends TemplateConfig<PersistentObject$1> {
    id: string;
    type: string;
    objectId: string;
}

declare class PersistentObjectTabConfig extends TemplateConfig<PersistentObjectTab$1> {
    id: string;
    name: string;
    type: string;
    objectId: string;
    hideActionBar: boolean;
}

declare class ProgramUnitConfig extends TemplateConfig<ProgramUnit> {
    name: string;
}

declare class QueryChartConfig extends TemplateConfig<QueryChart> {
    type: string;
}

declare class QueryConfig extends TemplateConfig<Query$1> {
    name: string;
    id: string;
    type: string;
    defaultChart: string;
    fileDropAction: string;
    fileDropAttribute: string;
    hideHeader: boolean;
    selectAll: boolean;
    rowHeight: number;
}

declare class AppConfig extends WebComponent {
    private _nodeObserver;
    private _defaultAttributeConfig;
    private _persistentObjectConfigs;
    private _attributeConfigs;
    private _tabConfigs;
    private _programUnitConfigs;
    private _queryConfigs;
    private _queryChartConfigs;
    ready(): void;
    disconnectedCallback(): void;
    private _nodesChanged;
    private _handleNode;
    getSetting(key: string, defaultValue?: string): string;
    getPersistentObjectConfig(persistentObject: PersistentObject$1): PersistentObjectConfig;
    getAttributeConfig(attribute: PersistentObjectAttribute$1): PersistentObjectAttributeConfig;
    getTabConfig(tab: PersistentObjectTab$1): PersistentObjectTabConfig;
    getProgramUnitConfig(name: string): ProgramUnitConfig;
    getQueryConfig(query: Query$1): QueryConfig;
    getQueryChartConfig(type: string): QueryChartConfig;
    private _getConfigs;
}

declare class Alert extends WebComponent {
    static get template(): HTMLTemplateElement;
    log(message: string, type: NotificationType, wait: number): Promise<void>;
}

interface IAppRouteActivatedArgs {
    route: AppRoute;
    parameters: {
        [key: string]: string;
    };
}
interface IAppRouteDeactivateArgs {
    route: AppRoute;
    cancel: boolean;
}
declare class AppRoute extends WebComponent {
    route: string;
    static get template(): HTMLTemplateElement;
    private _hasChildren;
    private _parameters;
    private _documentTitle;
    readonly active: boolean;
    private _setActive;
    readonly path: string;
    private _setPath;
    allowSignedOut: boolean;
    deactivator: (result: boolean) => void;
    preserveContent: boolean;
    routeAlt: string;
    constructor(route: string);
    matchesParameters(parameters?: {
        [key: string]: string;
    }): boolean;
    activate(parameters?: {
        [key: string]: string;
    }): Promise<any>;
    private _fireActivate;
    private _clearChildren;
    deactivate(nextRoute?: AppRoute): Promise<boolean>;
    get parameters(): any;
    private _activeChanged;
    private _titleChanged;
}

declare class Error$1 extends WebComponent {
    static get template(): HTMLTemplateElement;
}

declare class AppRoutePresenter extends WebComponent {
    static get template(): HTMLTemplateElement;
    private _routesObserver;
    private _path;
    private _pathListener;
    private _routeMap;
    private _routeUpdater;
    readonly currentRoute: AppRoute;
    private _setCurrentRoute;
    path: string;
    notFound: boolean;
    connectedCallback(): void;
    disconnectedCallback(): void;
    private _routesChanged;
    private _addRoute;
    private _pathChanged;
}

declare class AppServiceHooksBase extends ServiceHooks {
    get app(): any;
    private _initializeGoogleAnalytics;
    trackEvent(action: string, option: string, owner: ServiceObjectWithActions): void;
    trackPageView(path: string): void;
    getTrackUserId(): string;
    getPersistentObjectConfig(persistentObject: PersistentObject$1, persistentObjectConfigs: PersistentObjectConfig[]): PersistentObjectConfig;
    getAttributeConfig(attribute: PersistentObjectAttribute$1, attributeConfigs: PersistentObjectAttributeConfig[]): PersistentObjectAttributeConfig;
    getTabConfig(tab: PersistentObjectTab$1, tabConfigs: PersistentObjectTabConfig[]): PersistentObjectTabConfig;
    getProgramUnitConfig(name: string, programUnitConfigs: ProgramUnitConfig[]): ProgramUnitConfig;
    getQueryConfig(query: Query$1, queryConfigs: QueryConfig[]): QueryConfig;
    getQueryChartConfig(type: string, queryChartConfigs: QueryChartConfig[]): QueryChartConfig;
    onConstructApplication(application: ApplicationResponse): Application;
    onConstructQuery(service: Service, query: any, parent?: PersistentObject$1, asLookup?: boolean, maxSelectedItems?: number): Query$1;
    onActionConfirmation(action: Action, option: number): Promise<boolean>;
    onAppRouteChanging(newRoute: AppRoute, currentRoute: AppRoute): Promise<string>;
    onAction(args: ExecuteActionArgs): Promise<PersistentObject$1>;
    onStreamingAction(action: string, messages: () => StreamingActionMessages, abort?: () => void): Promise<void>;
    onBeforeAppInitialized(): Promise<void>;
    onAppInitializeFailed(message: string): Promise<void>;
    onRedirectToSignIn(keepUrl: boolean): void;
    onRedirectToSignOut(keepUrl: boolean): void;
    onMessageDialog(title: string, message: string, rich: boolean, ...actions: string[]): Promise<number>;
    onShowNotification(notification: string, type: NotificationType, duration: number): any;
    onShowNotification(notification: Error, type: NotificationType, duration: number): any;
    onSelectReference(query: Query$1): Promise<QueryResultItem[]>;
    onInitial(initial: PersistentObject$1): Promise<void>;
    onSessionExpired(): Promise<boolean>;
    onUpdateAvailable(): void;
    onNavigate(path: string, replaceCurrent?: boolean): void;
    onRetryAction(retry: RetryAction): Promise<string>;
}

declare class ConnectedNotifier extends WebComponent {
    private _wasAttached;
    oneTime: boolean;
    connectedCallback(): void;
}

interface ISize {
    width: number;
    height: number;
}
interface SizeTrackerEvent extends CustomEvent {
    detail: ISize;
}
declare class SizeTracker extends WebComponent {
    private _resizeLast;
    private _isActive;
    readonly size: ISize;
    private _setSize;
    deferred: boolean;
    triggerZero: boolean;
    bubbles: boolean;
    connectedCallback(): void;
    disconnectedCallback(): void;
    measure(): void;
    private get _parentElement();
    private _triggerSizeChanged;
}

interface IDialogOptions {
    omitStyle?: boolean;
}
declare abstract class Dialog extends WebComponent {
    #private;
    static dialogTemplate(innerTemplate: HTMLTemplateElement, options?: IDialogOptions): HTMLTemplateElement;
    readonly isDragging: boolean;
    private _setIsDragging;
    anchorTag: string;
    noCancelOnOutsideClick: boolean;
    noCancelOnEscKey: boolean;
    private get dialog();
    open(): Promise<any>;
    private _track;
    private _translate;
    private _esc;
    close(result?: any): void;
    cancel(): void;
    private _onClose;
    private _onCancel;
    private _onClick;
    private _configureContextMenu;
}

interface IMessageDialogOptions {
    noClose?: boolean;
    title?: string;
    titleIcon?: string;
    actions?: string[];
    actionTypes?: string[];
    defaultAction?: number;
    cancelAction?: number;
    message: string;
    extraClasses?: string[];
    rich?: boolean;
}
declare class MessageDialog extends Dialog {
    static get template(): HTMLTemplateElement;
    readonly options: IMessageDialogOptions;
    private _setOptions;
    readonly activeAction: number;
    private _setActiveAction;
    constructor(options: IMessageDialogOptions);
    connectedCallback(): void;
    cancel(): void;
    open(): Promise<any>;
    private _computeHasHeaderIcon;
    private _actionType;
    private _onSelectAction;
    private _isFirst;
    private _activeActionChanged;
    private _keyboardNextAction;
    private _keyboardPreviousAction;
}

declare class Sensitive extends WebComponent {
    static get template(): HTMLTemplateElement;
}

declare class SessionPresenter extends WebComponent {
    static get template(): HTMLTemplateElement;
    private _stampedTemplate;
    private _stamp;
}

/**
 * DO NOT EDIT
 *
 * This file was automatically generated by
 *   https://github.com/Polymer/tools/tree/master/packages/gen-typescript-declarations
 *
 * To modify these typings, edit the source file(s):
 *   iron-a11y-keys.js
 */



interface IronA11yKeysElement extends IronA11yKeysBehavior, LegacyElementMixin, HTMLElement {
  target: Node|null;

  /**
   * Space delimited list of keys where each key follows the format:
   * `[MODIFIER+]*KEY[:EVENT]`.
   * e.g. `keys="space ctrl+shift+tab enter:keyup"`.
   * More detail can be found in the "Grammar" section of the documentation
   */
  keys: string|null|undefined;
  attached(): void;
  _targetChanged(target: any): void;
  _keysChanged(): void;
  _fireKeysPressed(event: any): void;
}


declare global {

  interface HTMLElementTagNameMap {
    "iron-a11y-keys": IronA11yKeysElement;
  }
}

/**
 * DO NOT EDIT
 *
 * This file was automatically generated by
 *   https://github.com/Polymer/tools/tree/master/packages/gen-typescript-declarations
 *
 * To modify these typings, edit the source file(s):
 *   paper-ripple.js
 */



/**
 * Material design: [Surface
 * reaction](https://www.google.com/design/spec/animation/responsive-interaction.html#responsive-interaction-surface-reaction)
 *
 * `paper-ripple` provides a visual effect that other paper elements can
 * use to simulate a rippling effect emanating from the point of contact.  The
 * effect can be visualized as a concentric circle with motion.
 *
 * Example:
 *
 *     <div style="position:relative">
 *       <paper-ripple></paper-ripple>
 *     </div>
 *
 * Note, it's important that the parent container of the ripple be relative
 * position, otherwise the ripple will emanate outside of the desired container.
 *
 * `paper-ripple` listens to "mousedown" and "mouseup" events so it would display
 * ripple effect when touches on it.  You can also defeat the default behavior and
 * manually route the down and up actions to the ripple element.  Note that it is
 * important if you call `downAction()` you will have to make sure to call
 * `upAction()` so that `paper-ripple` would end the animation loop.
 *
 * Example:
 *
 *     <paper-ripple id="ripple" style="pointer-events: none;"></paper-ripple>
 *     ...
 *     downAction: function(e) {
 *       this.$.ripple.downAction(e.detail);
 *     },
 *     upAction: function(e) {
 *       this.$.ripple.upAction();
 *     }
 *
 * Styling ripple effect:
 *
 *   Use CSS color property to style the ripple:
 *
 *     paper-ripple {
 *       color: #4285f4;
 *     }
 *
 *   Note that CSS color property is inherited so it is not required to set it on
 *   the `paper-ripple` element directly.
 *
 * By default, the ripple is centered on the point of contact.  Apply the
 * `recenters` attribute to have the ripple grow toward the center of its
 * container.
 *
 *     <paper-ripple recenters></paper-ripple>
 *
 * You can also  center the ripple inside its container from the start.
 *
 *     <paper-ripple center></paper-ripple>
 *
 * Apply `circle` class to make the rippling effect within a circle.
 *
 *     <paper-ripple class="circle"></paper-ripple>
 */
interface PaperRippleElement extends IronA11yKeysBehavior, LegacyElementMixin, HTMLElement {
  keyBindings: object;

  /**
   * The initial opacity set on the wave.
   */
  initialOpacity: number|null|undefined;

  /**
   * How fast (opacity per second) the wave fades out.
   */
  opacityDecayVelocity: number|null|undefined;

  /**
   * If true, ripples will exhibit a gravitational pull towards
   * the center of their container as they fade away.
   */
  recenters: boolean|null|undefined;

  /**
   * If true, ripples will center inside its container
   */
  center: boolean|null|undefined;

  /**
   * A list of the visual ripples.
   */
  ripples: any[]|null|undefined;

  /**
   * True when there are visible ripples animating within the
   * element.
   */
  readonly animating: boolean|null|undefined;

  /**
   * If true, the ripple will remain in the "down" state until `holdDown`
   * is set to false again.
   */
  holdDown: boolean|null|undefined;

  /**
   * If true, the ripple will not generate a ripple effect
   * via pointer interaction.
   * Calling ripple's imperative api like `simulatedRipple` will
   * still generate the ripple effect.
   */
  noink: boolean|null|undefined;
  _animating: boolean|null|undefined;
  _boundAnimate: Function|null|undefined;
  readonly target: any;
  readonly shouldKeepAnimating: any;
  attached(): void;
  detached(): void;
  simulatedRipple(): void;

  /**
   * Provokes a ripple down effect via a UI event,
   * respecting the `noink` property.
   */
  uiDownAction(event?: Event|null): void;

  /**
   * Provokes a ripple down effect via a UI event,
   * *not* respecting the `noink` property.
   */
  downAction(event?: Event|null): void;

  /**
   * Provokes a ripple up effect via a UI event,
   * respecting the `noink` property.
   */
  uiUpAction(event?: Event|null): void;

  /**
   * Provokes a ripple up effect via a UI event,
   * *not* respecting the `noink` property.
   */
  upAction(event?: Event|null): void;
  onAnimationComplete(): void;
  addRipple(): any;
  removeRipple(ripple: any): void;

  /**
   * An alias for animate() whose name does not conflict with the platform
   * Element.animate() method.
   */
  animateRipple(): any;
  _onEnterKeydown(): void;
  _onSpaceKeydown(): void;
  _onSpaceKeyup(): void;

  /**
   * effect.
   */
  _holdDownChanged(newVal: any, oldVal: any): void;
}


declare global {

  interface HTMLElementTagNameMap {
    "paper-ripple": PaperRippleElement;
  }
}

declare abstract class AppBase extends WebComponent {
    private _hooks?;
    static get template(): HTMLTemplateElement;
    private _keybindingRegistrations;
    private _activeDialogs;
    private _updateAvailableSnoozeTimer;
    private _initializeResolve;
    private _initialize;
    private _setInitializing;
    private _setService;
    readonly appRoutePresenter: AppRoutePresenter;
    private _setAppRoutePresenter;
    readonly keys: string;
    private _setKeys;
    readonly updateAvailable: boolean;
    private _setUpdateAvailable;
    readonly sessionLost: boolean;
    private _setSessionLost;
    readonly base: string;
    uri: string;
    isTracking: boolean;
    sensitive: boolean;
    path: string;
    constructor(_hooks?: AppServiceHooksBase);
    connectedCallback(): Promise<void>;
    get initialize(): Promise<any>;
    get hooks(): AppServiceHooksBase;
    get activeElement(): Element;
    get activeElementPath(): Element[];
    private _noHistoryChanged;
    protected _initPathRescue(): void;
    private _appRoutePresenterConnected;
    private _computeInitialService;
    private _onSessionStorage;
    private _reload;
    get configuration(): AppConfig;
    changePath(path: string, replaceCurrent?: boolean): void;
    protected _pathChanged(path: string): Promise<void>;
    showDialog(dialog: Dialog): Promise<any>;
    showMessageDialog(options: IMessageDialogOptions): Promise<any>;
    showAlert(notification: string, type?: NotificationType, duration?: number): void;
    redirectToSignIn(keepUrl?: boolean): void;
    redirectToSignOut(keepUrl?: boolean): void;
    private _sensitiveChanged;
    private _cookiePrefixChanged;
    private _anchorClickHandler;
    private _updateAvailable;
    private _refreshForUpdate;
    private _refreshForUpdateDismiss;
    private _computeThemeColorVariants;
    protected _cleanUpOnSignOut(isSignedIn: boolean): void;
    private _registerKeybindings;
    private _unregisterKeybindings;
    private _mediaQueryChanged;
    private _keysPressed;
    static removeRootPath(path?: string): string;
}

interface IPosition {
    x: number;
    y: number;
}
interface IWebComponentProperties {
    [name: string]: ObjectConstructor | StringConstructor | BooleanConstructor | DateConstructor | NumberConstructor | ArrayConstructor | IWebComponentProperty;
}
interface IWebComponentProperty {
    type: ObjectConstructor | StringConstructor | BooleanConstructor | DateConstructor | NumberConstructor | ArrayConstructor;
    computed?: string;
    reflectToAttribute?: boolean;
    readOnly?: boolean;
    observer?: string;
    value?: number | boolean | string | Function;
    notify?: boolean;
}
interface IWebComponentKeybindingInfo {
    [keys: string]: {
        listener: string;
        nonExclusive?: boolean;
        priority?: number;
    } | string;
}
interface IWebComponentRegistrationInfo {
    properties?: IWebComponentProperties;
    listeners?: {
        [eventName: string]: string;
    };
    observers?: string[];
    keybindings?: IWebComponentKeybindingInfo;
    forwardObservers?: string[];
    serviceBusObservers?: {
        [message: string]: string;
    };
    mediaQueryAttributes?: boolean;
    sensitive?: boolean;
}
interface IObserveChainDisposer {
    (): void;
}
declare const WebComponent_base: typeof PolymerElement & GestureEventListenersConstructor;
declare class WebComponent extends WebComponent_base {
    private _appChangedListener;
    private _serviceChangedListener;
    readonly isConnected: boolean;
    private _setIsConnected;
    readonly app: AppBase;
    private _setApp;
    readonly service: Service;
    readonly translations: {
        [key: string]: string;
    };
    protected readonly isAppSensitive: boolean;
    connectedCallback(): void;
    disconnectedCallback(): void;
    private _updateListeners;
    private _listenForApp;
    private _listenForService;
    todo_checkEventTarget(target: EventTarget): EventTarget;
    ensureArgumentValues(args: IArguments): boolean;
    $: {
        [key: string]: HTMLElement;
    };
    computePath(relativePath: string): string;
    empty(parent?: Node, condition?: (e: Node) => boolean): void;
    findParent<T extends HTMLElement>(condition?: (element: Node) => boolean, parent?: Node): T;
    fire(type: string, detail?: any, options?: {
        node?: Node;
        bubbles?: boolean;
        cancelable?: boolean;
        composed?: boolean;
    }): Event;
    protected sleep(milliseconds: number): Promise<never>;
    translateMessage(key: string, ...params: string[]): string;
    protected _focusElement(element: string | HTMLElement, maxAttempts?: number, interval?: number, attempt?: number): void;
    protected _escapeHTML(val: string): string;
    protected _forwardObservable(source: Observable<any> | Array<any>, path: string, pathPrefix: string, callback?: (path: string) => void): IObserveChainDisposer;
    private _forwardComputed;
    private _forwardNegate;
    private _forwardTruthy;
    private static _scanTemplateForLayoutClasses;
    private static _updateTemplateProperty;
    private static _register;
    private static abstractRegistrations;
    static register(infoOrTarget?: IWebComponentRegistrationInfo, prefix?: string): (obj: any) => void;
    static registerAbstract(info?: IWebComponentRegistrationInfo): (obj: any) => void;
    private static _clone;
}

interface IConfigurableAction {
    icon: string;
    label: string;
    action: () => void;
    subActions?: IConfigurableAction[];
}
declare abstract class ConfigurableWebComponent extends WebComponent {
    #private;
    connectedCallback(): Promise<void>;
    disconnectedCallback(): void;
}

declare class AppCacheEntry {
    id: string;
    constructor(id: string);
    isMatch(entry: AppCacheEntry): boolean;
}

declare class AppCacheEntryPersistentObject extends AppCacheEntry {
    objectId?: string;
    private _persistentObject;
    selectedMasterTab: PersistentObjectTab$1;
    selectedDetailTab: PersistentObjectTab$1;
    constructor(idOrPo: string | PersistentObject$1, objectId?: string);
    get persistentObject(): PersistentObject$1;
    set persistentObject(po: PersistentObject$1);
    isMatch(entry: AppCacheEntryPersistentObject): boolean;
}

declare class AppCacheEntryPersistentObjectFromAction extends AppCacheEntryPersistentObject {
    fromActionId?: string;
    fromActionIdReturnPath?: string;
    constructor(po: PersistentObject$1, fromActionId?: string, fromActionIdReturnPath?: string);
    isMatch(entry: AppCacheEntryPersistentObjectFromAction): boolean;
}

declare class AppCacheEntryQuery extends AppCacheEntry {
    query: Query$1;
    constructor(idOrQuery: string | Query$1);
    isMatch(entry: AppCacheEntryQuery): boolean;
}

interface IRGB {
    r: number;
    g: number;
    b: number;
}
declare class AppColor {
    private _base;
    private _rgb;
    private _faint;
    private _semiFaint;
    private _lighter;
    private _light;
    private _dark;
    private _darker;
    constructor(_base: string);
    get rgb(): string;
    get faint(): string;
    get semiFaint(): string;
    get lighter(): string;
    get light(): string;
    get base(): string;
    get dark(): string;
    get darker(): string;
    private _calculateVariant;
    private _hexToRgb;
    private _rgbToHex;
}

declare class AppSetting extends WebComponent {
    key: string;
    value: string;
    connectedCallback(): void;
}

declare class Button extends WebComponent {
    static get template(): HTMLTemplateElement;
    readonly customLayout: boolean;
    private _setCustomLayout;
    disabled: boolean;
    icon: string;
    label: string;
    connectedCallback(): void;
    private _fireTap;
    private _tap;
}

declare class InputSearch extends WebComponent {
    static get template(): HTMLTemplateElement;
    value: string;
    focused: boolean;
    autofocus: boolean;
    connectedCallback(): void;
    private _searchKeypressed;
    private _searchClick;
    private _resetClick;
    private _input_focused;
    private _input_blurred;
    private _stop_tap;
    private _catchOnSumbit;
    private _computeHasValue;
    focus(): void;
}

/**
 * DO NOT EDIT
 *
 * This file was automatically generated by
 *   https://github.com/Polymer/tools/tree/master/packages/gen-typescript-declarations
 *
 * To modify these typings, edit the source file(s):
 *   iron-collapse.js
 */



/**
 * `iron-collapse` creates a collapsible block of content.  By default, the content
 * will be collapsed.  Use `opened` or `toggle()` to show/hide the content.
 *
 *     <button on-click="toggle">toggle collapse</button>
 *
 *     <iron-collapse id="collapse">
 *       <div>Content goes here...</div>
 *     </iron-collapse>
 *
 *     ...
 *
 *     toggle: function() {
 *       this.$.collapse.toggle();
 *     }
 *
 * `iron-collapse` adjusts the max-height/max-width of the collapsible element to
 * show/hide the content.  So avoid putting padding/margin/border on the
 * collapsible directly, and instead put a div inside and style that.
 *
 *     <style>
 *       .collapse-content {
 *         padding: 15px;
 *         border: 1px solid #dedede;
 *       }
 *     </style>
 *
 *     <iron-collapse>
 *       <div class="collapse-content">
 *         <div>Content goes here...</div>
 *       </div>
 *     </iron-collapse>
 *
 * ### Styling
 *
 * The following custom properties and mixins are available for styling:
 *
 * Custom property | Description | Default
 * ----------------|-------------|----------
 * `--iron-collapse-transition-duration` | Animation transition duration | `300ms`
 */
interface IronCollapseElement extends IronResizableBehavior, LegacyElementMixin, HTMLElement {

  /**
   * If true, the orientation is horizontal; otherwise is vertical.
   */
  horizontal: boolean|null|undefined;

  /**
   * Set opened to true to show the collapse element and to false to hide it.
   */
  opened: boolean|null|undefined;

  /**
   * When true, the element is transitioning its opened state. When false,
   * the element has finished opening/closing.
   */
  readonly transitioning: boolean|null|undefined;

  /**
   * Set noAnimation to true to disable animations.
   */
  noAnimation: boolean|null|undefined;
  hostAttributes: object|null;
  readonly dimension: any;

  /**
   * Toggle the opened state.
   */
  toggle(): void;
  show(): void;
  hide(): void;

  /**
   * Updates the size of the element.
   *
   * @param size The new value for `maxWidth`/`maxHeight` as css property value, usually `auto` or `0px`.
   * @param animated if `true` updates the size with an animation, otherwise without.
   */
  updateSize(size: string, animated?: boolean): void;

  /**
   * enableTransition() is deprecated, but left over so it doesn't break
   * existing code. Please use `noAnimation` property instead.
   */
  enableTransition(enabled: any): void;
  _updateTransition(enabled: any): void;
  _horizontalChanged(): void;
  _openedChanged(): void;
  _transitionEnd(): void;
  _onTransitionEnd(event: any): void;
  _calcSize(): any;
}


declare global {

  interface HTMLElementTagNameMap {
    "iron-collapse": IronCollapseElement;
  }
}

declare class Scroller extends WebComponent {
    static get template(): HTMLTemplateElement;
    private static _minBarSize;
    private _scrollEventListener;
    private _verticalScrollHeight;
    private _verticalScrollTop;
    private _verticalScrollSpace;
    private _horizontalScrollWidth;
    private _horizontalScrollLeft;
    private _horizontalScrollSpace;
    private _trackStart;
    readonly hovering: boolean;
    private _setHovering;
    readonly scrolling: string;
    private _setScrolling;
    readonly atTop: boolean;
    private _setAtTop;
    readonly atBottom: boolean;
    private _setAtBottom;
    readonly atStart: boolean;
    private _setAtStart;
    readonly atEnd: boolean;
    private _setAtEnd;
    readonly outerWidth: number;
    private _setOuterWidth;
    readonly outerHeight: number;
    private _setOuterHeight;
    readonly innerWidth: number;
    private _setInnerWidth;
    readonly innerHeight: number;
    private _setInnerHeight;
    readonly horizontal: boolean;
    private _setHorizontal;
    readonly vertical: boolean;
    private _setVertical;
    readonly scrollTopShadow: boolean;
    private _setScrollTopShadow;
    readonly scrollBottomShadow: boolean;
    private _setScrollBottomShadow;
    readonly hiddenScrollbars: boolean;
    private _setHiddenScrollbars;
    noHorizontal: boolean;
    noVertical: boolean;
    horizontalScrollOffset: number;
    verticalScrollOffset: number;
    forceScrollbars: boolean;
    noScrollShadow: boolean;
    connectedCallback(): void;
    disconnectedCallback(): void;
    get scroller(): HTMLElement;
    scrollToTop(offsetTop?: number, animated?: boolean): Promise<void>;
    scrollToBottom(animated?: boolean): void;
    private _outerSizeChanged;
    private _innerSizeChanged;
    private _updateVerticalScrollbar;
    private _updateHorizontalScrollbar;
    private _trackVertical;
    private _trackHorizontal;
    private _trapEvent;
    private _scroll;
    private _updateScrollOffsets;
    private _verticalScrollOffsetChanged;
    private _horizontalScrollOffsetChanged;
    private _mouseenter;
    private _mouseleave;
    private _verticalScrollbarParentTap;
    private _horizontalScrollbarParentTap;
}

declare class MenuItem extends ConfigurableWebComponent {
    static get template(): HTMLTemplateElement;
    readonly expand: boolean;
    private _setExpand;
    collapseGroupsOnTap: boolean;
    item: ProgramUnitItem;
    programUnit: ProgramUnit;
    collapsed: boolean;
    filter: string;
    filtering: boolean;
    hidden: boolean;
    filterParent: ProgramUnitItem;
    private _updateIndentVariable;
    private _computeSubLevel;
    private _collapseRecursive;
    private _tap;
    private _expandChanged;
    private _filterChanged;
    private _updateOpened;
    private _hasMatch;
    private _programUnitChanged;
    private _updateItemTitle;
    private _computeIcon;
    private _computedHasItems;
    private _computedIsSeparator;
    private _computedHref;
    private _computedTarget;
    private _computedRel;
    private _titleMouseenter;
    private _onServiceBusSelect;
    private _configure;
}

declare class User extends WebComponent {
    static get template(): HTMLTemplateElement;
    readonly service: Service;
    private _setService;
    readonly isSignedIn: boolean;
    private _setIsSignedIn;
    readonly hasSensitive: boolean;
    private _setHasSensitive;
    readonly hasFeedback: boolean;
    private _setHasFeedback;
    readonly hasUserSettings: boolean;
    private _setHasUserSettings;
    readonly hasProfiler: boolean;
    private _setHasProfiler;
    readonly userName: string;
    private _setUserName;
    private _computeSignInLabel;
    signIn(): void;
    signOut(): void;
    feedback(): Promise<void>;
    userSettings(): void;
    private _toggleSensitive;
    private _showProfiler;
    private _signedInChanged;
}

declare class Menu extends WebComponent {
    static get template(): HTMLTemplateElement;
    private static _minResizeWidth;
    private _resizeWidth;
    private _instantSearchDebouncer;
    readonly instantSearchDelay: number;
    readonly instantSearchResults: IInstantSearchResult[];
    private _setInstantSearchResults;
    readonly isResizing: boolean;
    private _setIsResizing;
    filter: string;
    filtering: boolean;
    activeProgramUnit: ProgramUnit;
    collapsed: boolean;
    hasGlobalSearch: boolean;
    hideSearch: boolean;
    connectedCallback(): void;
    ready(): void;
    disconnectedCallback(): void;
    private _filterChanged;
    private _search;
    private _computeHasGlobalSearch;
    private _computeInstantSearchDelay;
    private _computeCollapsedWithGlobalSearch;
    private _toggleCollapse;
    private _hasGroupItems;
    private _programUnitItemsCount;
    private _focusSearch;
    private _catchInputSearchTap;
    private _resetFilter;
    private _onResize;
    private _isFirstRunProgramUnit;
    private _add;
    private _instantSearchResultMouseEnter;
}

declare class SignIn extends WebComponent {
    static get template(): HTMLTemplateElement;
    readonly returnUrl: string;
    private _setReturnUrl;
    readonly isBusy: boolean;
    private _setIsBusy;
    readonly hasVidyano: boolean;
    private _setHasVidyano;
    readonly hasOther: boolean;
    private _setHasOther;
    readonly hasForgot: boolean;
    private _setHasForgot;
    readonly hasRegister: boolean;
    private _setHasRegister;
    readonly register: PersistentObject$1;
    private _setRegister;
    readonly initial: PersistentObject$1;
    private _setInitial;
    readonly description: string;
    private _setDescription;
    private readonly notification;
    private _setNotification;
    private step;
    userName: string;
    password: string;
    staySignedIn: boolean;
    twoFactorCode: string;
    private _activate;
    private _deactivate;
    private _back;
    private _stepChanged;
    private _isStep;
    private _register;
    private _finishInitial;
    private _keydown;
    private _computeCanAuthenticate;
    private _authenticate;
    private _authenticateExternal;
    private _forgot;
    private _getInitialSaveLabel;
    private _error;
    private _getProviders;
    private _updateWidth;
    private _tabInnerSizeChanged;
}

declare class SignOut extends WebComponent {
    static get template(): HTMLTemplateElement;
    private _activate;
}

declare class Spinner extends WebComponent {
    static get template(): HTMLTemplateElement;
    private _updateColor;
}

type ProfilerRequest = ProfilerRequest$1 & {
    hasNPlusOne: boolean;
    parameters: {
        key: string;
        value: string;
    }[];
    flattenedEntries: FlattenedProfilerRequestEntry[];
};
type FlattenedProfilerRequestEntry = {
    entry: ProfilerEntry;
    level: number;
};
declare class Profiler extends WebComponent {
    static get template(): HTMLTemplateElement;
    private _boundMousehweel;
    readonly lastRequest: ProfilerRequest;
    private _setLastRequest;
    readonly selectedRequest: ProfilerRequest;
    private _setSelectedRequest;
    readonly hoveredEntry: ProfilerEntry;
    private _setHoveredEntry;
    readonly selectedEntry: ProfilerEntry;
    private _setSelectedEntry;
    readonly zoom: number;
    private _setZoom;
    timelineSize: ISize;
    profiledRequests: ProfilerRequest[];
    connectedCallback(): void;
    disconnectedCallback(): void;
    private _requestSQL;
    private _requestSharpSQL;
    private _requestHasWarnings;
    private _hasNPlusOne;
    private _onMousewheel;
    private _selectRequest;
    private _selectedRequestChanged;
    private _profiledRequestsChanged;
    private _renderRequestTimeline;
    private _flattenEntries;
    private _computeEntryClassName;
    private _requestParameters;
    private _ms;
    private _requestDate;
    private _selectedEntryChanged;
    private _closeSelectedEntry;
    private _close;
}

declare class AppServiceHooks extends AppServiceHooksBase {
    onSessionExpired(): Promise<boolean>;
    onAction(args: ExecuteActionArgs): Promise<PersistentObject$1>;
    onOpen(obj: ServiceObject, replaceCurrent?: boolean, forceFromAction?: boolean): Promise<void>;
    onClose(parent: ServiceObject): void;
    onClientOperation(operation: IClientOperation): void;
    onQueryFileDrop(query: Query$1, name: string, contents: string): Promise<boolean>;
    onRedirectToSignIn(keepUrl: boolean): void;
    onRedirectToSignOut(keepUrl: boolean): void;
}

declare class App extends AppBase {
    static get template(): HTMLTemplateElement;
    private _cache;
    private _beforeUnloadEventHandler;
    programUnit: ProgramUnit;
    noMenu: boolean;
    label: string;
    cacheSize: number;
    constructor(hooks?: AppServiceHooks);
    protected _initPathRescue(): void;
    protected _pathChanged(path: string): Promise<void>;
    private _pathExtendedChanged;
    private _computeProgramUnit;
    private _computeShowMenu;
    private _hookWindowBeforeUnload;
    private _beforeUnload;
    private _configureContextmenu;
    protected _cleanUpOnSignOut(isSignedIn: boolean): void;
    cache(entry: AppCacheEntry): AppCacheEntry;
    cachePing(entry: AppCacheEntry): AppCacheEntry;
    cacheRemove(key: AppCacheEntry): void;
    get cacheEntries(): AppCacheEntry[];
    cacheClear(): void;
    getUrlForPersistentObject(id: string, objectId: string, pu?: ProgramUnit): string;
    getUrlForQuery(id: string, pu?: ProgramUnit): string;
    getUrlForFromAction(id: string, pu?: ProgramUnit): string;
    private _importConfigs;
    private _convertPath;
}

declare class ActionButton extends ConfigurableWebComponent {
    item: QueryResultItem;
    action: Action | ActionGroup;
    static get template(): HTMLTemplateElement;
    private _skipObserver;
    readonly options: KeyValuePair<number, string>[];
    private _setOptions;
    readonly canExecute: boolean;
    private _setCanExecute;
    readonly siblingIcon: boolean;
    private _setSiblingIcon;
    readonly hidden: boolean;
    private _setHidden;
    readonly isGroup: boolean;
    noLabel: boolean;
    openOnHover: boolean;
    forceLabel: boolean;
    inverse: boolean;
    grouped: boolean;
    constructor(item: QueryResultItem, action: Action | ActionGroup);
    connectedCallback(): Promise<void>;
    private _applyItemSelection;
    private _onExecuteWithoutOptions;
    private _onExecuteWithOption;
    private _execute;
    private _observeAction;
    private _computeDisabled;
    private _computeIsGroup;
    private _computeTitle;
    private _computeIcon;
    private _computeHasIcon;
    private _computeIconSpace;
    private _computeSiblingIcon;
    private _computeOpenOnHover;
    private _getPlacement;
    private _hiddenChanged;
    _configure(e: CustomEvent): void;
}

type Alignment = 'start' | 'end';
type Side = 'top' | 'right' | 'bottom' | 'left';
type AlignedPlacement = `${Side}-${Alignment}`;
type Placement = Side | AlignedPlacement;

declare class Popup extends WebComponent {
    #private;
    static get template(): HTMLTemplateElement;
    private _tapHandler;
    private _enterHandler;
    private _leaveHandler;
    private _toggleSize;
    private _header;
    private __Vidyano_WebComponents_PopupCore__Instance__;
    private _resolver;
    private _closeOnMoveoutTimer;
    private _currentTarget;
    readonly open: boolean;
    protected _setOpen: (val: boolean) => void;
    readonly hover: boolean;
    private _setHover;
    readonly renderPopupCoreFit: boolean;
    private _setRenderPopupCoreFit;
    readonly supportsPopover: boolean;
    placement: Placement;
    disabled: boolean;
    sticky: boolean;
    closeDelay: number;
    openOnHover: boolean;
    autoWidth: boolean;
    connectedCallback(): void;
    disconnectedCallback(): void;
    popup(): Promise<any>;
    private _open;
    private _sizeChanged;
    refit(): Promise<void>;
    close(): void;
    private _hookTapAndHoverEvents;
    private _tap;
    private _onPopupparent;
    protected _findParentPopup(): Popup;
    private _catchContentClick;
    protected _contentMouseEnter(e: MouseEvent): void;
    protected _contentMouseLeave(e: MouseEvent): void;
    private _openChanged;
    private _hoverChanged;
    private _toggleSizeChanged;
    private _getPopover;
    static closeAll(parent?: HTMLElement | WebComponent): void;
    private static _isDescendant;
}

type OverflowType = "label" | "icon" | "icon-label";
declare class Overflow extends WebComponent {
    static get template(): HTMLTemplateElement;
    private _overflownChildren;
    private _previousHeight;
    readonly hasOverflow: boolean;
    private _setHasOverflow;
    type: OverflowType;
    private _visibleContainerSizeChanged;
    private _visibleSizeChanged;
    protected _getChildren(): HTMLElement[];
    private _popupOpening;
    private _popupClosed;
    private _getIcon;
    private _getLabel;
}

declare class ActionBar extends WebComponent {
    static get template(): HTMLTemplateElement;
    serviceObject: ServiceObjectWithActions;
    pinnedActions: Action[];
    unpinnedActions: Action[];
    canSearch: boolean;
    private _setHasCharts;
    filterActions(actions: Action[], pinned: boolean): Action[];
    private _computeHasCharts;
    private _search;
    private _computePinnedActions;
    private _computeUnpinnedActions;
    private _transformActionsWithGroups;
    private _computeCanSearch;
    private _computeNoActions;
}

declare class Audit extends WebComponent {
    static get template(): HTMLTemplateElement;
    private _updating;
    private _lastGroup;
    private readonly groups;
    private _setGroups;
    private verticalScrollOffset;
    private search;
    private readonly filter;
    private _setFilter;
    private _computeQuery;
    private _syncVerticalScrollOffset;
    private _syncFilter;
    private _itemsChanged;
    private _getInData;
    private _getOutData;
    private _filterEntries;
    private _entryActionIcon;
    private _open;
    private _filter;
    private _expand;
    private _expandIcon;
    private _moreInfo;
}

declare class Checkbox extends WebComponent {
    static get template(): HTMLTemplateElement;
    checked: boolean;
    label: string;
    disabled: boolean;
    radio: boolean;
    connectedCallback(): void;
    toggle(): void;
    private _keyToggle;
    private _computeIcon;
    private _computeNoLabel;
}

interface IDatePickerCell {
    type: string;
    content?: string;
    date?: moment.Moment;
    monthOffset?: number;
}
declare class DatePicker extends WebComponent {
    static get template(): HTMLTemplateElement;
    readonly cells: IDatePickerCell[];
    private _setCells;
    readonly canFast: boolean;
    private _setCanFast;
    readonly currentDate: moment.Moment;
    private _setCurrentDate;
    readonly today: moment.Moment;
    private _setToday;
    readonly header: string;
    private _setHeader;
    readonly deferredCellsUpdate: boolean;
    private _setDeferredCellsUpdate;
    zoom: string;
    selectedDate: Date;
    monthMode: boolean;
    minDate: Date;
    maxDate: Date;
    newTime: string;
    connectedCallback(): void;
    get isOpen(): boolean;
    private _zoomChanged;
    private _render;
    private _isDateSelected;
    private _isDateToday;
    private _isOtherMonth;
    private _isDateUnselectable;
    private _computeMoment;
    private _slow;
    private _fast;
    private _zoomOut;
    private _select;
    private _opening;
    private _catchTap;
}

interface IFileDropDetails {
    name: string;
    contents: string;
}
declare class FileDrop extends WebComponent {
    static get template(): HTMLTemplateElement;
    readonly dragOver: boolean;
    private _setDragOver;
    private _dragEnter;
    private _dragOver;
    private _dragLeave;
    private _drop;
}

declare class Icon extends WebComponent {
    static get template(): HTMLTemplateElement;
    private _source;
    private _aliases;
    name: string;
    source: string;
    readonly unresolved: boolean;
    private _setUnresolved;
    connectedCallback(): void;
    get aliases(): string[];
    addAlias(...alias: string[]): void;
    private _load;
}

declare function load(name: string): Icon;
declare function exists(name: string): boolean;
declare function add(icon: Element): any;
declare function add(strings: TemplateStringsArray): any;
declare function add(template: HTMLTemplateElement): any;
declare function all(): string[];

declare const iconRegister_add: typeof add;
declare const iconRegister_all: typeof all;
declare const iconRegister_exists: typeof exists;
declare const iconRegister_load: typeof load;
declare namespace iconRegister {
  export { iconRegister_add as add, iconRegister_all as all, iconRegister_exists as exists, iconRegister_load as load };
}

/**
 * DO NOT EDIT
 *
 * This file was automatically generated by
 *   https://github.com/Polymer/tools/tree/master/packages/gen-typescript-declarations
 *
 * To modify these typings, edit the source file(s):
 *   iron-scroll-target-behavior.js
 */



/**
 * `Polymer.IronScrollTargetBehavior` allows an element to respond to scroll
 * events from a designated scroll target.
 *
 * Elements that consume this behavior can override the `_scrollHandler`
 * method to add logic on the scroll event.
 */
interface IronScrollTargetBehavior {

  /**
   * Specifies the element that will handle the scroll event
   * on the behalf of the current element. This is typically a reference to an
   * element, but there are a few more posibilities:
   *
   * ### Elements id
   *
   * ```html
   * <div id="scrollable-element" style="overflow: auto;">
   *  <x-element scroll-target="scrollable-element">
   *    <!-- Content-->
   *  </x-element>
   * </div>
   * ```
   * In this case, the `scrollTarget` will point to the outer div element.
   *
   * ### Document scrolling
   *
   * For document scrolling, you can use the reserved word `document`:
   *
   * ```html
   * <x-element scroll-target="document">
   *   <!-- Content -->
   * </x-element>
   * ```
   *
   * ### Elements reference
   *
   * ```js
   * appHeader.scrollTarget = document.querySelector('#scrollable-element');
   * ```
   */
  scrollTarget: HTMLElement|null;

  /**
   * True if the event listener should be installed.
   *    
   */
  _shouldHaveListener: boolean;

  /**
   * The default scroll target. Consumers of this behavior may want to customize
   * the default scroll target.
   */
  readonly _defaultScrollTarget: any;

  /**
   * Shortcut for the document element
   */
  readonly _doc: any;

  /**
   * Gets the number of pixels that the content of an element is scrolled
   * upward.
   */
  _scrollTop: any;

  /**
   * Gets the number of pixels that the content of an element is scrolled to the
   * left.
   */
  _scrollLeft: any;

  /**
   * Gets the width of the scroll target.
   */
  readonly _scrollTargetWidth: any;

  /**
   * Gets the height of the scroll target.
   */
  readonly _scrollTargetHeight: any;
  _scrollTargetChanged(scrollTarget: any, isAttached: any): void;

  /**
   * Runs on every scroll event. Consumer of this behavior may override this
   * method.
   */
  _scrollHandler(): void;

  /**
   * Returns true if the scroll target is a valid HTMLElement.
   */
  _isValidScrollTarget(): boolean;
  _toggleScrollListener(yes: any, scrollTarget: any): void;

  /**
   * Enables or disables the scroll event listener.
   *
   * @param yes True to add the event, False to remove it.
   */
  toggleScrollListener(yes: boolean): void;
}

declare const IronScrollTargetBehavior: object;

// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today



/**
 * Legacy element behavior to add the optional ability to skip strict
 * dirty-checking for objects and arrays (always consider them to be
 * "dirty") by setting a `mutable-data` attribute on an element instance.
 *
 * By default, `Polymer.PropertyEffects` performs strict dirty checking on
 * objects, which means that any deep modifications to an object or array will
 * not be propagated unless "immutable" data patterns are used (i.e. all object
 * references from the root to the mutation were changed).
 *
 * Polymer also provides a proprietary data mutation and path notification API
 * (e.g. `notifyPath`, `set`, and array mutation API's) that allow efficient
 * mutation and notification of deep changes in an object graph to all elements
 * bound to the same object graph.
 *
 * In cases where neither immutable patterns nor the data mutation API can be
 * used, applying this mixin will allow Polymer to skip dirty checking for
 * objects and arrays (always consider them to be "dirty").  This allows a
 * user to make a deep modification to a bound object graph, and then either
 * simply re-set the object (e.g. `this.items = this.items`) or call `notifyPath`
 * (e.g. `this.notifyPath('items')`) to update the tree.  Note that all
 * elements that wish to be updated based on deep mutations must apply this
 * mixin or otherwise skip strict dirty checking for objects/arrays.
 * Specifically, any elements in the binding tree between the source of a
 * mutation and the consumption of it must enable this behavior or apply the
 * `Polymer.OptionalMutableDataBehavior`.
 *
 * While this behavior adds the ability to forgo Object/Array dirty checking,
 * the `mutableData` flag defaults to false and must be set on the instance.
 *
 * Note, the performance characteristics of propagating large object graphs
 * will be worse by relying on `mutableData: true` as opposed to using
 * strict dirty checking with immutable patterns or Polymer's path notification
 * API.
 */
interface OptionalMutableDataBehavior {

  /**
   * Instance-level flag for configuring the dirty-checking strategy
   * for this element.  When true, Objects and Arrays will skip dirty
   * checking, otherwise strict equality checking will be used.
   */
  mutableData: boolean|null|undefined;

  /**
   * Overrides `Polymer.PropertyEffects` to skip strict equality checking
   * for Objects and Arrays.
   *
   * Pulls the value to dirty check against from the `__dataTemp` cache
   * (rather than the normal `__data` cache) for Objects.  Since the temp
   * cache is cleared at the end of a turn, this implementation allows
   * side-effects of deep object changes to be processed by re-setting the
   * same object (using the temp cache as an in-turn backstop to prevent
   * cycles due to 2-way notification).
   *
   * @param property Property name
   * @param value New property value
   * @param old Previous property value
   * @returns Whether the property should be considered a change
   */
  _shouldPropertyChange(property: string, value: any, old: any): boolean;
}

declare const OptionalMutableDataBehavior: object;

// tslint:disable:variable-name Describing an API that's defined elsewhere.



/**
 * The `Templatizer` behavior adds methods to generate instances of
 * templates that are each managed by an anonymous `PropertyEffects`
 * instance where data-bindings in the stamped template content are bound to
 * accessors on itself.
 *
 * This behavior is provided in Polymer 2.x-3.x as a hybrid-element convenience
 * only.  For non-hybrid usage, the `Templatize` library
 * should be used instead.
 *
 * Example:
 *
 *     import {dom} from '@polymer/polymer/lib/legacy/polymer.dom.js';
 *     // Get a template from somewhere, e.g. light DOM
 *     let template = this.querySelector('template');
 *     // Prepare the template
 *     this.templatize(template);
 *     // Instance the template with an initial data model
 *     let instance = this.stamp({myProp: 'initial'});
 *     // Insert the instance's DOM somewhere, e.g. light DOM
 *     dom(this).appendChild(instance.root);
 *     // Changing a property on the instance will propagate to bindings
 *     // in the template
 *     instance.myProp = 'new value';
 *
 * Users of `Templatizer` may need to implement the following abstract
 * API's to determine how properties and paths from the host should be
 * forwarded into to instances:
 *
 *     _forwardHostPropV2: function(prop, value)
 *
 * Likewise, users may implement these additional abstract API's to determine
 * how instance-specific properties that change on the instance should be
 * forwarded out to the host, if necessary.
 *
 *     _notifyInstancePropV2: function(inst, prop, value)
 *
 * In order to determine which properties are instance-specific and require
 * custom notification via `_notifyInstanceProp`, define an `_instanceProps`
 * object containing keys for each instance prop, for example:
 *
 *     _instanceProps: {
 *       item: true,
 *       index: true
 *     }
 *
 * Any properties used in the template that are not defined in _instanceProp
 * will be forwarded out to the Templatize `owner` automatically.
 *
 * Users may also implement the following abstract function to show or
 * hide any DOM generated using `stamp`:
 *
 *     _showHideChildren: function(shouldHide)
 *
 * Note that some callbacks are suffixed with `V2` in the Polymer 2.x behavior
 * as the implementations will need to differ from the callbacks required
 * by the 1.x Templatizer API due to changes in the `TemplateInstance` API
 * between versions 1.x and 2.x.
 */
interface Templatizer {

  /**
   * Generates an anonymous `TemplateInstance` class (stored as `this.ctor`)
   * for the provided template.  This method should be called once per
   * template to prepare an element for stamping the template, followed
   * by `stamp` to create new instances of the template.
   *
   * @param template Template to prepare
   * @param mutableData When `true`, the generated class will skip
   *   strict dirty-checking for objects and arrays (always consider them to
   *   be "dirty"). Defaults to false.
   */
  templatize(template: HTMLTemplateElement, mutableData?: boolean): void;

  /**
   * Creates an instance of the template prepared by `templatize`.  The object
   * returned is an instance of the anonymous class generated by `templatize`
   * whose `root` property is a document fragment containing newly cloned
   * template content, and which has property accessors corresponding to
   * properties referenced in template bindings.
   *
   * @param model Object containing initial property values to
   *   populate into the template bindings.
   * @returns Returns the created instance of
   * the template prepared by `templatize`.
   */
  stamp(model?: object|null): TemplateInstanceBase|null;

  /**
   * Returns the template "model" (`TemplateInstance`) associated with
   * a given element, which serves as the binding scope for the template
   * instance the element is contained in.  A template model should be used
   * to manipulate data associated with this template instance.
   *
   * @param el Element for which to return a template model.
   * @returns Model representing the binding scope for
   *   the element.
   */
  modelForElement(el: HTMLElement|null): TemplateInstanceBase|null;
}

declare const Templatizer: object;

/**
 * DO NOT EDIT
 *
 * This file was automatically generated by
 *   https://github.com/Polymer/tools/tree/master/packages/gen-typescript-declarations
 *
 * To modify these typings, edit the source file(s):
 *   iron-list.js
 */



/**
 * `iron-list` displays a virtual, 'infinite' list. The template inside
 * the iron-list element represents the DOM to create for each list item.
 * The `items` property specifies an array of list item data.
 *
 * For performance reasons, not every item in the list is rendered at once;
 * instead a small subset of actual template elements *(enough to fill the
 * viewport)* are rendered and reused as the user scrolls. As such, it is important
 * that all state of the list template is bound to the model driving it, since the
 * view may be reused with a new model at any time. Particularly, any state that
 * may change as the result of a user interaction with the list item must be bound
 * to the model to avoid view state inconsistency.
 *
 * ### Sizing iron-list
 *
 * `iron-list` must either be explicitly sized, or delegate scrolling to an
 * explicitly sized parent. By "explicitly sized", we mean it either has an
 * explicit CSS `height` property set via a class or inline style, or else is sized
 * by other layout means (e.g. the `flex` or `fit` classes).
 *
 * #### Flexbox - [jsbin](https://jsbin.com/vejoni/edit?html,output)
 *
 * ```html
 * <template is="x-list">
 *   <style>
 *     :host {
 *       display: block;
 *       height: 100vh;
 *       display: flex;
 *       flex-direction: column;
 *     }
 *
 *     iron-list {
 *       flex: 1 1 auto;
 *     }
 *   </style>
 *   <app-toolbar>App name</app-toolbar>
 *   <iron-list items="[[items]]">
 *     <template>
 *       <div>
 *         ...
 *       </div>
 *     </template>
 *   </iron-list>
 * </template>
 * ```
 * #### Explicit size - [jsbin](https://jsbin.com/vopucus/edit?html,output)
 * ```html
 * <template is="x-list">
 *   <style>
 *     :host {
 *       display: block;
 *     }
 *
 *     iron-list {
 *       height: 100vh; /* don't use % values unless the parent element is sized.
 * \/
 *     }
 *   </style>
 *   <iron-list items="[[items]]">
 *     <template>
 *       <div>
 *         ...
 *       </div>
 *     </template>
 *   </iron-list>
 * </template>
 * ```
 * #### Main document scrolling -
 * [jsbin](https://jsbin.com/wevirow/edit?html,output)
 * ```html
 * <head>
 *   <style>
 *     body {
 *       height: 100vh;
 *       margin: 0;
 *       display: flex;
 *       flex-direction: column;
 *     }
 *
 *     app-toolbar {
 *       position: fixed;
 *       top: 0;
 *       left: 0;
 *       right: 0;
 *     }
 *
 *     iron-list {
 *       /* add padding since the app-toolbar is fixed at the top *\/
 *       padding-top: 64px;
 *     }
 *   </style>
 * </head>
 * <body>
 *   <app-toolbar>App name</app-toolbar>
 *   <iron-list scroll-target="document">
 *     <template>
 *       <div>
 *         ...
 *       </div>
 *     </template>
 *   </iron-list>
 * </body>
 * ```
 *
 * `iron-list` must be given a `<template>` which contains exactly one element. In
 * the examples above we used a `<div>`, but you can provide any element (including
 * custom elements).
 *
 * ### Template model
 *
 * List item templates should bind to template models of the following structure:
 *
 * ```js
 * {
 *   index: 0,        // index in the item array
 *   selected: false, // true if the current item is selected
 *   tabIndex: -1,    // a dynamically generated tabIndex for focus management
 *   item: {}         // user data corresponding to items[index]
 * }
 * ```
 *
 * Alternatively, you can change the property name used as data index by changing
 * the `indexAs` property. The `as` property defines the name of the variable to
 * add to the binding scope for the array.
 *
 * For example, given the following `data` array:
 *
 * ##### data.json
 *
 * ```js
 * [
 *   {"name": "Bob"},
 *   {"name": "Tim"},
 *   {"name": "Mike"}
 * ]
 * ```
 *
 * The following code would render the list (note the name property is bound from
 * the model object provided to the template scope):
 *
 * ```html
 * <iron-ajax url="data.json" last-response="{{data}}" auto></iron-ajax>
 * <iron-list items="[[data]]" as="item">
 *   <template>
 *     <div>
 *       Name: [[item.name]]
 *     </div>
 *   </template>
 * </iron-list>
 * ```
 *
 * ### Grid layout
 *
 * `iron-list` supports a grid layout in addition to linear layout by setting
 * the `grid` attribute.  In this case, the list template item must have both fixed
 * width and height (e.g. via CSS). Based on this, the number of items
 * per row are determined automatically based on the size of the list viewport.
 *
 * ### Accessibility
 *
 * `iron-list` automatically manages the focus state for the items. It also
 * provides a `tabIndex` property within the template scope that can be used for
 * keyboard navigation. For example, users can press the up and down keys to move
 * to previous and next items in the list:
 *
 * ```html
 * <iron-list items="[[data]]" as="item">
 *   <template>
 *     <div tabindex$="[[tabIndex]]">
 *       Name: [[item.name]]
 *     </div>
 *   </template>
 * </iron-list>
 * ```
 *
 * ### Styling
 *
 * You can use the `--iron-list-items-container` mixin to style the container of
 * items:
 *
 * ```css
 * iron-list {
 *  --iron-list-items-container: {
 *     margin: auto;
 *   };
 * }
 * ```
 *
 * ### Resizing
 *
 * `iron-list` lays out the items when it receives a notification via the
 * `iron-resize` event. This event is fired by any element that implements
 * `IronResizableBehavior`.
 *
 * By default, elements such as `iron-pages`, `paper-tabs` or `paper-dialog` will
 * trigger this event automatically. If you hide the list manually (e.g. you use
 * `display: none`) you might want to implement `IronResizableBehavior` or fire
 * this event manually right after the list became visible again. For example:
 *
 * ```js
 * document.querySelector('iron-list').fire('iron-resize');
 * ```
 *
 * ### When should `<iron-list>` be used?
 *
 * `iron-list` should be used when a page has significantly more DOM nodes than the
 * ones visible on the screen. e.g. the page has 500 nodes, but only 20 are visible
 * at a time. This is why we refer to it as a `virtual` list. In this case, a
 * `dom-repeat` will still create 500 nodes which could slow down the web app, but
 * `iron-list` will only create 20.
 *
 * However, having an `iron-list` does not mean that you can load all the data at
 * once. Say you have a million records in the database, you want to split the data
 * into pages so you can bring in a page at the time. The page could contain 500
 * items, and iron-list will only render 20.
 */
interface IronListElement extends Templatizer, IronResizableBehavior, IronScrollTargetBehavior, OptionalMutableDataBehavior, LegacyElementMixin, HTMLElement {
  readonly _defaultScrollTarget: any;

  /**
   * An array containing items determining how many instances of the template
   * to stamp and that that each template instance should bind to.
   */
  items: any[]|null|undefined;

  /**
   * The name of the variable to add to the binding scope for the array
   * element associated with a given template instance.
   */
  as: string|null|undefined;

  /**
   * The name of the variable to add to the binding scope with the index
   * for the row.
   */
  indexAs: string|null|undefined;

  /**
   * The name of the variable to add to the binding scope to indicate
   * if the row is selected.
   */
  selectedAs: string|null|undefined;

  /**
   * When true, the list is rendered as a grid. Grid items must have
   * fixed width and height set via CSS. e.g.
   *
   * ```html
   * <iron-list grid>
   *   <template>
   *      <div style="width: 100px; height: 100px;"> 100x100 </div>
   *   </template>
   * </iron-list>
   * ```
   */
  grid: boolean|null|undefined;

  /**
   * When true, tapping a row will select the item, placing its data model
   * in the set of selected items retrievable via the selection property.
   *
   * Note that tapping focusable elements within the list item will not
   * result in selection, since they are presumed to have their * own action.
   */
  selectionEnabled: boolean|null|undefined;

  /**
   * When `multiSelection` is false, this is the currently selected item, or
   * `null` if no item is selected.
   */
  selectedItem: object|null|undefined;

  /**
   * When `multiSelection` is true, this is an array that contains the
   * selected items.
   */
  selectedItems: object|null|undefined;

  /**
   * When `true`, multiple items may be selected at once (in this case,
   * `selected` is an array of currently selected items).  When `false`,
   * only one item may be selected at a time.
   */
  multiSelection: boolean|null|undefined;

  /**
   * The offset top from the scrolling element to the iron-list element.
   * This value can be computed using the position returned by
   * `getBoundingClientRect()` although it's preferred to use a constant value
   * when possible.
   *
   * This property is useful when an external scrolling element is used and
   * there's some offset between the scrolling element and the list. For
   * example: a header is placed above the list.
   */
  scrollOffset: number|null|undefined;

  /**
   * The ratio of hidden tiles that should remain in the scroll direction.
   * Recommended value ~0.5, so it will distribute tiles evenly in both
   * directions.
   *    
   */
  _ratio: number;

  /**
   * The padding-top value for the list.
   *    
   */
  _scrollerPaddingTop: number;

  /**
   * This value is a cached value of `scrollTop` from the last `scroll` event.
   *    
   */
  _scrollPosition: number;

  /**
   * The sum of the heights of all the tiles in the DOM.
   *    
   */
  _physicalSize: number;

  /**
   * The average `offsetHeight` of the tiles observed till now.
   *    
   */
  _physicalAverage: number;

  /**
   * The number of tiles which `offsetHeight` > 0 observed until now.
   *    
   */
  _physicalAverageCount: number;

  /**
   * The Y position of the item rendered in the `_physicalStart`
   * tile relative to the scrolling list.
   *    
   */
  _physicalTop: number;

  /**
   * The number of items in the list.
   *    
   */
  _virtualCount: number;

  /**
   * The estimated scroll height based on `_physicalAverage`
   *    
   */
  _estScrollHeight: number;

  /**
   * The scroll height of the dom node
   *    
   */
  _scrollHeight: number;

  /**
   * The height of the list. This is referred as the viewport in the context of
   * list.
   *    
   */
  _viewportHeight: number;

  /**
   * The width of the list. This is referred as the viewport in the context of
   * list.
   *    
   */
  _viewportWidth: number;

  /**
   * An array of DOM nodes that are currently in the tree
   */
  _physicalItems: HTMLElement[]|null;

  /**
   * An array of heights for each item in `_physicalItems`
   */
  _physicalSizes: number[]|null;

  /**
   * A cached value for the first visible index.
   * See `firstVisibleIndex`
   */
  _firstVisibleIndexVal: number|null;

  /**
   * A cached value for the last visible index.
   * See `lastVisibleIndex`
   */
  _lastVisibleIndexVal: number|null;

  /**
   * The max number of pages to render. One page is equivalent to the height of
   * the list.
   *    
   */
  _maxPages: number;

  /**
   * The currently focused physical item.
   *    
   */
  _focusedItem: null;

  /**
   * The virtual index of the focused item.
   *    
   */
  _focusedVirtualIndex: any;

  /**
   * The physical index of the focused item.
   *    
   */
  _focusedPhysicalIndex: any;

  /**
   * The item that backfills the `_offscreenFocusedItem` in the physical items
   * list when that item is moved offscreen.
   */
  _focusBackfillItem: HTMLElement|null;

  /**
   * The maximum items per row
   *    
   */
  _itemsPerRow: number;

  /**
   * The width of each grid item
   *    
   */
  _itemWidth: number;

  /**
   * The height of the row in grid layout.
   *    
   */
  _rowHeight: number;

  /**
   * The cost of stamping a template in ms.
   *    
   */
  _templateCost: number;

  /**
   * Needed to pass event.model property to declarative event handlers -
   * see polymer/polymer#4339.
   *    
   */
  _parentModel: boolean;

  /**
   * The bottom of the physical content.
   *    
   */
  readonly _physicalBottom: any;

  /**
   * The bottom of the scroll.
   *    
   */
  readonly _scrollBottom: any;

  /**
   * The n-th item rendered in the last physical item.
   *    
   */
  readonly _virtualEnd: any;

  /**
   * The height of the physical content that isn't on the screen.
   *    
   */
  readonly _hiddenContentSize: any;

  /**
   * The parent node for the _userTemplate.
   *    
   */
  readonly _itemsParent: any;

  /**
   * The maximum scroll top value.
   *    
   */
  readonly _maxScrollTop: any;

  /**
   * The largest n-th value for an item such that it can be rendered in
   * `_physicalStart`.
   *    
   */
  readonly _maxVirtualStart: any;
  _virtualStart: any;
  _physicalStart: any;

  /**
   * The k-th tile that is at the bottom of the scrolling list.
   *    
   */
  readonly _physicalEnd: any;
  _physicalCount: any;

  /**
   * An optimal physical size such that we will have enough physical items
   * to fill up the viewport and recycle when the user scrolls.
   *
   * This default value assumes that we will at least have the equivalent
   * to a viewport of physical items above and below the user's viewport.
   *    
   */
  readonly _optPhysicalSize: any;

  /**
   * True if the current list is visible.
   *    
   */
  readonly _isVisible: any;

  /**
   * Gets the index of the first visible item in the viewport.
   */
  readonly firstVisibleIndex: any;

  /**
   * Gets the index of the last visible item in the viewport.
   */
  readonly lastVisibleIndex: any;
  readonly _virtualRowCount: any;
  readonly _estRowsInView: any;
  readonly _physicalRows: any;
  readonly _scrollOffset: any;
  attached(): void;
  detached(): void;

  /**
   * Recycles the physical items when needed.
   */
  _scrollHandler(): void;
  ready(): void;

  /**
   * Set the overflow property if this element has its own scrolling region
   */
  _setOverflow(scrollTarget: any): void;

  /**
   * Invoke this method if you dynamically update the viewport's
   * size or CSS padding.
   */
  updateViewportBoundaries(): void;

  /**
   * Returns an object that contains the indexes of the physical items
   * that might be reused and the physicalTop.
   *
   * @param fromTop If the potential reusable items are above the scrolling region.
   */
  _getReusables(fromTop: boolean): any;

  /**
   * Update the list of items, starting from the `_virtualStart` item.
   */
  _update(itemSet?: number[], movingUp?: number[]): void;

  /**
   * Creates a pool of DOM elements and attaches them to the local dom.
   *
   * @param size Size of the pool
   */
  _createPool(size: number): any;
  _isClientFull(): any;

  /**
   * Increases the pool size.
   */
  _increasePoolIfNeeded(count: any): void;

  /**
   * Renders the a new list.
   */
  _render(): void;

  /**
   * Templetizes the user template.
   */
  _ensureTemplatized(): void;
  _gridChanged(newGrid: any, oldGrid: any): void;

  /**
   * Called when the items have changed. That is, reassignments
   * to `items`, splices or updates to a single item.
   */
  _itemsChanged(change: any): void;
  _forwardItemPath(path: any, value: any): void;
  _adjustVirtualIndex(splices: object[]): void;
  _removeItem(item: any): void;

  /**
   * Executes a provided function per every physical index in `itemSet`
   * `itemSet` default value is equivalent to the entire set of physical
   * indexes.
   */
  _iterateItems(fn: (p0: number, p1: number) => any, itemSet?: number[]): any;

  /**
   * Returns the virtual index for a given physical index
   *
   * @param pidx Physical index
   */
  _computeVidx(pidx: number): number;

  /**
   * Assigns the data models to a given set of items.
   */
  _assignModels(itemSet?: number[]): void;

  /**
   * Updates the height for a given set of items.
   */
  _updateMetrics(itemSet?: number[]): void;
  _updateGridMetrics(): void;

  /**
   * Updates the position of the physical items.
   */
  _positionItems(): void;
  _getPhysicalSizeIncrement(pidx: any): any;

  /**
   * Returns, based on the current index,
   * whether or not the next index will need
   * to be rendered on a new row.
   *
   * @param vidx Virtual index
   */
  _shouldRenderNextRow(vidx: number): boolean;

  /**
   * Adjusts the scroll position when it was overestimated.
   */
  _adjustScrollPosition(): void;

  /**
   * Sets the position of the scroll.
   */
  _resetScrollPosition(pos: any): void;

  /**
   * Sets the scroll height, that's the height of the content,
   *
   * @param forceUpdate If true, updates the height no matter what.
   */
  _updateScrollerSize(forceUpdate?: boolean): void;

  /**
   * Scroll to a specific item in the virtual list regardless
   * of the physical items in the DOM tree.
   *
   * @param item The item to be scrolled to
   */
  scrollToItem(item: object|null): any;

  /**
   * Scroll to a specific index in the virtual list regardless
   * of the physical items in the DOM tree.
   *
   * @param idx The index of the item
   */
  scrollToIndex(idx: number): void;

  /**
   * Reset the physical average and the average count.
   */
  _resetAverage(): void;

  /**
   * A handler for the `iron-resize` event triggered by `IronResizableBehavior`
   * when the element is resized.
   */
  _resizeHandler(): void;

  /**
   * Selects the given item.
   *
   * @param item The item instance.
   */
  selectItem(item: object|null): any;

  /**
   * Selects the item at the given index in the items array.
   *
   * @param index The index of the item in the items array.
   */
  selectIndex(index: number): void;

  /**
   * Deselects the given item.
   *
   * @param item The item instance.
   */
  deselectItem(item: object|null): any;

  /**
   * Deselects the item at the given index in the items array.
   *
   * @param index The index of the item in the items array.
   */
  deselectIndex(index: number): void;

  /**
   * Selects or deselects a given item depending on whether the item
   * has already been selected.
   *
   * @param item The item object.
   */
  toggleSelectionForItem(item: object|null): any;

  /**
   * Selects or deselects the item at the given index in the items array
   * depending on whether the item has already been selected.
   *
   * @param index The index of the item in the items array.
   */
  toggleSelectionForIndex(index: number): void;

  /**
   * Clears the current selection in the list.
   */
  clearSelection(): void;

  /**
   * Add an event listener to `tap` if `selectionEnabled` is true,
   * it will remove the listener otherwise.
   */
  _selectionEnabledChanged(selectionEnabled: any): void;

  /**
   * Select an item from an event object.
   */
  _selectionHandler(e: any): void;
  _multiSelectionChanged(multiSelection: any): void;

  /**
   * Updates the size of a given list item.
   *
   * @param item The item instance.
   */
  updateSizeForItem(item: object|null): any;

  /**
   * Updates the size of the item at the given index in the items array.
   *
   * @param index The index of the item in the items array.
   */
  updateSizeForIndex(index: number): any;

  /**
   * Creates a temporary backfill item in the rendered pool of physical items
   * to replace the main focused item. The focused item has tabIndex = 0
   * and might be currently focused by the user.
   *
   * This dynamic replacement helps to preserve the focus state.
   */
  _manageFocus(): void;

  /**
   * Converts a random index to the index of the item that completes it's row.
   * Allows for better order and fill computation when grid == true.
   */
  _convertIndexToCompleteRow(idx: any): any;
  _isIndexRendered(idx: any): any;
  _isIndexVisible(idx: any): any;
  _getPhysicalIndex(vidx: any): any;
  focusItem(idx: any): void;
  _focusPhysicalItem(idx: any): void;
  _removeFocusedItem(): void;
  _createFocusBackfillItem(): void;
  _restoreFocusedItem(): void;
  _didFocus(e: any): void;
  _keydownHandler(e: any): void;
  _clamp(v: any, min: any, max: any): any;
  _debounce(name: any, cb: any, asyncModule: any): void;
  _forwardProperty(inst: any, name: any, value: any): void;

  /**
   * Templatizer bindings for v2
   */
  _forwardHostPropV2(prop: any, value: any): void;
  _notifyInstancePropV2(inst: any, prop: any, value: any): void;

  /**
   * Templatizer bindings for v1
   */
  _getStampedChildren(): any;
  _forwardInstancePath(inst: any, path: any, value: any): void;
  _forwardParentPath(path: any, value: any): void;
  _forwardParentProp(prop: any, value: any): void;

  /**
   * Gets the activeElement of the shadow root/host that contains the list.
   */
  _getActiveElement(): any;
}


declare global {

  interface HTMLElementTagNameMap {
    "iron-list": IronListElement;
  }
}

declare class List extends WebComponent {
    static get template(): HTMLTemplateElement;
    items: any[];
    as: string;
    parentScroller: boolean;
    private _hookIronListToScroller;
    private _bindIronListDataHost;
    private _sizeChanged;
}

declare class MaskedInput extends WebComponent {
    static get template(): HTMLTemplateElement;
    private _startText;
    format: string;
    separator: string;
    allowed: string;
    open: string;
    disabled: boolean;
    preserve: boolean;
    value: string;
    connectedCallback(): void;
    get input(): HTMLInputElement;
    focus(): void;
    private static otherKeys;
    private _isOther;
    private _isGoodOnes;
    private _isFilled;
    private _resetCursor;
    private _getTextCursor;
    private _setTextCursor;
    private _update;
    private _keydown;
    private _keypress;
    private _tap;
    private _focus;
    private _blur;
    private _preventCutPaste;
    private _resetField;
    private _computeSize;
}

declare class Notification extends WebComponent {
    static get template(): HTMLTemplateElement;
    readonly isOverflowing: boolean;
    private _setIsOverflowing;
    serviceObject: ServiceObjectWithActions;
    type: NotificationType;
    text: string;
    private _close;
    private _moreInfo;
    private _trackerSizeChanged;
    private _textChanged;
    private _setTextOverflow;
    private _computeText;
    private _computeInlineText;
    private _computeHidden;
    private _computeIcon;
}

declare class PersistentObjectAttributeValidationError extends WebComponent {
    static get template(): HTMLTemplateElement;
    attribute: PersistentObjectAttribute$1;
    private _computeHidden;
    private _showError;
}

declare class PersistentObjectAttributeEdit extends WebComponent {
    static get template(): HTMLTemplateElement;
    private _setFocus;
    attribute: PersistentObjectAttribute$1;
    private _focus;
    private _blur;
    private _computeHasError;
    private _computeSensitive;
    private _computeHasValidationError;
}

declare class PersistentObjectAttributeLabel extends WebComponent {
    static get template(): HTMLTemplateElement;
    attribute: PersistentObjectAttribute$1;
    private _computeRequired;
    private _computeReadOnly;
    private _computeEditing;
    private _computeHasError;
    private _computeHasToolTip;
    private _showTooltip;
}

declare class PersistentObjectAttributeAsDetailRow extends WebComponent {
    static get template(): HTMLTemplateElement;
    private fullEdit;
    serviceObject: PersistentObject$1;
    private _isColumnVisible;
    private _attributeForColumn;
    private _displayValue;
    private _computeSoftEdit;
    private _isSoftEditOnly;
    private _computeIsSensitive;
    private _setFullEdit;
    private _delete;
    private _onAttributeLoading;
    private _onAttributeLoaded;
}

declare abstract class PersistentObjectAttribute extends WebComponent {
    private _foreground;
    attribute: PersistentObjectAttribute$1;
    value: any;
    editing: boolean;
    nonEdit: boolean;
    readOnly: boolean;
    disabled: boolean;
    sensitive: boolean;
    focus(): void;
    protected _attributeValueChanged(): void;
    protected _optionsChanged(options: string[] | PersistentObjectAttributeOption[]): void;
    protected _attributeChanged(): void;
    protected _editingChanged(): void;
    protected _valueChanged(newValue: any, oldValue: any): void;
    private _computeHasError;
    private _computeEditing;
    private _computeReadOnly;
    private _computeReadOnlyTabIndex;
    private _computeSensitive;
    private _computePlaceholder;
    private _computeOptions;
    private _updateForegroundDataTypeHint;
    protected _onFocus(e: FocusEvent): void;
    private _gridAreaChanged;
    static registerAttributeType(attributeType: string, constructor: PersistentObjectAttributeConstructor): void;
    static getAttributeConstructor(attributeType: string): PersistentObjectAttributeConstructor;
}
type PersistentObjectAttributeConstructor = new (...args: any[]) => PersistentObjectAttribute;

declare class PersistentObjectAttributeAsDetail extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    private _inlineAddHeight;
    readonly initializing: boolean;
    private _setInitializing;
    readonly newAction: Action;
    private _setNewAction;
    readonly deleteAction: boolean;
    private _setDeleteAction;
    readonly isAdding: boolean;
    private _setIsAdding;
    attribute: PersistentObjectAttributeAsDetail$1;
    newActionPinned: boolean;
    private _isColumnVisible;
    private _computeColumns;
    private _computeCanDelete;
    private _computeNewActionPinned;
    private _isNotDeleted;
    private _updateActions;
    private _updateWidths;
    private _add;
    private _finalizeAdd;
    private _delete;
    private _setActiveObject;
    private _isRowFullEdit;
    private _frozenChanged;
    private _titleMouseenter;
}

declare class PersistentObjectAttributeBinaryFile extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    focus(): void;
    private _inputContainer;
    private _inputAttribute;
    private _change;
    private _registerInput;
    private _clear;
    private _computeCanClear;
    private _computeFileName;
}

declare class Toggle extends WebComponent {
    static get template(): HTMLTemplateElement;
    toggled: boolean;
    label: string;
    disabled: boolean;
    radio: boolean;
    connectedCallback(): void;
    toggle(): void;
    private _keyToggle;
    private _computeIsNull;
}

declare class PersistentObjectAttributeBoolean extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    readonly defaultInputtype: string;
    private _setDefaultInputtype;
    connectedCallback(): void;
    protected _valueChanged(newValue: any): void;
    private _computeCanToggle;
    private _computeIsDisabled;
    private _computeIsCheckbox;
}

type SelectOption = KeyValuePair<any, string>;
interface ISelectItem {
    displayValue: string;
    group: string;
    groupFirst: boolean;
    option: string | SelectOption;
}
declare class Select extends WebComponent {
    static get template(): HTMLTemplateElement;
    private items;
    private filteredItems;
    private _lastMatchedInputValue;
    private _inputValue;
    private _pendingSelectedOption;
    readonly suggestion: ISelectItem;
    private _setSuggestion;
    readonly filtering: boolean;
    private _setFiltering;
    readonly selectedItem: ISelectItem;
    private _setSelectedItem;
    readonly lazy: boolean;
    private _setLazy;
    ungroupedOptions: string[] | SelectOption[];
    selectedOption: string;
    keepUnmatched: boolean;
    readonly: boolean;
    groupSeparator: string;
    open(): void;
    focus(): void;
    private get popup();
    private _keydown;
    private _keyup;
    private _blur;
    private _popupOpened;
    private _popupClosed;
    private _scrollItemIntoView;
    private _computeHasOptions;
    private _computeUngroupedOptions;
    private _computeItems;
    private _computeFilteredItems;
    private _computeSuggestionFeedback;
    private _computeItemDisplayValue;
    private _disabledChanged;
    private _setSelectedOption;
    private _selectedItemChanged;
    private _selectedOptionChanged;
    private _suggestionChanged;
    private _getItem;
    private _select;
    private _computeIsReadonlyInput;
    private _computeInputTabIndex;
}
declare class SelectOptionItem extends WebComponent {
    item: ISelectItem;
    private _onTap;
}

declare class PersistentObjectAttributeComboBox extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    readonly comboBoxOptions: string[];
    private _setComboBoxOptions;
    newValue: string;
    protected _editingChanged(): void;
    protected _valueChanged(newValue: any): void;
    protected _optionsChanged(): void;
    private _add;
    private _computeCanAdd;
    protected _onFocus(e: FocusEvent): void;
}

declare class PersistentObjectAttributeCommonMark extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    private _editTextAreaBlur;
}

declare class TimePicker extends WebComponent {
    static get template(): HTMLTemplateElement;
    readonly hours: number;
    private _setHours;
    readonly minutes: number;
    private _setMinutes;
    state: string;
    time: Date;
    connectedCallback(): void;
    get isOpen(): boolean;
    private _timeChanged;
    private _tap;
    private _switch;
    private _updateTime;
    private _catchTap;
    private _zeroPrefix;
}

declare class PersistentObjectAttributeDateTime extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    private _valueChangedBlock;
    private _dateInput;
    private _timeInput;
    private _pendingRefresh;
    readonly isInvalid: boolean;
    private _setIsInvalid;
    readonly hasTimeComponent: boolean;
    readonly hasDateComponent: boolean;
    readonly monthMode: boolean;
    readonly dateFormat: string;
    readonly dateSeparator: string;
    readonly timeFormat: string;
    readonly timeSeparator: string;
    readonly minDate: Date;
    readonly maxDate: Date;
    selectedDate: Date;
    selectedTime: Date;
    get dateInput(): HTMLInputElement;
    get timeInput(): HTMLInputElement;
    focus(): void;
    protected _editingChanged(): void;
    protected _valueChanged(value: Date, oldValue: any): void;
    private _selectedDateChanged;
    private _selectedTimeChanged;
    private _guardedSetValue;
    private _renderDate;
    private _renderTime;
    private _setInputValue;
    private _clear;
    private _dateFilled;
    private _timeFilled;
    private _keydown;
    private _keyup;
    private _blur;
    private _computeHasComponent;
    private _computeDateFormat;
    private _computeDateSeparator;
    private _computeTimeFormat;
    private _computeTimeSeparator;
    private _computeCanClear;
    private _computeMonthMode;
    private _computeMinMaxDate;
    private _previousMonth;
    private _nextMonth;
}

declare class PersistentObjectAttributeDropDown extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    protected _valueChanged(newValue: any): void;
    private _computeShowEditable;
    private _computeInputType;
    private _computeOrientation;
    private _computeGroupSeparator;
    private _optionLabel;
    private _isChecked;
    private _isUnchecked;
    private _select;
}

declare class PersistentObjectAttributeFlagsEnumFlag extends WebComponent {
    static get template(): HTMLTemplateElement;
    private _skipCheckedChanged;
    attribute: PersistentObjectAttribute$1;
    checked: boolean;
    label: string;
    option: PersistentObjectAttributeOption;
    private _checkedChanged;
    private _computeLabel;
    private _valueChanged;
    private _values;
}

declare class PersistentObjectAttributeFlagsEnum extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
}

declare class PersistentObjectAttributeIcon extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    readonly icons: string[];
    private _setIcons;
    private _onOpening;
    private _selectIcon;
}

declare class PersistentObjectAttributeImage extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    private _pasteListener;
    _attributeChanged(): void;
    disconnectedCallback(): void;
    private _change;
    private _clear;
    private _computeHasValue;
    private _computeImage;
    private _computeCanOpen;
    private _pasteAuto;
    private _pasteCreateImage;
    private _showDialog;
}

declare class PersistentObjectAttributeKeyValueList extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    protected _valueChanged(newValue: any): void;
    private _computeShowEditable;
    private _computeInputType;
    private _computeOrientation;
    private _computeGroupSeparator;
    private _computeDisableFiltering;
    private _optionLabel;
    private _isChecked;
    private _isUnchecked;
    private _select;
}

declare class PersistentObjectAttributeMultiLineString extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    maxlength: number;
    protected _attributeChanged(): void;
    private _editTextAreaBlur;
}

declare class PersistentObjectAttributeMultiStringItem extends WebComponent {
    value: string;
    static get template(): HTMLTemplateElement;
    readonly input: HTMLInputElement;
    private _setInput;
    private _focusQueued;
    isNew: boolean;
    isReadOnly: boolean;
    sensitive: boolean;
    constructor(value: string);
    connectedCallback(): void;
    focus(): void;
    queueFocus(): void;
    private _valueChanged;
    private _onInputBlur;
}

interface ISortableDragEndDetails {
    element: HTMLElement;
    newIndex: number;
    oldIndex: number;
}
declare abstract class Sortable extends WebComponent {
    private _sortable;
    readonly isDragging: boolean;
    private _setIsDragging;
    readonly isGroupDragging: boolean;
    private _setIsGroupDragging;
    group: string;
    filter: string;
    handle: string;
    draggableItems: string;
    enabled: boolean;
    connectedCallback(): void;
    disconnectedCallback(): void;
    groupChanged(): void;
    filterChanged(): void;
    handleChanged(): void;
    draggableItemsChangted(): void;
    protected _dragStart(): void;
    protected _dragEnd(element: HTMLElement, newIndex: number, oldIndex: number): void;
    private _create;
    private _destroy;
    private _enabledChanged;
}

declare class Tags extends WebComponent {
    static get template(): HTMLTemplateElement;
    input: string;
    tags: string[];
    readonly: boolean;
    focus(): void;
    private _passFocus;
    private _checkKeyPress;
    private _onInputBlur;
    private _addTag;
    private _onDeleteTap;
}

declare class PersistentObjectAttributeMultiStringItems extends Sortable {
    protected _dragEnd(): void;
}
declare class PersistentObjectAttributeMultiString extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    readonly isTags: boolean;
    readonly suggestions: string[];
    readonly hasSuggestions: boolean;
    strings: PersistentObjectAttributeMultiStringItem[];
    tags: string[];
    focus(): void;
    private _computeStrings;
    private _itemValueNew;
    private _itemsOrderChanged;
    private _itemValueChanged;
    private _render;
    private _computeIsTags;
    protected _valueChanged(newValue: any, oldValue: any): void;
    private _onTagsChanged;
    private _onFrozenChanged;
    private _computeTagSuggestions;
    private _computeHasTagSuggestions;
    private _computeFilteredSuggestions;
    private _computeIsTagsReadonly;
    private _addSuggestionTag;
}

declare class PersistentObjectAttributeNullableBoolean extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    private _computeBooleanOptions;
    protected _valueChanged(newValue: any): void;
    private _notNull;
    private _isDisabled;
}

declare class PersistentObjectAttributeNumeric extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    private _allowDecimal;
    private _isNullable;
    private _decimalSeparator;
    readonly focused: boolean;
    private _setFocused;
    readonly inputtype: string;
    private _setInputtype;
    unitBefore: string;
    unitAfter: string;
    private static _decimalTypes;
    private static _unsignedTypes;
    _attributeChanged(): void;
    protected _attributeValueChanged(): void;
    protected _valueChanged(newValue: string, oldValue: string): Promise<void>;
    private _editInputBlur;
    private _editInputFocus;
    private _canParse;
    private _between;
    private _setCarretIndex;
    private _keypress;
    private _computeDisplayValueWithUnit;
    private _computeBeforeUnit;
    private _computeAfterUnit;
    static registerNumericAttributeType(attributeType: string, numericType: string): void;
}

declare class PersistentObjectAttributePassword extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    readonly autocomplete: string;
    private _setAutocomplete;
    protected _attributeChanged(): void;
    private _editInputBlur;
}

declare class PersistentObjectAttributeReference extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    readonly canClear: boolean;
    private _setCanClear;
    readonly canAddNewReference: boolean;
    private _setCanAddNewReference;
    readonly canBrowseReference: boolean;
    private _setCanBrowseReference;
    objectId: string;
    attribute: PersistentObjectAttributeWithReference;
    href: string;
    filter: string;
    connectedCallback(): void;
    protected _attributeChanged(): void;
    protected _valueChanged(newValue: any): void;
    private _objectIdChanged;
    private _filterBlur;
    protected _editingChanged(): void;
    private _browse;
    private _browseReference;
    private _addNewReference;
    private _clearReference;
    private _update;
    private _openSelect;
    private _open;
    private _computeTarget;
    private _computeInputType;
    private _computeOrientation;
    private _computeCanOpenSelect;
    private _computeTitle;
    private _select;
}

interface ITranslatedString {
    key: string;
    label: string;
    value: string;
}
declare class PersistentObjectAttributeTranslatedString extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    private _defaultLanguage;
    readonly strings: ITranslatedString[];
    private _setStrings;
    multiline: boolean;
    protected _optionsChanged(options: string[] | PersistentObjectAttributeOption[]): void;
    protected _valueChanged(newValue: string, oldValue: string): void;
    private _editInputBlur;
    private _computeMultiline;
    private _computeCanShowDialog;
    private _showLanguagesDialog;
}

declare class PersistentObjectAttributeUser extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    private _browseReference;
    private _clearReference;
    private _setNewUser;
    private _computeFriendlyName;
    private _computeCanClear;
    private _computeCanBrowseReference;
}

declare class PersistentObjectAttributePresenter extends ConfigurableWebComponent {
    static get template(): HTMLTemplateElement;
    private _developerToggleDisposer;
    private _renderedAttribute;
    private _renderedAttributeElement;
    private _focusQueued;
    private _customTemplate;
    readonly loading: boolean;
    private _setLoading;
    attribute: PersistentObjectAttribute$1;
    editing: boolean;
    nonEdit: boolean;
    noLabel: boolean;
    disabled: boolean;
    readOnly: boolean;
    readonly name: string;
    readonly type: string;
    connectedCallback(): Promise<void>;
    disconnectedCallback(): void;
    private _onTap;
    private _devToggle;
    queueFocus(): void;
    private _attributeChanged;
    private _renderAttribute;
    private _updateRowSpan;
    private _computeEditing;
    private _computeNonEdit;
    private _nonEditChanged;
    private _disabledChanged;
    private _computeRequired;
    private _computeReadOnly;
    private _computeHasError;
    private _computeHasValue;
    private _loadingChanged;
    private _openAttributeManagement;
    private _configure;
    private _gridAreaChanged;
}

declare class PersistentObjectAttributeImageDialog extends Dialog {
    label: string;
    static get template(): HTMLTemplateElement;
    private _updated;
    readonly sources: string[];
    source: string;
    constructor(label: string, ...sources: string[]);
    private _showImage;
    private _computeHasMultiple;
    private _next;
    private _previous;
    private _close;
}

declare class PersistentObjectAttributeString extends PersistentObjectAttribute {
    static get template(): HTMLTemplateElement;
    private _suggestionsSeparator;
    readonly editInputStyle: string;
    private _setEditInputStyle;
    readonly suggestions: string[];
    private _setSuggestions;
    readonly inputtype: string;
    private _setInputtype;
    readonly characterCasing: string;
    private _setCharacterCasing;
    readonly maxlength: number;
    private _setMaxlength;
    readonly autocomplete: string;
    private _setAutocomplete;
    protected _attributeChanged(): void;
    private _editInputBlur;
    private _editInputFocus;
    protected _valueChanged(value: any, oldValue: any): void;
    private _characterCasingChanged;
    private _addSuggestion;
    private _computeFilteredSuggestions;
    private _computeHasSuggestions;
    private _computeLink;
    private _computeLinkTitle;
}

declare class PersistentObjectAttributeTranslatedStringDialog extends Dialog {
    label: string;
    strings: ITranslatedString[];
    multiline: boolean;
    readonly: boolean;
    static get template(): HTMLTemplateElement;
    constructor(label: string, strings: ITranslatedString[], multiline: boolean, readonly: boolean);
    private _keyboardOk;
    private _ok;
    private _onCaptureTab;
}

declare class PersistentObjectTabPresenter extends WebComponent {
    static get template(): HTMLTemplateElement;
    private _renderedTab;
    private _tabAttributes;
    readonly loading: boolean;
    private _setLoading;
    readonly templated: boolean;
    private _setTemplated;
    tab: PersistentObjectTab$1;
    private _renderTab;
    private _attributeLoaded;
}

interface IPersistentObjectDialogOptions {
    noHeader?: boolean;
    saveLabel?: string;
    save?: (po: PersistentObject$1, close: () => void) => void;
    noCancel?: boolean;
    cancel?: (close: () => void) => void;
}
declare class PersistentObjectDialog extends Dialog {
    persistentObject: PersistentObject$1;
    static get template(): HTMLTemplateElement;
    private _saveHook;
    readonly options: IPersistentObjectDialogOptions;
    private _setOptions;
    tab: PersistentObjectAttributeTab;
    constructor(persistentObject: PersistentObject$1, _options?: IPersistentObjectDialogOptions);
    private _keyboardSave;
    private _save;
    private _cancel;
    private _computeCanSave;
    private _computeSaveLabel;
    private _computeTab;
    private _computeReadOnly;
    private _computeDialogActions;
    private _computeHideCancel;
    private _executeExtraAction;
    private _onCaptureTab;
    private _tabInnerSizeChanged;
}

declare class PersistentObjectGroup extends WebComponent {
    static get template(): HTMLTemplateElement;
    private _asyncHandles;
    private _items;
    private _itemsChecksum;
    private _presentersLoading;
    readonly loading: boolean;
    private _setLoading;
    group: PersistentObjectAttributeGroup;
    columns: number;
    private _computeLabel;
    private _arrange;
    private _itemFromAttribute;
    private _onAttributeLoading;
    private _onAttributeLoaded;
    private _onAttributeVisibilityChanged;
    protected onCreatePersistentObjectAttributePresenter(attribute: PersistentObjectAttribute$1): PersistentObjectAttributePresenter;
}

declare class PersistentObjectTabBarItem extends WebComponent {
    static get template(): HTMLTemplateElement;
    tab: PersistentObjectTab$1;
    private _select;
    private _computeIsSelected;
    private _computeBadge;
    private _computeHasBadge;
    private _computeLabel;
    private _computeQuery;
    private _computeQueryLabel;
}

declare class PersistentObjectTabBar extends WebComponent {
    static get template(): HTMLTemplateElement;
    private _observeDisposer;
    tabs: PersistentObjectTab$1[];
    selectedTab: PersistentObjectTab$1;
    private _hookObservers;
    private _tabSelected;
    private isInline;
    private isDropDown;
    private _isVisible;
}

interface IPersistentObjectWebComponent extends WebComponent {
    persistentObject: PersistentObject$1;
}
declare class PersistentObject extends WebComponent implements IPersistentObjectWebComponent {
    static get template(): HTMLTemplateElement;
    private _cacheEntry;
    persistentObject: PersistentObject$1;
    layout: string;
    masterWidth: string;
    masterTabs: PersistentObjectTab$1[];
    selectedMasterTab: PersistentObjectTab$1;
    detailTabs: PersistentObjectTab$1[];
    selectedDetailTab: PersistentObjectTab$1;
    private _persistentObjectChanged;
    private _masterWidthChanged;
    private _computeMasterTabs;
    private _computeDetailTabs;
    private _detailTabsChanged;
    private _masterTabsChanged;
    private _selectedMasterTabChanged;
    private _selectedDetailTabChanged;
    private _computeLayout;
    private _computeLayoutMasterDetail;
    private _computeLayoutDetailsOnly;
    private _computeLayoutFullPage;
    private _computeLayoutMasterActions;
    private _computeLayoutDetailActions;
    private _computeLayoutMasterTabs;
    private _computeLayoutDetailTabs;
    private _computeHasMasterTabs;
    private _computeHasDetailTabs;
    private _computeShowNavigation;
    private _tabselect;
    private _persistentObjectNotificationChanged;
    private _trackSplitter;
    private _hideActionBar;
    private _getNavigationIndex;
    private _navigate;
}
declare class PersistentObjectDetailsContent extends WebComponent {
    static get template(): HTMLTemplateElement;
}
declare class PersistentObjectDetailsHeader extends WebComponent {
    static get template(): HTMLTemplateElement;
}

declare class PersistentObjectPresenter extends ConfigurableWebComponent {
    static get template(): HTMLTemplateElement;
    private _cacheEntry;
    readonly loading: boolean;
    private _setLoading;
    readonly templated: boolean;
    private _setTemplated;
    readonly error: string;
    private _setError;
    persistentObjectId: string;
    persistentObjectObjectId: string;
    persistentObject: PersistentObject$1;
    private _activate;
    private _deactivate;
    private _updatePersistentObject;
    private _persistentObjectChanged;
    private _updateTitle;
    private _renderPersistentObject;
    private _edit;
    private _save;
    private _cancelSave;
    private _configure;
    static registerRenderCallback(callback: (persistentObject: PersistentObject$1) => IPersistentObjectWebComponent): void;
}

declare class PersistentObjectTab extends ConfigurableWebComponent {
    static get template(): HTMLTemplateElement;
    private _attributePresenters;
    private _autofocusTarget;
    readonly groups: PersistentObjectAttributeGroup[];
    private _setGroups;
    tab: PersistentObjectAttributeTab;
    noAutofocus: boolean;
    disconnectedCallback(): void;
    private _computeColumns;
    private _updateGroups;
    private _autofocus;
    private _attributeLoaded;
    private _innerSizeChanged;
    private _configure;
}

declare class PersistentObjectWizardDialog extends Dialog {
    readonly persistentObject: PersistentObject$1;
    static get template(): HTMLTemplateElement;
    readonly currentTab: PersistentObjectAttributeTab;
    private _setCurrentTab;
    readonly canPrevious: boolean;
    readonly canNext: boolean;
    readonly canFinish: boolean;
    readonly visibleTabs: PersistentObjectAttributeTab[];
    hasPendingAttributes: boolean;
    constructor(persistentObject: PersistentObject$1);
    ready(): void;
    connectedCallback(): void;
    private _tabInnerSizeChanged;
    private _computeVisibleTabs;
    private _computeCanPrevious;
    private _previous;
    private _computeCanNext;
    private _next;
    private _computeCanFinish;
    private _computeHasPendingAttributes;
    private _finish;
    private _onCaptureTab;
}

declare class PopupMenuItemSeparator extends WebComponent {
    static get template(): HTMLTemplateElement;
}

declare class PopupMenuItemSplit extends WebComponent {
    label?: string;
    icon?: string;
    private _action?;
    static get template(): HTMLTemplateElement;
    private _observer;
    readonly hasChildren: boolean;
    private _setHasChildren;
    iconSpace: boolean;
    checked: boolean;
    constructor(label?: string, icon?: string, _action?: () => void);
    connectedCallback(): void;
    disconnectedCallback(): void;
    private _popupMenuIconSpaceHandler;
    private _onTap;
    private _splitTap;
}

declare class PopupMenuItemWithActions extends WebComponent {
    label?: string;
    icon?: string;
    private _action?;
    static get template(): HTMLTemplateElement;
    iconSpace: boolean;
    constructor(label?: string, icon?: string, _action?: () => void);
    private _popupMenuIconSpaceHandler;
    private _onTap;
    private _actionsTap;
    private _catch;
}

declare class PopupMenuItem extends WebComponent {
    label?: string;
    icon?: string;
    private _action?;
    static get template(): HTMLTemplateElement;
    private _observer;
    readonly hasChildren: boolean;
    private _setHasChildren;
    iconSpace: boolean;
    checked: boolean;
    constructor(label?: string, icon?: string, _action?: () => void);
    connectedCallback(): void;
    disconnectedCallback(): void;
    private _popupMenuIconSpaceHandler;
    private _onTap;
    private _catchTap;
}

declare class PopupMenu extends WebComponent {
    #private;
    static get template(): HTMLTemplateElement;
    contextMenuOnly: boolean;
    shiftKey: boolean;
    ctrlKey: boolean;
    openOnHover: boolean;
    open: boolean;
    popup(): Promise<any>;
    private _hookContextMenu;
    private _openContext;
    private _popupMenuIconSpaceHandler;
    private _mouseenter;
    private _mousemove;
    private _stopTap;
}

declare class ProgramUnitPresenter extends WebComponent {
    static get template(): HTMLTemplateElement;
    readonly programUnit: ProgramUnit;
    private _setProgramUnit;
    readonly error: string;
    private _setError;
    private _activate;
    private _programUnitChanged;
}

declare class QueryChartSelector extends WebComponent {
    static get template(): HTMLTemplateElement;
    query: Query$1;
    private _computeTypes;
    private _showGrid;
    private _showChart;
}

declare abstract class QueryGridCell extends WebComponent {
    #private;
    readonly sensitive: boolean;
    protected _setSensitive: (sensitive: boolean) => void;
    column: QueryColumn;
    value: QueryResultItemValue;
    valueQueued: QueryResultItemValue;
    connectedCallback(): void;
    disconnectedCallback(): void;
    get isObserved(): boolean;
    private _queueMeasure;
    private _observe;
    _unobserve(): void;
    static registerCellType(type: string, constructor: QueryGridCellConstructor): void;
    static getCellTypeConstructor(type: string): QueryGridCellConstructor;
}
type QueryGridCellConstructor = new (...args: any[]) => QueryGridCell;

declare class QueryGridCellBoolean extends QueryGridCell {
    static get template(): HTMLTemplateElement;
    private _isHidden;
    private _icon;
    private _textNode;
    readonly oldValue: QueryResultItemValue;
    private _setOldValue;
    private _valueChanged;
    private _update;
}

declare class QueryGridCellDefault extends QueryGridCell {
    static get template(): HTMLTemplateElement;
    private _extraClass;
    private _typeHints;
    private _textNode;
    private _textNodeValue;
    private _foreground;
    private _tag;
    private _textAlign;
    right: boolean;
    tag: boolean;
    private _valueChanged;
    private _getTypeHint;
}

declare class QueryGridCellImage extends QueryGridCell {
    static get template(): HTMLTemplateElement;
    private _isHidden;
    private _image;
    private _valueChanged;
}

interface IQueryGridUserSettingsColumnData {
    offset?: number;
    isPinned?: boolean;
    isHidden?: boolean;
    width?: string;
}
declare class QueryGridColumn extends Observable<QueryGridColumn> implements IQueryGridUserSettingsColumnData {
    private _column;
    private _userSettingsColumnData;
    constructor(_column: QueryColumn, _userSettingsColumnData: IQueryGridUserSettingsColumnData);
    get column(): QueryColumn;
    get query(): Query$1;
    get name(): string;
    get label(): string;
    get type(): string;
    get canSort(): boolean;
    get canGroupBy(): boolean;
    get canFilter(): boolean;
    get canListDistincts(): boolean;
    get sortDirection(): SortDirection;
    get distincts(): IQueryColumnDistincts;
    get offset(): number;
    set offset(offset: number);
    get isPinned(): boolean;
    set isPinned(isPinned: boolean);
    get isHidden(): boolean;
    set isHidden(isHidden: boolean);
    get width(): string;
    set width(width: string);
}

interface IQueryGridColumnFilterDistinct {
    type: string;
    value: string;
    displayValue: string;
}
declare class QueryGridColumnFilter extends WebComponent {
    static get template(): HTMLTemplateElement;
    private _searchTextDebouncer;
    private _resizeStart;
    readonly loading: boolean;
    private _setLoading;
    readonly render: boolean;
    private _setRender;
    column: QueryGridColumn;
    queryColumn: QueryColumn;
    searchText: string;
    label: string;
    distincts: IQueryGridColumnFilterDistinct[];
    inversed: boolean;
    filtered: boolean;
    disconnectedCallback(): void;
    private _render;
    protected _update(): void;
    private _getDistinctDisplayValue;
    private _popupOpening;
    private _searchTextChanged;
    private _getFilteredDistincts;
    private _distinctClick;
    private _updateFilters;
    private _updateDistincts;
    private _renderDistincts;
    private _getHighlightedDistinctDisplayValue;
    private _search;
    private _inverse;
    private _clear;
    private _onResize;
    private _catchClick;
}

declare class QueryGridColumnHeader extends WebComponent {
    #private;
    static get template(): HTMLTemplateElement;
    column: QueryGridColumn;
    readonly canSort: boolean;
    private _setCanSort;
    readonly canGroupBy: boolean;
    private _setCanGroupBy;
    readonly isPinned: boolean;
    private _setIsPinned;
    readonly renderPopupMenu: boolean;
    private _setRenderPopupMenu;
    private _renderPopupMenu;
    private _columnChanged;
    private _computeSortingIcon;
    private _computeGroupByLabel;
    private _computePinLabel;
    private _sort;
    private _onContextmenu;
    private _sortAsc;
    private _sortDesc;
    private _group;
    private _togglePin;
    private _hide;
    private _configure;
    private _queueMeasure;
    private _resizeTrack;
    private _resize;
    private _computeName;
}

declare class QueryGridColumnMeasure extends WebComponent {
    private _reported;
    static get template(): HTMLTemplateElement;
    private _report;
}

declare class QueryGridConfigureDialogColumn extends WebComponent {
    column: QueryGridColumn;
    static get template(): HTMLTemplateElement;
    offset: number;
    isPinned: boolean;
    isHidden: boolean;
    constructor(column: QueryGridColumn);
    private _togglePin;
    private _toggleVisible;
}

declare class QueryGridUserSettings extends Observable<QueryGridUserSettings> {
    private _query;
    private _columnsByName;
    private _columns;
    private constructor();
    getColumn(name: string): QueryGridColumn;
    get query(): Query$1;
    get columns(): QueryGridColumn[];
    save(refreshOnComplete?: boolean): Promise<any>;
    static Load(query: Query$1): QueryGridUserSettings;
}

declare class QueryGridConfigureDialog extends Dialog {
    query: Query$1;
    private _settings;
    static get template(): HTMLTemplateElement;
    private _elements;
    constructor(query: Query$1, _settings: QueryGridUserSettings);
    connectedCallback(): void;
    private _distributeColumns;
    private _updateColumns;
    private _reorderColumns;
    private _save;
    private _reset;
}
declare class QueryGridConfigureDialogColumnList extends Sortable {
    protected _dragEnd(): void;
}

declare class QueryGridFilterDialogName extends WebComponent {
    static get template(): HTMLTemplateElement;
    private _blockUpdate;
    readonly grouping: boolean;
    private _setGrouping;
    attribute: PersistentObjectAttribute$1;
    group: string;
    name: string;
    private _attributeChanged;
    private _focusInput;
    private _toggleGrouping;
    private _updateAttributeValue;
}

declare class QueryGridFilterDialog extends Dialog {
    private _filters;
    private _filter;
    static get template(): HTMLTemplateElement;
    readonly persistentObject: PersistentObject$1;
    private _setPersistentObject;
    constructor(_filters: QueryFilters, _filter: QueryFilter);
    private _save;
    close(result?: any): void;
}

declare class QueryGridFilters extends WebComponent {
    static get template(): HTMLTemplateElement;
    query: Query$1;
    queryFilters: QueryFilters;
    currentFilter: QueryFilter;
    private _computeUserFilters;
    private _computeLockedFilters;
    private _computeFilters;
    private _catchGroupTap;
    private _filterNonGroupName;
    private _computeHidden;
    private _computeDisabled;
    private _computeHasFilters;
    private _computeCanReset;
    private _computeCanSave;
    private _computeCurrentFilterSaveLabel;
    private _computeCanSaveAs;
    private _computeFilterEditLabel;
    private _reset;
    private _load;
    private _saveAs;
    private _save;
    private _edit;
    private _delete;
    private _showUserFilterSeparator;
    private _hasGroupName;
    private _hasNoGroupName;
    private _nonGroupName;
}

declare class QueryGridFooter extends WebComponent {
    static get template(): HTMLTemplateElement;
    item: QueryResultItem;
    columns: QueryColumn[];
    private _computeIsNumeric;
    private _computeItemValue;
}

declare class QueryGridGrouping extends WebComponent {
    static get template(): HTMLTemplateElement;
    query: Query$1;
    private _toggleCollapse;
    private _remove;
}

declare class QueryGridRowGroup extends WebComponent {
    static get template(): HTMLTemplateElement;
    group: QueryResultItemGroup;
    private _computeFirst;
    private _tap;
}

interface IItemTapEventArgs {
    item: QueryResultItem;
}
declare class QueryGridRow extends WebComponent {
    static get template(): HTMLTemplateElement;
    item: QueryResultItem | QueryResultItemGroup;
    index: number;
    private _groupElement;
    private _visibleCells;
    private _invisibleCellValues;
    private _extraclass;
    readonly isGroup: boolean;
    private _setIsGroup;
    columns: QueryColumn[];
    offsets: number[];
    visibleRange: [left: number, right: number];
    private _columnsChanged;
    private _itemChanged;
    private _flush;
    private _preventOpen;
    private _onTap;
    private _onContextmenu;
    private _onSelect;
    private _onActionsOpening;
    private _onActionsClosed;
    private _catchTap;
    refresh(): void;
}

declare class QueryGridSelectAll extends WebComponent {
    static get template(): HTMLTemplateElement;
    query: Query$1;
    readonly partial: boolean;
    private _toggle;
    private _computePartial;
    private _computeSelected;
}

type QueryGridItem = QueryResultItem | QueryResultItemGroup;
type MoreColumns = {
    left: QueryGridColumnHeader[];
    right: QueryGridColumnHeader[];
};
declare class QueryGrid extends WebComponent {
    static get template(): HTMLTemplateElement;
    private readonly _columnWidths;
    private readonly items;
    private _virtualGridStartIndex;
    private _verticalSpacerCorrection;
    private _getItemsDebouncer;
    private _updateCellDebouncer;
    private _pinnedStyle;
    private _lastSelectedItemIndex;
    private _controlsSizeObserver;
    private _updateMoreDebouncer;
    query: Query$1;
    asLookup: boolean;
    maxRows: number;
    noSelection: boolean;
    noInlineActions: boolean;
    readonly initializing: boolean;
    private _setInitializing;
    readonly virtualItems: QueryGridItem[];
    private _setVirtualItems;
    readonly columns: QueryGridColumn[];
    readonly pinnedColumns: QueryGridColumn[];
    private _setPinnedColumns;
    readonly viewportHeight: number;
    readonly virtualRowCount: number;
    readonly hasGrouping: boolean;
    private _setHasGrouping;
    readonly userSettings: QueryGridUserSettings;
    private _setUserSettings;
    rowHeight: number;
    skip: number;
    horizontalScrollOffset: number;
    verticalScrollOffset: number;
    visibleColumnHeaderSize: ISize;
    readonly moreColumns: MoreColumns;
    private _setMoreColumns;
    readonly physicalUpperLimitExceeded: boolean;
    connectedCallback(): void;
    disconnectedCallback(): void;
    ready(): void;
    private _onAppRouteDeactivate;
    private _onInitializingChanged;
    private _queryChanged;
    private _controlsSizeChanged;
    private _columnWidthChanged;
    private _scrollToTop;
    private _update;
    private _computeItems;
    private _getItem;
    private _updateVerticalSpacer;
    private _updatePinnedColumns;
    private _updateUserSettings;
    private _computeColumns;
    private _computeVirtualRowCount;
    private _computeOffsets;
    private _computeVisibleRange;
    private _computeCanSelect;
    private _computeInlineActions;
    private _computeCanReorder;
    private _computePhysicalUpperLimitExceeded;
    private _computeHasMoreRows;
    private _rowHeightChanged;
    private _updateHorizontalScrollOffset;
    private _onVerticalScrollOffsetChanged;
    private _itemSelect;
    private __rowsBeforeDragEnd;
    private _onReorderStart;
    private _onReorderEnd;
    private _onColumnUpdate;
    private _onConfigure;
    private _reset;
    private _updateMore;
    private _onMoreOpening;
    private _onMoreClosed;
}

declare class QueryItemsPresenter extends ConfigurableWebComponent {
    static get template(): HTMLTemplateElement;
    private _renderedQuery;
    readonly loading: boolean;
    private _setLoading;
    readonly templated: boolean;
    private _setTemplated;
    readonly fileDrop: boolean;
    private _setFileDrop;
    query: Query$1;
    private _renderQuery;
    private _onFileDropped;
    private _refresh;
    private _new;
    private _delete;
    private _bulkEdit;
    private _configure;
}

declare class QueryPresenter extends WebComponent {
    static get template(): HTMLTemplateElement;
    private _cacheEntry;
    readonly loading: boolean;
    private _setLoading;
    readonly error: string;
    private _setError;
    queryId: string;
    query: Query$1;
    private _activate;
    private _computeHasError;
    private _updateQuery;
    private _queryChanged;
    private _renderQuery;
    private _updateTitle;
}

declare class Query extends WebComponent {
    static get template(): HTMLTemplateElement;
    private _cacheEntry;
    query: Query$1;
    connectedCallback(): void;
    private _queryChanged;
    private _computeNoActions;
    private _computeSearchOnHeader;
    private _computeLabel;
    private _computeHideHeader;
}

declare class RetryActionDialog extends Dialog {
    retry: RetryAction;
    static get template(): HTMLTemplateElement;
    constructor(retry: RetryAction);
    connectedCallback(): void;
    cancel(): void;
    private _computeTab;
    private _onSelectOption;
    private _isFirst;
}

declare class SelectReferenceDialog extends Dialog {
    query: Query$1;
    canAddNewReference: boolean;
    static get template(): HTMLTemplateElement;
    canSelect: boolean;
    constructor(query: Query$1, forceSearch?: boolean, canAddNewReference?: boolean, keepFilter?: boolean);
    private _initializingChanged;
    private _selectedItemsChanged;
    private _invalidateCanSelect;
    private _queryPropertyChanged;
    private _select;
    private _addNew;
    private _search;
    private _selectReference;
}

declare const Keys: {
    Backspace: string;
    Tab: string;
    Enter: string;
    Shift: string;
    Control: string;
    Alt: string;
    Pause: string;
    Break: string;
    CapsLock: string;
    Escape: string;
    PageUp: string;
    PageDown: string;
    End: string;
    Home: string;
    ArrowLeft: string;
    ArrowUp: string;
    ArrowRight: string;
    ArrowDown: string;
    Comma: string;
    Subtract: string;
    Period: string;
    Zero: string;
    One: string;
    Two: string;
    Three: string;
    Four: string;
    Five: string;
    Six: string;
    Seven: string;
    Eight: string;
    Nine: string;
};
interface IKeysEvent extends CustomEvent {
    detail: {
        combo: string;
        key: string;
        shiftKey?: boolean;
        ctrlKey?: boolean;
        altKey?: boolean;
        metaKey?: boolean;
        event: string;
        keyboardEvent: IEvent;
    };
}
interface IEvent extends KeyboardEvent {
    keyIdentifier: string;
}
interface IKeybindingRegistration {
    keys: string[];
    element: HTMLElement;
    listener: (e: IKeysEvent) => void;
    nonExclusive: boolean;
    priority?: number;
    scope?: AppRoute | Dialog;
}

export { ActionBar, ActionButton, Alert, App, AppBase, AppCacheEntry, AppCacheEntryPersistentObject, AppCacheEntryPersistentObjectFromAction, AppCacheEntryQuery, AppColor, AppConfig, AppRoute, AppRoutePresenter, AppServiceHooks, AppServiceHooksBase, AppSetting, Audit, BigNumber, Button, Checkbox, ConfigurableWebComponent, ConnectedNotifier, DatePicker, Dialog, Error$1 as Error, FileDrop, type IAppRouteActivatedArgs, type IAppRouteDeactivateArgs, type IConfigurableAction, type IDatePickerCell, type IDialogOptions, type IEvent, type IFileDropDetails, type IItemTapEventArgs, type IKeybindingRegistration, type IKeysEvent, type IMessageDialogOptions, type IObserveChainDisposer, type IPersistentObjectDialogOptions, type IPersistentObjectWebComponent, type IPosition, type IQueryGridColumnFilterDistinct, type IQueryGridUserSettingsColumnData, type IRGB, type ISelectItem, type ISize, type ISortableDragEndDetails, type ITranslatedString, type IWebComponentKeybindingInfo, type IWebComponentProperties, type IWebComponentProperty, type IWebComponentRegistrationInfo, Icon, iconRegister as IconRegister, InputSearch, Keys, List, MaskedInput, Menu, MenuItem, MessageDialog, Notification, Overflow, type OverflowType, PersistentObject, PersistentObjectAttribute, PersistentObjectAttributeAsDetail, PersistentObjectAttributeAsDetailRow, PersistentObjectAttributeBinaryFile, PersistentObjectAttributeBoolean, PersistentObjectAttributeComboBox, PersistentObjectAttributeCommonMark, PersistentObjectAttributeConfig, type PersistentObjectAttributeConstructor, PersistentObjectAttributeDateTime, PersistentObjectAttributeDropDown, PersistentObjectAttributeEdit, PersistentObjectAttributeFlagsEnum, PersistentObjectAttributeFlagsEnumFlag, PersistentObjectAttributeIcon, PersistentObjectAttributeImage, PersistentObjectAttributeImageDialog, PersistentObjectAttributeKeyValueList, PersistentObjectAttributeLabel, PersistentObjectAttributeMultiLineString, PersistentObjectAttributeMultiString, PersistentObjectAttributeMultiStringItem, PersistentObjectAttributeMultiStringItems, PersistentObjectAttributeNullableBoolean, PersistentObjectAttributeNumeric, PersistentObjectAttributePassword, PersistentObjectAttributePresenter, PersistentObjectAttributeReference, PersistentObjectAttributeString, PersistentObjectAttributeTranslatedString, PersistentObjectAttributeTranslatedStringDialog, PersistentObjectAttributeUser, PersistentObjectAttributeValidationError, PersistentObjectConfig, PersistentObjectDetailsContent, PersistentObjectDetailsHeader, PersistentObjectDialog, PersistentObjectGroup, PersistentObjectPresenter, PersistentObjectTab, PersistentObjectTabBar, PersistentObjectTabBarItem, PersistentObjectTabConfig, PersistentObjectTabPresenter, PersistentObjectWizardDialog, polymer as Polymer, Popup, PopupMenu, PopupMenuItem, PopupMenuItemSeparator, PopupMenuItemSplit, PopupMenuItemWithActions, Profiler, ProgramUnitConfig, ProgramUnitPresenter, Query, QueryChartConfig, QueryChartSelector, QueryConfig, QueryGrid, QueryGridCell, QueryGridCellBoolean, type QueryGridCellConstructor, QueryGridCellDefault, QueryGridCellImage, QueryGridColumn, QueryGridColumnFilter, QueryGridColumnHeader, QueryGridColumnMeasure, QueryGridConfigureDialog, QueryGridConfigureDialogColumn, QueryGridConfigureDialogColumnList, QueryGridFilterDialog, QueryGridFilterDialogName, QueryGridFilters, QueryGridFooter, QueryGridGrouping, QueryGridRow, QueryGridRowGroup, QueryGridSelectAll, QueryGridUserSettings, QueryItemsPresenter, QueryPresenter, RetryActionDialog, Scroller, Select, type SelectOption, SelectOptionItem, SelectReferenceDialog, Sensitive, SessionPresenter, SignIn, SignOut, SizeTracker, type SizeTrackerEvent, Sortable, Spinner, Tags, TemplateConfig, TimePicker, Toggle, User, vidyano as Vidyano, WebComponent, moment };
