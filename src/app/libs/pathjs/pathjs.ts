import "vidyano/common/array"

export class PathRoutes {
    current: string = null;
    previous: PathRoute = null;
    root: string = null;
    rootPath: string = null;
    rescue: Function = null;
    defined: { [key: string]: PathRoute } = {};
}

export class PathRoute {
    action: Function;
    do_enter: Function[] = [];
    do_exit: Function[] = [];
    params = {};

    constructor(public path: string) {
        Path.routes.defined[path] = this;
    }

    to(fn: Function) {
        this.action = fn;
        return this;
    }

    enter(fns: Function | Function[]) {
        if (fns instanceof Array)
            this.do_enter = this.do_enter.concat(fns);
        else
            this.do_enter.push(fns);

        return this;
    }

    exit(fns: Function | Function[]) {
        if (fns instanceof Array)
            this.do_exit = this.do_exit.concat(fns);
        else
            this.do_exit.push(fns);

        return this;
    }

    partition() {
        const re = /\(([^}]+?)\)/g, parts = [], options = []
        let text;

        while (text = re.exec(this.path))
            parts.push(text[1]);

        options.push(this.path.split("(")[0]);
        for (let i = 0; i < parts.length; i++)
            options.push(options[options.length - 1] + parts[i]);

        return options;
    }

    run() {
        let halt_execution = false, result;

        if (Path.routes.defined[this.path].hasOwnProperty("do_enter")) {
            if (Path.routes.defined[this.path].do_enter.length > 0) {
                for (let i = 0; i < Path.routes.defined[this.path].do_enter.length; i++) {
                    result = Path.routes.defined[this.path].do_enter[i].apply(this, null);
                    if (result === false) {
                        halt_execution = true;
                        break;
                    }
                }
            }
        }
        if (!halt_execution) {
            Path.routes.defined[this.path].action();
        }
    }
}

export class PathHistory {
     // Empty container for "Initial Popstate" checking variables.
    initial = {
        popped: false,
        URL: ""
    };

    noHistory: boolean;

    pushState(state, title, path){
        Path.dispatch(path);
        history.pushState(state, title, this.noHistory ? undefined : path);
    }

    replaceState(state: any, title: string, path: string) {
        Path.dispatch(path);
        history.replaceState(state, title, this.noHistory ? undefined : path);
    }

    popState() {
        var initialPop = !Path.history.initial.popped && location.href == Path.history.initial.URL;
        Path.history.initial.popped = true;
        if(initialPop)
            return;

        Path.dispatch(Path.routes.rootPath ? document.location.href.substr(Path.routes.root.length).replace(document.location.hash, "") : document.location.hash);
    }

    listen() {
        this.initial.popped = ('state' in window.history), this.initial.URL = location.href;
        window.onpopstate = Path.history.popState;
    }
}

export class Path {
    static readonly routes = new PathRoutes();
    static readonly history = new PathHistory();
    private static readonly _splitRegex = /\/|\./g;

    static map(path) {
        if (Path.routes.defined.hasOwnProperty(path)) {
            return Path.routes.defined[path];
        } else {
            return new PathRoute(path);
        }
    }

    static root(path: string) {
        Path.routes.root = path;
    }

    static rescue(fn: Function) {
        Path.routes.rescue = fn;
    }

    static match(path: string, parameterize: boolean) {
        var matchedRoutes = [];

        let route, possible_routes, slice, compare;
        for (route in Path.routes.defined) {
            if (route !== null && route !== undefined) {
                route = Path.routes.defined[route];
                possible_routes = route.partition();
                for (let j = 0; j < possible_routes.length; j++) {
                    const params = {};
                    slice = possible_routes[j];
                    compare = path;
                    if (slice.search(/:/) > 0) {
                        var splittedSlice = slice.split(Path._splitRegex);
                        for (let i = 0; i < splittedSlice.length; i++) {
                            var splittedCompare = slice.search(/\*/) > 0 ? compare.splitWithTail(Path._splitRegex, splittedSlice.length) : compare.split(Path._splitRegex);
                            if ((i < splittedCompare.length) && (splittedSlice[i].charAt(0) === ":")) {
                                params[splittedSlice[i].replace(/:/, '').replace(/\*/, '')] = splittedCompare[i];
                                compare = compare.replace(new RegExp("(\\b|^|\\.|\\/)" + splittedCompare[i].replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&") + "(\\b|$|\\.|\\/)"), "$1" + splittedSlice[i] + "$2");
                            }
                        }
                    }
                    if (slice === compare) {
                        if (parameterize)
                            route.params = params;

                        matchedRoutes.push(route);
                    }
                }
            }
        }

        return matchedRoutes.length > 0 ? matchedRoutes.orderBy(function(r) { return r.params ? Object.keys(r.params).length : 0;})[0] : null;
    }

    static dispatch(passed_route: string) {
        Path.routes.current = passed_route;
        const matched_route = this.match(passed_route, true);

        if (matched_route !== null) {
            matched_route.run();
            return true;
        } else if (Path.routes.rescue !== null)
            Path.routes.rescue();
    }

    static removeRootPath(path: string = ""): string {
        if (path.startsWith(Path.routes.rootPath))
            return path.substr(Path.routes.rootPath.length);

        return path;
    }
}