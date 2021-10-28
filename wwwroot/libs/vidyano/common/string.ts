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

String.prototype.contains = function(it: string) {
    return this.indexOf(it) != -1;
};

String.prototype.padLeft = function(totalWidth: number, ch: string) {
    if (this.length < totalWidth) {
        return String.fromChar(ch || ' ', totalWidth - this.length) + this;
    }
    return this.substring(0, this.length);
};

String.prototype.padRight = function(totalWidth: number, ch?: string) {
    if (this.length < totalWidth) {
        return this + String.fromChar(ch || ' ', totalWidth - this.length);
    }
    return this.substring(0, this.length);
};

const trimStart = String.prototype.trimStart;
String.prototype.trimStart = <any>function(ch?: string) {
    if (!ch || !this.length)
        return trimStart.apply(this);

    ch = ch || ' ';
    var i = 0;
    for (; this.charAt(i) == ch && i < this.length; i++);
    return this.substring(i);
};

const trimEnd = String.prototype.trimEnd;
String.prototype.trimEnd = <any>function(ch?: string) {
    if (!ch || !this.length)
        return trimEnd.apply(this);

    ch = ch ? ch : ' ';
    var i = this.length - 1;
    for (; i >= 0 && this.charAt(i) == ch; i--);
    return this.substring(0, i + 1);
};

String.prototype.insert = function(str: string, index: number) {
    var length = this.length;

    if (index == length) {
        return this.substring(0, index) + str;
    }
    return this.substring(0, index) + str + this.substring(index, length);
};

String.prototype.asDataUri = function() {
    if (/^iVBOR/.test(this))
        return "data:image/png;base64," + this;
    if (/^\/9j\//.test(this))
        return "data:image/jpeg;base64," + this;
    if (/^R0lGOD/.test(this))
        return "data:image/gif;base64," + this;
    if (/^Qk/.test(this))
        return "data:image/bmp;base64," + this;
    if (/^PD94/.test(this))
        return "data:image/svg+xml;base64," + this;

    return "";
};

String.prototype.toKebabCase = function() {
    if (!this || this === this.toLowerCase())
        return this;

    var _this = this;
    return Array.from(this as string).map(function(c, i) {
        var cLower = c.toLowerCase();
        if (c === cLower)
            return c;

        if (i === 0)
            return cLower;

        var cPrev = _this[i - 1];
        if (!/^[a-zA-Z]+$/.test(cPrev))
            return cLower;

        var cPrevLower = cPrev.toLowerCase();
        if (cPrev === cPrevLower)
            return "-" + cLower;

        if (i + 1 === _this.length)
            return cLower;

        var cNext = _this[i + 1];
        var cNextUpper = cNext.toUpperCase();
        if (cNext === cNextUpper)
            return cLower;

        return "-" + cLower;
    }).join("");
}

String.prototype.splitWithTail = function(separator: string | RegExp, limit?: number): string[] {
    let pattern: RegExp, startIndex: number, m: RegExpExecArray;
    const parts: string[] = [];
    if (!limit)
        return this.split(separator);
    if (separator instanceof RegExp)
        pattern = new RegExp(separator.source, "g" + (separator.ignoreCase ? "i" : "") + (separator.multiline ? "m" : ""));
    else
        pattern = new RegExp(separator.replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1"), "g");
    do {
        startIndex = pattern.lastIndex;
        if (m = pattern.exec(this)) {
            parts.push(this.substr(startIndex, m.index - startIndex));
        }
    } while (m && parts.length < limit - 1);
    parts.push(this.substr(pattern.lastIndex));
    return parts;
}

String.isNullOrEmpty = function(str: string) {
    return str == null || str.length == 0;
};
    
String.isNullOrWhiteSpace = function(str: string) {
    return str == null || !(/\S/.test(str));
};

const _formatRE = /(\{[^\}^\{]+\})/g;
const _format = function(format: string, values: any[], useLocale: boolean) {
    return format.replace(_formatRE,
        function (str, m) {
            var index = parseInt(m.substr(1), 10);
            var value = values[index + 1];
            if (value == null)
                return '';
            if (value.format) {
                var formatSpec = null;
                var formatIndex = m.indexOf(':');
                if (formatIndex > 0) {
                    formatSpec = m.substring(formatIndex + 1, m.length - 1);
                }
                return useLocale ? value.localeFormat(formatSpec) : value.format(formatSpec);
            }
            else
                return useLocale ? (value.localeFormat ? value.localeFormat() : value.toLocaleString()) : value.toString();
        });
};

String.format = function(format: string, ...args: any[]) {
    return _format(format, args, /* useLocale */true);
};

String.fromChar = function(ch: string, count: number) {
    var s = ch;
    for (var i = 1; i < count; i++) {
        s += ch;
    }
    return s;
};

export default String;