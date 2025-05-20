export class ExpressionParser {
    static readonly alwaysTrue = function () { return true; };
    private static _cache = {};
    private static _operands = ["<=", ">=", "<", ">", "!=", "="];

    static get(expression: string) {
        if (!expression || !expression.trim())
            return this.alwaysTrue;

        expression = expression.replace(/ /g, "").toUpperCase();
        var result = this._cache[expression];
        if (result == null)
            return this._cache[expression] = ExpressionParser.parse(expression);
        return result;
    }

    static parse(expression: string) {
        var operands = this._operands;

        var parts = expression.split('X');
        if (parts.length > 1) {
            // Combine parts
            var result = null;
            for (var i = 0; i < parts.length; i++) {
                var part = parts[i];

                var newResult = this.get(part);
                if (result != null) {
                    var previousResult = result;
                    result = function (arg) { return previousResult(arg) && newResult(arg); };
                }
                else
                    result = newResult;
            }
            return result;
        }

        if (expression != parts[0])
            return this.get(parts[0]);

        // Get operand
        for (var idx = 0; idx < operands.length; idx++) {
            var operand = operands[idx];

            var index = expression.indexOf(operand);
            if (index >= 0) {
                expression = expression.replace(operand, "");
                if (index > 0) {
                    // NOTE: Change 5< to >5
                    if (operand.includes("<"))
                        return this.get(operand.replace("<", ">") + expression);
                    if (operand.includes(">"))
                        return this.get(operand.replace(">", "<") + expression);
                }

                var number = parseInt(expression, 10);
                if (!isNaN(number)) {
                    switch (operand) {
                        case "<":
                            return new Function("x", "return x < " + number + ";");
                        case "<=":
                            return new Function("x", "return x <= " + number + ";");
                        case ">":
                            return new Function("x", "return x > " + number + ";");
                        case ">=":
                            return new Function("x", "return x >= " + number + ";");
                        case "!=":
                            return new Function("x", "return x != " + number + ";");
                        default:
                            return new Function("x", "return x == " + number + ";");
                    }
                }
            }
        }

        return this.alwaysTrue;
    }
}
