/**
 * Represents culture-specific information, including number and date formatting.
 */
export class CultureInfo {
    /**
     * The current culture in use.
     */
    static currentCulture: CultureInfo;

    /**
     * The invariant (culture-neutral) culture.
     */
    static invariantCulture: CultureInfo;

    /**
     * Registered cultures by name.
     */
    static cultures: Record<string, CultureInfo> = {};

    /**
     * Creates a new CultureInfo instance.
     * @param name - The culture name (e.g., "en-US").
     * @param numberFormat - Number formatting information.
     * @param dateFormat - Date formatting information.
     */
    constructor(public name: string, public numberFormat: ICultureInfoNumberFormat, public dateFormat: ICultureInfoDateFormat) {
    }

    /**
     * Formats a number with thousand separators according to the culture.
     * @param value - The number to format.
     * @returns The formatted number string.
     */
    formatNumber(value: number): string {
        try {
            return new Intl.NumberFormat(this.name || undefined).format(value);
        } catch {
            return new Intl.NumberFormat().format(value);
        }
    }
}

/**
 * Number formatting information for a culture.
 */
export interface ICultureInfoNumberFormat {
    /** Symbol for Not-a-Number. */
    naNSymbol: string;
    /** Symbol for negative sign. */
    negativeSign: string;
    /** Symbol for positive sign. */
    positiveSign: string;
    /** Text for negative infinity. */
    negativeInfinityText: string;
    /** Text for positive infinity. */
    positiveInfinityText: string;
    /** Symbol for percent. */
    percentSymbol: string;
    /** Group sizes for percent values. */
    percentGroupSizes: number[];
    /** Decimal digits for percent values. */
    percentDecimalDigits: number;
    /** Decimal separator for percent values. */
    percentDecimalSeparator: string;
    /** Group separator for percent values. */
    percentGroupSeparator: string;
    /** Pattern for positive percent values. */
    percentPositivePattern: string;
    /** Pattern for negative percent values. */
    percentNegativePattern: string;
    /** Symbol for currency. */
    currencySymbol: string;
    /** Group sizes for currency values. */
    currencyGroupSizes: number[];
    /** Decimal digits for currency values. */
    currencyDecimalDigits: number;
    /** Decimal separator for currency values. */
    currencyDecimalSeparator: string;
    /** Group separator for currency values. */
    currencyGroupSeparator: string;
    /** Pattern for negative currency values. */
    currencyNegativePattern: string;
    /** Pattern for positive currency values. */
    currencyPositivePattern: string;
    /** Group sizes for number values. */
    numberGroupSizes: number[];
    /** Decimal digits for number values. */
    numberDecimalDigits: number;
    /** Decimal separator for number values. */
    numberDecimalSeparator: string;
    /** Group separator for number values. */
    numberGroupSeparator: string;
}

/**
 * Date formatting information for a culture.
 */
export interface ICultureInfoDateFormat {
    /** AM designator. */
    amDesignator: string;
    /** PM designator. */
    pmDesignator: string;
    /** Date separator. */
    dateSeparator: string;
    /** Time separator. */
    timeSeparator: string;
    /** GMT date/time pattern. */
    gmtDateTimePattern: string;
    /** Universal date/time pattern. */
    universalDateTimePattern: string;
    /** Sortable date/time pattern. */
    sortableDateTimePattern: string;
    /** General date/time pattern. */
    dateTimePattern: string;
    /** Long date pattern. */
    longDatePattern: string;
    /** Short date pattern. */
    shortDatePattern: string;
    /** Long time pattern. */
    longTimePattern: string;
    /** Short time pattern. */
    shortTimePattern: string;
    /** Year/month pattern. */
    yearMonthPattern: string;
    /** First day of the week (0 = Sunday, 1 = Monday, ...). */
    firstDayOfWeek: number;
    /** Full day names. */
    dayNames: string[];
    /** Abbreviated day names. */
    shortDayNames: string[];
    /** Minimized day names. */
    minimizedDayNames: string[];
    /** Full month names. */
    monthNames: string[];
    /** Abbreviated month names. */
    shortMonthNames: string[];
}

CultureInfo.cultures[""] = new CultureInfo("", { naNSymbol: "NaN", negativeSign: "-", positiveSign: "+", negativeInfinityText: "-Infinity", positiveInfinityText: "Infinity", percentSymbol: "%", percentGroupSizes: [3], percentDecimalDigits: 2, percentDecimalSeparator: ".", percentGroupSeparator: ",", percentPositivePattern: "{0} %", percentNegativePattern: "-{0} %", currencySymbol: "¤", currencyGroupSizes: [3], currencyDecimalDigits: 2, currencyDecimalSeparator: ".", currencyGroupSeparator: ",", currencyNegativePattern: "(${0})", currencyPositivePattern: "${0}", numberGroupSizes: [3], numberDecimalDigits: 2, numberDecimalSeparator: ".", numberGroupSeparator: "," }, { amDesignator: "AM", pmDesignator: "PM", dateSeparator: "/", timeSeparator: ":", gmtDateTimePattern: "ddd, dd MMM yyyy HH':'mm':'ss 'GMT'", universalDateTimePattern: "yyyy'-'MM'-'dd HH':'mm':'ss'Z'", sortableDateTimePattern: "yyyy'-'MM'-'dd'T'HH':'mm':'ss", dateTimePattern: "dddd, dd MMMM yyyy HH:mm:ss", longDatePattern: "dddd, dd MMMM yyyy", shortDatePattern: "MM/dd/yyyy", longTimePattern: "HH:mm:ss", shortTimePattern: "HH:mm", yearMonthPattern: "yyyy MMMM", firstDayOfWeek: 0, dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], shortDayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], minimizedDayNames: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"], monthNames: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", ""], shortMonthNames: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", ""] });
CultureInfo.cultures["de-DE"] = new CultureInfo("de-DE", { naNSymbol: "NaN", negativeSign: "-", positiveSign: "+", negativeInfinityText: "-∞", positiveInfinityText: "∞", percentSymbol: "%", percentGroupSizes: [3], percentDecimalDigits: 2, percentDecimalSeparator: ",", percentGroupSeparator: ".", percentPositivePattern: "{0} %", percentNegativePattern: "-{0} %", currencySymbol: "€", currencyGroupSizes: [3], currencyDecimalDigits: 2, currencyDecimalSeparator: ",", currencyGroupSeparator: ".", currencyNegativePattern: "-{0} $", currencyPositivePattern: "{0} $", numberGroupSizes: [3], numberDecimalDigits: 2, numberDecimalSeparator: ",", numberGroupSeparator: "." }, { amDesignator: "", pmDesignator: "", dateSeparator: ".", timeSeparator: ":", gmtDateTimePattern: "ddd, dd MMM yyyy HH':'mm':'ss 'GMT'", universalDateTimePattern: "yyyy'-'MM'-'dd HH':'mm':'ss'Z'", sortableDateTimePattern: "yyyy'-'MM'-'dd'T'HH':'mm':'ss", dateTimePattern: "dddd, d. MMMM yyyy HH:mm:ss", longDatePattern: "dddd, d. MMMM yyyy", shortDatePattern: "dd.MM.yyyy", longTimePattern: "HH:mm:ss", shortTimePattern: "HH:mm", yearMonthPattern: "MMMM yyyy", firstDayOfWeek: 1, dayNames: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"], shortDayNames: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"], minimizedDayNames: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"], monthNames: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember", ""], shortMonthNames: ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez", ""] });
CultureInfo.cultures["en-GB"] = new CultureInfo("en-GB", { naNSymbol: "NaN", negativeSign: "-", positiveSign: "+", negativeInfinityText: "-∞", positiveInfinityText: "∞", percentSymbol: "%", percentGroupSizes: [3], percentDecimalDigits: 2, percentDecimalSeparator: ".", percentGroupSeparator: ",", percentPositivePattern: "{0}%", percentNegativePattern: "-{0}%", currencySymbol: "£", currencyGroupSizes: [3], currencyDecimalDigits: 2, currencyDecimalSeparator: ".", currencyGroupSeparator: ",", currencyNegativePattern: "-${0}", currencyPositivePattern: "${0}", numberGroupSizes: [3], numberDecimalDigits: 2, numberDecimalSeparator: ".", numberGroupSeparator: "," }, { amDesignator: "AM", pmDesignator: "PM", dateSeparator: "/", timeSeparator: ":", gmtDateTimePattern: "ddd, dd MMM yyyy HH':'mm':'ss 'GMT'", universalDateTimePattern: "yyyy'-'MM'-'dd HH':'mm':'ss'Z'", sortableDateTimePattern: "yyyy'-'MM'-'dd'T'HH':'mm':'ss", dateTimePattern: "dd MMMM yyyy HH:mm:ss", longDatePattern: "dd MMMM yyyy", shortDatePattern: "dd/MM/yyyy", longTimePattern: "HH:mm:ss", shortTimePattern: "HH:mm", yearMonthPattern: "MMMM yyyy", firstDayOfWeek: 1, dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], shortDayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], minimizedDayNames: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"], monthNames: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", ""], shortMonthNames: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", ""] });
CultureInfo.cultures["en-US"] = new CultureInfo("en-US", { naNSymbol: "NaN", negativeSign: "-", positiveSign: "+", negativeInfinityText: "-∞", positiveInfinityText: "∞", percentSymbol: "%", percentGroupSizes: [3], percentDecimalDigits: 2, percentDecimalSeparator: ".", percentGroupSeparator: ",", percentPositivePattern: "{0} %", percentNegativePattern: "-{0} %", currencySymbol: "$", currencyGroupSizes: [3], currencyDecimalDigits: 2, currencyDecimalSeparator: ".", currencyGroupSeparator: ",", currencyNegativePattern: "(${0})", currencyPositivePattern: "${0}", numberGroupSizes: [3], numberDecimalDigits: 2, numberDecimalSeparator: ".", numberGroupSeparator: "," }, { amDesignator: "AM", pmDesignator: "PM", dateSeparator: "/", timeSeparator: ":", gmtDateTimePattern: "ddd, dd MMM yyyy HH':'mm':'ss 'GMT'", universalDateTimePattern: "yyyy'-'MM'-'dd HH':'mm':'ss'Z'", sortableDateTimePattern: "yyyy'-'MM'-'dd'T'HH':'mm':'ss", dateTimePattern: "dddd, MMMM d, yyyy h:mm:ss tt", longDatePattern: "dddd, MMMM d, yyyy", shortDatePattern: "MM/dd/yyyy", longTimePattern: "h:mm:ss tt", shortTimePattern: "h:mm tt", yearMonthPattern: "MMMM yyyy", firstDayOfWeek: 0, dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], shortDayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], minimizedDayNames: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"], monthNames: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", ""], shortMonthNames: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", ""] });
CultureInfo.cultures["es-ES"] = new CultureInfo("es-ES", { naNSymbol: "NaN", negativeSign: "-", positiveSign: "+", negativeInfinityText: "-∞", positiveInfinityText: "∞", percentSymbol: "%", percentGroupSizes: [3], percentDecimalDigits: 2, percentDecimalSeparator: ",", percentGroupSeparator: ".", percentPositivePattern: "{0} %", percentNegativePattern: "-{0} %", currencySymbol: "€", currencyGroupSizes: [3], currencyDecimalDigits: 2, currencyDecimalSeparator: ",", currencyGroupSeparator: ".", currencyNegativePattern: "-{0} $", currencyPositivePattern: "{0} $", numberGroupSizes: [3], numberDecimalDigits: 2, numberDecimalSeparator: ",", numberGroupSeparator: "." }, { amDesignator: "", pmDesignator: "", dateSeparator: "/", timeSeparator: ":", gmtDateTimePattern: "ddd, dd MMM yyyy HH':'mm':'ss 'GMT'", universalDateTimePattern: "yyyy'-'MM'-'dd HH':'mm':'ss'Z'", sortableDateTimePattern: "yyyy'-'MM'-'dd'T'HH':'mm':'ss", dateTimePattern: "dddd, d' de 'MMMM' de 'yyyy H:mm:ss", longDatePattern: "dddd, d' de 'MMMM' de 'yyyy", shortDatePattern: "dd/MM/yyyy", longTimePattern: "H:mm:ss", shortTimePattern: "H:mm", yearMonthPattern: "MMMM' de 'yyyy", firstDayOfWeek: 1, dayNames: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"], shortDayNames: ["do.", "lu.", "ma.", "mi.", "ju.", "vi.", "sá."], minimizedDayNames: ["D", "L", "M", "X", "J", "V", "S"], monthNames: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre", ""], shortMonthNames: ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic.", ""] });
CultureInfo.cultures["fr-BE"] = new CultureInfo("fr-BE", { naNSymbol: "NaN", negativeSign: "-", positiveSign: "+", negativeInfinityText: "-∞", positiveInfinityText: "∞", percentSymbol: "%", percentGroupSizes: [3], percentDecimalDigits: 2, percentDecimalSeparator: ",", percentGroupSeparator: ".", percentPositivePattern: "{0} %", percentNegativePattern: "-{0} %", currencySymbol: "€", currencyGroupSizes: [3], currencyDecimalDigits: 2, currencyDecimalSeparator: ",", currencyGroupSeparator: ".", currencyNegativePattern: "-{0} $", currencyPositivePattern: "{0} $", numberGroupSizes: [3], numberDecimalDigits: 2, numberDecimalSeparator: ",", numberGroupSeparator: "." }, { amDesignator: "", pmDesignator: "", dateSeparator: "-", timeSeparator: ":", gmtDateTimePattern: "ddd, dd MMM yyyy HH':'mm':'ss 'GMT'", universalDateTimePattern: "yyyy'-'MM'-'dd HH':'mm':'ss'Z'", sortableDateTimePattern: "yyyy'-'MM'-'dd'T'HH':'mm':'ss", dateTimePattern: "dddd d MMMM yyyy HH:mm:ss", longDatePattern: "dddd d MMMM yyyy", shortDatePattern: "dd-MM-yyyy", longTimePattern: "HH:mm:ss", shortTimePattern: "HH:mm", yearMonthPattern: "MMMM yyyy", firstDayOfWeek: 1, dayNames: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"], shortDayNames: ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."], minimizedDayNames: ["di", "lu", "ma", "me", "je", "ve", "sa"], monthNames: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre", ""], shortMonthNames: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc.", ""] });
CultureInfo.cultures["fr-FR"] = new CultureInfo("fr-FR", { naNSymbol: "NaN", negativeSign: "-", positiveSign: "+", negativeInfinityText: "-∞", positiveInfinityText: "∞", percentSymbol: "%", percentGroupSizes: [3], percentDecimalDigits: 2, percentDecimalSeparator: ",", percentGroupSeparator: " ", percentPositivePattern: "{0} %", percentNegativePattern: "-{0} %", currencySymbol: "€", currencyGroupSizes: [3], currencyDecimalDigits: 2, currencyDecimalSeparator: ",", currencyGroupSeparator: " ", currencyNegativePattern: "-{0} $", currencyPositivePattern: "{0} $", numberGroupSizes: [3], numberDecimalDigits: 2, numberDecimalSeparator: ",", numberGroupSeparator: " " }, { amDesignator: "", pmDesignator: "", dateSeparator: "/", timeSeparator: ":", gmtDateTimePattern: "ddd, dd MMM yyyy HH':'mm':'ss 'GMT'", universalDateTimePattern: "yyyy'-'MM'-'dd HH':'mm':'ss'Z'", sortableDateTimePattern: "yyyy'-'MM'-'dd'T'HH':'mm':'ss", dateTimePattern: "dddd d MMMM yyyy HH:mm:ss", longDatePattern: "dddd d MMMM yyyy", shortDatePattern: "dd/MM/yyyy", longTimePattern: "HH:mm:ss", shortTimePattern: "HH:mm", yearMonthPattern: "MMMM yyyy", firstDayOfWeek: 1, dayNames: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"], shortDayNames: ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."], minimizedDayNames: ["di", "lu", "ma", "me", "je", "ve", "sa"], monthNames: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre", ""], shortMonthNames: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc.", ""] });
CultureInfo.cultures["it-IT"] = new CultureInfo("it-IT", { naNSymbol: "NaN", negativeSign: "-", positiveSign: "+", negativeInfinityText: "-∞", positiveInfinityText: "∞", percentSymbol: "%", percentGroupSizes: [3], percentDecimalDigits: 2, percentDecimalSeparator: ",", percentGroupSeparator: ".", percentPositivePattern: "{0}%", percentNegativePattern: "-{0}%", currencySymbol: "€", currencyGroupSizes: [3], currencyDecimalDigits: 2, currencyDecimalSeparator: ",", currencyGroupSeparator: ".", currencyNegativePattern: "-$ {0}", currencyPositivePattern: "$ {0}", numberGroupSizes: [3], numberDecimalDigits: 2, numberDecimalSeparator: ",", numberGroupSeparator: "." }, { amDesignator: "", pmDesignator: "", dateSeparator: "/", timeSeparator: ":", gmtDateTimePattern: "ddd, dd MMM yyyy HH':'mm':'ss 'GMT'", universalDateTimePattern: "yyyy'-'MM'-'dd HH':'mm':'ss'Z'", sortableDateTimePattern: "yyyy'-'MM'-'dd'T'HH':'mm':'ss", dateTimePattern: "dddd d MMMM yyyy HH:mm:ss", longDatePattern: "dddd d MMMM yyyy", shortDatePattern: "dd/MM/yyyy", longTimePattern: "HH:mm:ss", shortTimePattern: "HH:mm", yearMonthPattern: "MMMM yyyy", firstDayOfWeek: 1, dayNames: ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"], shortDayNames: ["dom", "lun", "mar", "mer", "gio", "ven", "sab"], minimizedDayNames: ["do", "lu", "ma", "me", "gi", "ve", "sa"], monthNames: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre", ""], shortMonthNames: ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic", ""] });
CultureInfo.cultures["ja-JP"] = new CultureInfo("ja-JP", { naNSymbol: "NaN", negativeSign: "-", positiveSign: "+", negativeInfinityText: "-∞", positiveInfinityText: "∞", percentSymbol: "%", percentGroupSizes: [3], percentDecimalDigits: 2, percentDecimalSeparator: ".", percentGroupSeparator: ",", percentPositivePattern: "{0}%", percentNegativePattern: "-{0}%", currencySymbol: "¥", currencyGroupSizes: [3], currencyDecimalDigits: 0, currencyDecimalSeparator: ".", currencyGroupSeparator: ",", currencyNegativePattern: "-${0}", currencyPositivePattern: "${0}", numberGroupSizes: [3], numberDecimalDigits: 2, numberDecimalSeparator: ".", numberGroupSeparator: "," }, { amDesignator: "午前", pmDesignator: "午後", dateSeparator: "/", timeSeparator: ":", gmtDateTimePattern: "ddd, dd MMM yyyy HH':'mm':'ss 'GMT'", universalDateTimePattern: "yyyy'-'MM'-'dd HH':'mm':'ss'Z'", sortableDateTimePattern: "yyyy'-'MM'-'dd'T'HH':'mm':'ss", dateTimePattern: "yyyy'年'M'月'd'日' H:mm:ss", longDatePattern: "yyyy'年'M'月'd'日'", shortDatePattern: "yyyy/MM/dd", longTimePattern: "H:mm:ss", shortTimePattern: "H:mm", yearMonthPattern: "yyyy'年'M'月'", firstDayOfWeek: 0, dayNames: ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"], shortDayNames: ["日", "月", "火", "水", "木", "金", "土"], minimizedDayNames: ["日", "月", "火", "水", "木", "金", "土"], monthNames: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", ""], shortMonthNames: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", ""] });
CultureInfo.cultures["nl-BE"] = new CultureInfo("nl-BE", { naNSymbol: "NaN", negativeSign: "-", positiveSign: "+", negativeInfinityText: "-∞", positiveInfinityText: "∞", percentSymbol: "%", percentGroupSizes: [3], percentDecimalDigits: 2, percentDecimalSeparator: ",", percentGroupSeparator: " ", percentPositivePattern: "{0}%", percentNegativePattern: "-{0}%", currencySymbol: "€", currencyGroupSizes: [3], currencyDecimalDigits: 2, currencyDecimalSeparator: ",", currencyGroupSeparator: ".", currencyNegativePattern: "$ -{0}", currencyPositivePattern: "$ {0}", numberGroupSizes: [3], numberDecimalDigits: 2, numberDecimalSeparator: ",", numberGroupSeparator: " " }, { amDesignator: "", pmDesignator: "", dateSeparator: "/", timeSeparator: ":", gmtDateTimePattern: "ddd, dd MMM yyyy HH':'mm':'ss 'GMT'", universalDateTimePattern: "yyyy'-'MM'-'dd HH':'mm':'ss'Z'", sortableDateTimePattern: "yyyy'-'MM'-'dd'T'HH':'mm':'ss", dateTimePattern: "dddd d MMMM yyyy H:mm:ss", longDatePattern: "dddd d MMMM yyyy", shortDatePattern: "dd/MM/yyyy", longTimePattern: "H:mm:ss", shortTimePattern: "H:mm", yearMonthPattern: "MMMM yyyy", firstDayOfWeek: 1, dayNames: ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"], shortDayNames: ["zo", "ma", "di", "wo", "do", "vr", "za"], minimizedDayNames: ["zo", "ma", "di", "wo", "do", "vr", "za"], monthNames: ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december", ""], shortMonthNames: ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec", ""] });
CultureInfo.cultures["nl-NL"] = new CultureInfo("nl-NL", { naNSymbol: "NaN", negativeSign: "-", positiveSign: "+", negativeInfinityText: "-∞", positiveInfinityText: "∞", percentSymbol: "%", percentGroupSizes: [3], percentDecimalDigits: 2, percentDecimalSeparator: ",", percentGroupSeparator: ".", percentPositivePattern: "{0} %", percentNegativePattern: "-{0} %", currencySymbol: "€", currencyGroupSizes: [3], currencyDecimalDigits: 2, currencyDecimalSeparator: ",", currencyGroupSeparator: ".", currencyNegativePattern: "$ -{0}", currencyPositivePattern: "$ {0}", numberGroupSizes: [3], numberDecimalDigits: 2, numberDecimalSeparator: ",", numberGroupSeparator: "." }, { amDesignator: "", pmDesignator: "", dateSeparator: "-", timeSeparator: ":", gmtDateTimePattern: "ddd, dd MMM yyyy HH':'mm':'ss 'GMT'", universalDateTimePattern: "yyyy'-'MM'-'dd HH':'mm':'ss'Z'", sortableDateTimePattern: "yyyy'-'MM'-'dd'T'HH':'mm':'ss", dateTimePattern: "dddd d MMMM yyyy HH:mm:ss", longDatePattern: "dddd d MMMM yyyy", shortDatePattern: "dd-MM-yyyy", longTimePattern: "HH:mm:ss", shortTimePattern: "HH:mm", yearMonthPattern: "MMMM yyyy", firstDayOfWeek: 1, dayNames: ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"], shortDayNames: ["zo", "ma", "di", "wo", "do", "vr", "za"], minimizedDayNames: ["zo", "ma", "di", "wo", "do", "vr", "za"], monthNames: ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december", ""], shortMonthNames: ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec", ""] });
CultureInfo.cultures["pt-PT"] = new CultureInfo("pt-PT", { naNSymbol: "NaN", negativeSign: "-", positiveSign: "+", negativeInfinityText: "-∞", positiveInfinityText: "∞", percentSymbol: "%", percentGroupSizes: [3], percentDecimalDigits: 2, percentDecimalSeparator: ",", percentGroupSeparator: " ", percentPositivePattern: "{0}%", percentNegativePattern: "-{0}%", currencySymbol: "€", currencyGroupSizes: [3], currencyDecimalDigits: 2, currencyDecimalSeparator: ",", currencyGroupSeparator: " ", currencyNegativePattern: "-{0} $", currencyPositivePattern: "{0} $", numberGroupSizes: [3], numberDecimalDigits: 2, numberDecimalSeparator: ",", numberGroupSeparator: " " }, { amDesignator: "", pmDesignator: "", dateSeparator: "/", timeSeparator: ":", gmtDateTimePattern: "ddd, dd MMM yyyy HH':'mm':'ss 'GMT'", universalDateTimePattern: "yyyy'-'MM'-'dd HH':'mm':'ss'Z'", sortableDateTimePattern: "yyyy'-'MM'-'dd'T'HH':'mm':'ss", dateTimePattern: "d' de 'MMMM' de 'yyyy HH:mm:ss", longDatePattern: "d' de 'MMMM' de 'yyyy", shortDatePattern: "dd/MM/yyyy", longTimePattern: "HH:mm:ss", shortTimePattern: "HH:mm", yearMonthPattern: "MMMM' de 'yyyy", firstDayOfWeek: 0, dayNames: ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"], shortDayNames: ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"], minimizedDayNames: ["D", "S", "T", "Q", "Q", "S", "S"], monthNames: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro", ""], shortMonthNames: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez", ""] });
CultureInfo.cultures["zh-CHS"] = new CultureInfo("zh-CHS", { naNSymbol: "NaN", negativeSign: "-", positiveSign: "+", negativeInfinityText: "-∞", positiveInfinityText: "∞", percentSymbol: "%", percentGroupSizes: [3], percentDecimalDigits: 2, percentDecimalSeparator: ".", percentGroupSeparator: ",", percentPositivePattern: "{0}%", percentNegativePattern: "-{0}%", currencySymbol: "¥", currencyGroupSizes: [3], currencyDecimalDigits: 2, currencyDecimalSeparator: ".", currencyGroupSeparator: ",", currencyNegativePattern: "$-{0}", currencyPositivePattern: "${0}", numberGroupSizes: [3], numberDecimalDigits: 2, numberDecimalSeparator: ".", numberGroupSeparator: "," }, { amDesignator: "上午", pmDesignator: "下午", dateSeparator: "/", timeSeparator: ":", gmtDateTimePattern: "ddd, dd MMM yyyy HH':'mm':'ss 'GMT'", universalDateTimePattern: "yyyy'-'MM'-'dd HH':'mm':'ss'Z'", sortableDateTimePattern: "yyyy'-'MM'-'dd'T'HH':'mm':'ss", dateTimePattern: "yyyy'年'M'月'd'日' H:mm:ss", longDatePattern: "yyyy'年'M'月'd'日'", shortDatePattern: "yyyy/MM/dd", longTimePattern: "H:mm:ss", shortTimePattern: "H:mm", yearMonthPattern: "yyyy'年'M'月'", firstDayOfWeek: 1, dayNames: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"], shortDayNames: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"], minimizedDayNames: ["日", "一", "二", "三", "四", "五", "六"], monthNames: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月", ""], shortMonthNames: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", ""] });
CultureInfo.currentCulture = CultureInfo.invariantCulture = CultureInfo.cultures[""];