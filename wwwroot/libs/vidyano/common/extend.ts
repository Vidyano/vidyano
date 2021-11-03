function extend(target: any, ...sources: any[]) {
    var sources = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        sources[_i - 1] = arguments[_i];
    }
    sources.forEach(function (source) {
        for (var key in source) {
            if (source.hasOwnProperty(key))
                target[key] = source[key];
        }
    });
    return target;
}

export { extend }