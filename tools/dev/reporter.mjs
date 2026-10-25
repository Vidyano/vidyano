import path from 'path';
import { marker } from './protocol.mjs';

const ansi = /\x1b\[[0-9;?]*[A-Za-z]/g;

function emit(event) {
    process.stdout.write(`${marker}${JSON.stringify(event)}\n`);
}

function relative(file) {
    return path.relative(process.cwd(), file).replaceAll('\\', '/');
}

function location(value) {
    return value && { file: relative(value.file), line: value.line, column: value.column };
}

function error(value) {
    return { message: (value.message ?? value.value ?? '').replace(ansi, ''), location: location(value.location) };
}

export default class DevReporter {
    printsToStdio() {
        return false;
    }

    onBegin(config, suite) {
        emit({ type: 'begin', tests: suite.allTests().map(test => ({ id: test.id, title: test.titlePath().slice(3).join(' › '), ...location(test.location) })) });
    }

    onTestBegin(test) {
        emit({ type: 'test-begin', id: test.id });
    }

    onTestEnd(test, result) {
        emit({ type: 'test-end', id: test.id, outcome: test.outcome(), status: result.status, duration: result.duration, errors: result.errors.map(error) });
    }

    onError(value) {
        emit({ type: 'error', error: error(value) });
    }
}
