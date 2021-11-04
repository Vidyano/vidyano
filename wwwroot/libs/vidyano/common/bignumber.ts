import { BigNumber } from "bignumber.js"
import String from "./string.js"
import { CultureInfo } from "../cultures.js";

declare module "bignumber.js" {
    export interface BigNumber {
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

BigNumber.prototype.format = Number.prototype.format = function Number$format(format) {
    if (format == null || (format.length == 0) || (format == 'i')) {
        format = 'G';
    }
    return _netFormat(this, format, false);
};

BigNumber.prototype.localeFormat = Number.prototype.localeFormat = function Number$localeFormat(format) {
    if (format == null || (format.length == 0) || (format == 'i')) {
        format = 'G';
    }
    return _netFormat(this, format, true);
};

BigNumber.prototype.toLocaleString = Number.prototype.toLocaleString = function () {
    return this.localeFormat();
};

function _commaFormat(number, groups, decimal, comma) {
    var decimalPart = null;
    var decimalIndex = number.indexOf(decimal);
    if (decimalIndex > 0) {
        decimalPart = number.substr(decimalIndex);
        number = number.substr(0, decimalIndex);
    }

    var negative = number.startsWith('-');
    if (negative) {
        number = number.substr(1);
    }

    var groupIndex = 0;
    var groupSize = groups[groupIndex];
    if (number.length < groupSize) {
		if (negative) {
			number = '-' + number;
		}

        return decimalPart ? number + decimalPart : number;
    }

    var index = number.length;
    var s = '';
    var done = false;
    while (!done) {
        var length = groupSize;
        var startIndex = index - length;
        if (startIndex < 0) {
            groupSize += startIndex;
            length += startIndex;
            startIndex = 0;
            done = true;
        }
        if (!length) {
            break;
        }

        var part = number.substr(startIndex, length);
        if (s.length) {
            s = part + comma + s;
        }
        else {
            s = part;
        }
        index -= length;

        if (groupIndex < groups.length - 1) {
            groupIndex++;
            groupSize = groups[groupIndex];
        }
    }

    if (negative) {
        s = '-' + s;
    }
    return decimalPart ? s + decimalPart : s;
};

function _netFormat(value: number, format: string, useLocale: boolean) {
    var nf = useLocale ? CultureInfo.currentCulture.numberFormat : CultureInfo.invariantCulture.numberFormat;

    var s = '';
    var precision = -1;

    if (format.length > 1) {
        precision = parseInt(format.substr(1), 10);
    }

    var fs = format.charAt(0);
    switch (fs) {
        case 'd':
        case 'D':
            s = parseInt(Math.abs(value).toString()).toString();
            if (precision != -1) {
                s = s.padLeft(precision, '0');
            }
            if (this < 0) {
                s = '-' + s;
            }
            break;
        case 'x':
        case 'X':
            s = parseInt(Math.abs(value).toString()).toString(16);
            if (fs == 'X') {
                s = s.toUpperCase();
            }
            if (precision != -1) {
                s = s.padLeft(precision, '0');
            }
            break;
        case 'e':
        case 'E':
            if (precision == -1) {
                s = this.toExponential();
            }
            else {
                s = this.toExponential(precision);
            }
            if (fs == 'E') {
                s = s.toUpperCase();
            }
            break;
        case 'f':
        case 'F':
        case 'n':
        case 'N':
            if (precision == -1) {
                precision = nf.numberDecimalDigits;
            }
            s = this.toFixed(precision).toString();
            if (precision && (nf.numberDecimalSeparator != '.')) {
                var idx = s.indexOf('.');
                s = s.substr(0, idx) + nf.numberDecimalSeparator + s.substr(idx + 1);
            }
            if ((fs == 'n') || (fs == 'N')) {
                s = _commaFormat(s, nf.numberGroupSizes, nf.numberDecimalSeparator, nf.numberGroupSeparator);
            }
            break;
        case 'c':
        case 'C':
            if (precision == -1) {
                precision = nf.currencyDecimalDigits;
            }
            s = Math.abs(this).toFixed(precision).toString();
            if (precision && (nf.currencyDecimalSeparator != '.')) {
                var i = s.indexOf('.');
                s = s.substr(0, i) + nf.currencyDecimalSeparator + s.substr(i + 1);
            }
            s = _commaFormat(s, nf.currencyGroupSizes, nf.currencyDecimalSeparator, nf.currencyGroupSeparator);
            if (this < 0) {
                s = String.format(nf.currencyNegativePattern, s);
            }
            else {
                s = String.format(nf.currencyPositivePattern, s);
            }
            if (nf.currencySymbol != "$")
                s = s.replace("$", nf.currencySymbol);
            break;
        case 'p':
        case 'P':
            if (precision == -1) {
                precision = nf.percentDecimalDigits;
            }
            s = (Math.abs(this) * 100.0).toFixed(precision).toString();
            if (precision && (nf.percentDecimalSeparator != '.')) {
                var index = s.indexOf('.');
                s = s.substr(0, index) + nf.percentDecimalSeparator + s.substr(index + 1);
            }
            s = _commaFormat(s, nf.percentGroupSizes, nf.percentDecimalSeparator, nf.percentGroupSeparator);
            if (this < 0) {
                s = String.format(nf.percentNegativePattern, s);
            }
            else {
                s = String.format(nf.percentPositivePattern, s);
            }
            break;
        case 'g':
        case 'G':
            if (precision == -1)
                precision = 10;

            if (Math.floor(this) == this)
                s = this.toString();
            else
                s = this._netFormat("F" + precision, useLocale).trimEnd('0');
            break;
    }

    return s;
};