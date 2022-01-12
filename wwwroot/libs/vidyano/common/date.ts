import { CultureInfo } from "./../cultures.js";
import String from "./string.js";

declare global {
    export interface Date {
        format(format: string): string;
        localeFormat(format: string, useDefault: boolean): string;
        netType(value: string);
        netType(): string;
        netOffset(value: string);
        netOffset(): string;
    }
}

const _formatRE = /'.*?[^\\]'|dddd|ddd|dd|d|MMMM|MMM|MM|M|yyyy|yy|y|hh|h|HH|H|mm|m|ss|s|tt|t|fff|ff|f|zzz|zz|z/g;

Date.prototype.format = function(format: string) {
    if (format == null || (format.length == 0) || (format == 'i')) {
        format = 'G';
    }
    else if (format == 'id') {
        return this.toDateString();
    }
    else if (format == 'it') {
        return this.toTimeString();
    }

    return this._netFormat(format, false);
};

Date.prototype.localeFormat = function(format: string, useDefault: boolean): string {
    if (format == null || (format.length == 0) || (format == 'i')) {
        format = 'G';
    }
    else if (format == 'id') {
        return this.toLocaleDateString();
    }
    else if (format == 'it') {
        return this.toLocaleTimeString();
    }

    return this._netFormat(format, true);
};

Date.prototype["_netFormat"] = function(format, useLocale) {
    var dt = this;
    var dtf = useLocale ? CultureInfo.currentCulture.dateFormat : CultureInfo.invariantCulture.dateFormat;

    if (format.length == 1) {
        switch (format) {
            case 'f':
                format = dtf.longDatePattern + ' ' + dtf.shortTimePattern;
                break;
            case 'F':
                format = dtf.dateTimePattern;
                break;
            case 'd':
                format = dtf.shortDatePattern;
                break;
            case 'D':
                format = dtf.longDatePattern;
                break;
            case 't':
                format = dtf.shortTimePattern;
                break;
            case 'T':
                format = dtf.longTimePattern;
                break;
            case 'g':
                format = dtf.shortDatePattern + ' ' + dtf.shortTimePattern;
                break;
            case 'G':
                format = dtf.shortDatePattern + ' ' + dtf.longTimePattern;
                break;
            case 'R':
            case 'r':
                dtf = CultureInfo.invariantCulture.dateFormat;
                format = dtf.gmtDateTimePattern;
                break;
            case 'u':
                format = dtf.universalDateTimePattern;
                break;
            case 'U':
                format = dtf.dateTimePattern;
                dt = new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(),
                dt.getUTCHours(), dt.getUTCMinutes(), dt.getUTCSeconds(), dt.getUTCMilliseconds());
                break;
            case 's':
                format = dtf.sortableDateTimePattern;
                break;
            case 'y':
            case 'Y':
                format = dtf.yearMonthPattern;
                break;
        }
    }

    if (format.charAt(0) == '%') {
        format = format.substr(1);
    }

    var re = _formatRE;
    var sb = '';

    re.lastIndex = 0;
    while (true) {
        var index = re.lastIndex;
        var match = re.exec(format);

        sb += format.slice(index, match ? match.index : format.length);
        if (!match) {
            break;
        }

        var fs = match[0];
        var part = fs;
        switch (fs) {
            case 'dddd':
                part = dtf.dayNames[dt.getDay()];
                break;
            case 'ddd':
                part = dtf.shortDayNames[dt.getDay()];
                break;
            case 'dd':
                part = ("00" + dt.getDate()).substr(-2);
                break;
            case 'd':
                part = dt.getDate();
                break;
            case 'MMMM':
                part = dtf.monthNames[dt.getMonth()];
                break;
            case 'MMM':
                part = dtf.shortMonthNames[dt.getMonth()];
                break;
            case 'MM':
                part = ("00" + (dt.getMonth() + 1)).substr(-2);
                break;
            case 'M':
                part = (dt.getMonth() + 1);
                break;
            case 'yyyy':
                part = dt.getFullYear();
                break;
            case 'yy':
                part = ("00" + (dt.getFullYear() % 100)).substr(-2);
                break;
            case 'y':
                part = (dt.getFullYear() % 100).toString();
                break;
            case 'h':
            case 'hh':
                part = (dt.getHours() % 12).toString();
                if (part === "0") {
                    part = '12';
                }
                else if (fs == 'hh') {
                    part = ("00" + part).substr(-2);
                }
                break;
            case 'HH':
                part = ("00" + dt.getHours()).substr(-2);
                break;
            case 'H':
                part = dt.getHours();
                break;
            case 'mm':
                part = ("00" + dt.getMinutes()).substr(-2);
                break;
            case 'm':
                part = dt.getMinutes();
                break;
            case 'ss':
                part = ("00" + dt.getSeconds()).substr(-2);
                break;
            case 's':
                part = dt.getSeconds();
                break;
            case 't':
            case 'tt':
                part = (dt.getHours() < 12) ? dtf.amDesignator : dtf.pmDesignator;
                if (fs == 't') {
                    part = part.charAt(0);
                }
                break;
            case 'fff':
                part = ("000" + dt.getMilliseconds()).substr(-3);
                break;
            case 'ff':
                part = ("000" + dt.getMilliseconds()).substr(-3).substr(0, 2);
                break;
            case 'f':
                part = ("000" + dt.getMilliseconds()).substr(-3).charAt(0);
                break;
            case 'z': {
                const offset = dt.getTimezoneOffset() / 60;
                part = ((offset >= 0) ? '-' : '+') + Math.floor(Math.abs(offset));
                break;
            }
            case 'zz':
            case 'zzz': {
                const offset = dt.getTimezoneOffset() / 60;
                part = ((offset >= 0) ? '-' : '+') + ("00" + Math.floor(Math.abs(offset))).substr(-2);
                if (fs == 'zzz') {
                    part += dtf.timeSeparator + ("00" + Math.abs(dt.getTimezoneOffset() % 60)).substr(-2);
                }
                break;
            }
            default:
                if (part.charAt(0) == '\'') {
                    part = part.substr(1, part.length - 2).replace(/\\'/g, '\'');
                }
                break;
        }
        sb += part;
    }

    return sb;
};

Date.prototype.toLocaleString = function () {
    return this.localeFormat();
};

Date.prototype.netType = function(value?: string) {
    if (typeof (value) == "undefined")
        return this._netType || "DateTime";

    this._netType = value;
    return this;
};

Date.prototype.netOffset = function(value?: string) {
    if (typeof (value) == "undefined")
        return this._netOffset || (this._netOffset = String.format("{0:d2}:{1:d2}", Math.round(this.getTimezoneOffset() / 60), Math.abs(this.getTimezoneOffset() % 60)));

    this._netOffset = value;
    return this;
};

export default Date;