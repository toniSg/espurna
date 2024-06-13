/*

ESP8266 file system builder

Copyright (C) 2016-2019 by Xose Pérez <xose dot perez at gmail dot com>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

/*eslint quotes: ['error', 'single']*/
/*eslint-env es6*/

// -----------------------------------------------------------------------------
// Dependencies
// -----------------------------------------------------------------------------

const gulp = require('gulp');

const through = require('through2');

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const jsdom = require('jsdom');
const esbuild = require('esbuild');
const htmlmin = require('html-minifier-terser');

const gzip = require('gulp-gzip');
const inline = require('inline-source');
const rename = require('gulp-rename');
const replace = require('gulp-replace');

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

// declare some modules as optional, only to be included for specific builds
const DEFAULT_MODULES = {
    'api': true,
    'cmd': true,
    'curtain': false,
    'dbg': true,
    'dcz': true,
    'garland': false,
    'ha': true,
    'idb': true,
    'led': true,
    'light': false,
    'lightfox': false,
    'local': false,
    'mqtt': true,
    'nofuss': true,
    'ntp': true,
    'ota': true,
    'relay': true,
    'rfb': false,
    'rfm69': false,
    'rpn': true,
    'sch': true,
    'sns': false,
    'thermostat': false,
    'tspk': true,
};

// includes everything (with some exceptions... TODO)
const MODULES_ALL = Object.fromEntries(
    Object.entries(DEFAULT_MODULES).map(
        ([key, _]) => {
            return [key, true];
        }));

// webui_serve target
const MODULES_LOCAL = Object.assign(
    MODULES_ALL,
    {
        'local': true,
    });

// generic output, usually this includes a single module
const NAMED_BUILD = {
    'curtain': 'curtain',
    'garland': 'garland',
    'light': 'light',
    'lightfox': 'lightfox',
    'rfbridge': 'rfb',
    'rfm69': 'rfm69',
    'sensor': 'sns',
    'thermostat': 'thermostat',
};

// input soruces. right now this is an index.html as entrypoint
const SRC_DIR = path.join('html', 'src');

// resulting .html.gz output after inlining and compressing everything
const DATA_DIR = path.join('espurna', 'data');

// .h compiled from the .html.gz, can be used as a u8 blob inside of the firmware
const STATIC_DIR = path.join('espurna', 'static');

// -----------------------------------------------------------------------------
// Methods
// -----------------------------------------------------------------------------

function toMinifiedHtml(options) {
    return through.obj(async function (source, _, callback) {
        if (!source.isNull()) {
            const contents = source.contents.toString();
            source.contents = Buffer.from(
                await htmlmin.minify(contents, options));
        }

        callback(null, source);
    });
}

function safename(name) {
    return path.basename(name).replaceAll('.', '_');
}

function toHeader(name) {
    return through.obj(function (source, _, callback) {
        // generates c++-friendly header output from raw binary data
        let output = `alignas(4) static constexpr uint8_t ${safename(name)}[] PROGMEM = {`;
        for (let i = 0; i < source.contents.length; i++) {
            if (i > 0) { output += ','; }
            if (0 === (i % 20)) { output += '\n'; }
            output += '0x' + ('00' + source.contents[i].toString(16)).slice(-2);
        }
        output += '\n};\n';

        // replace source stream with a different one, also replacing contents
        let dest = source.clone();
        dest.path = `${source.path}.h`;
        dest.contents = Buffer.from(output);

        callback(null, dest);
    });
}

function logSource() {
    return through.obj(function (source, _, callback) {
        console.info(`${path.basename(source.path)}\tsize: ${source.contents.length} bytes`);
        callback(null, source);
    });
}

// by default, gulp.dest preserves stat.*time of the source. which is obviosly bogus here as gulp
// only knows about src/index.html and not about every include happenning through inline-source
function adjustFileStat() {
    return through.obj(function(source, _, callback) {
        const now = new Date();
        source.stat.atime = now;
        source.stat.mtime = now;
        source.stat.ctime = now;
        callback(null, source);
    });
}

// ref. https://github.com/evanw/esbuild/issues/1895
// from our side, html/src/*.mjs (with the exception of index.mjs) require 'init()' call to be actually set up and used
// as the result, no code from the module should be bundled into the output when module was not initialized
// however, since light module depends on iro.js and does not have `sideEffects: false` in package.json, it would still get bundled because of top-level import
// (...and since module modifying something in global scope is not unheard of...)
function forceNoSideEffects() {
    return {
        name: 'no-side-effects',
        setup(build) {
            build.onResolve({filter: /@jaames\/iro/, namespace: 'file'},
                async ({path, ...options}) => {
                    const result = await build.resolve(path, {...options, namespace: 'noRecurse'});
                    return {...result, sideEffects: false};
                });
        },
    };
}

// ref. html/src/index.mjs
// TODO exportable values, e.g. in build.mjs? right now, false-positive of undeclared values, plus see 'forceNoSideEffects()'
function makeDefines(modules) {
    return Object.fromEntries(
        Object.entries(modules).map(
            ([key, value]) => {
                return [`MODULE_${key.toUpperCase()}`, value.toString()];
            }));
}

async function inlineJavascriptBundle(sourcefile, contents, resolveDir, modules, minify) {
    return await esbuild.build({
        stdin: {
            contents,
            loader: 'js',
            resolveDir,
            sourcefile,
        },
        bundle: true,
        plugins: [
            forceNoSideEffects(),
        ],
        define: makeDefines(modules),
        minify,
        platform: 'browser',
        write: false,
    });
}

function inlineHandler(srcdir, modules, compress) {
    return async function(source) {
        // TODO split handlers
        if (source.content) {
            return;
        }

        // specific elements can be excluded at this point
        // (although, could be handled by jsdom afterwards; top elem does not usually have classList w/ module)
        for (let module of source.props?.module?.split(',') ?? []) {
            if (!modules[module]) {
                source.compress = false;
                source.content = Buffer.from('');
                source.replace = '<div></div>';
                return;
            }
        }

        // main entrypoint of the app, usually a script bundle
        if (source.format === 'mjs') {
            const result = await inlineJavascriptBundle(
                source.sourcepath,
                source.fileContent,
                srcdir, modules, compress);
            if (!result.outputFiles.length) {
                callback('cannot build js bundle', null);
                return;
            }

            source.content = Buffer.from(result.outputFiles[0].contents);
            source.compress = false;
            return;
        }

        // <object type=text/html>. not handled by inline-source directly, only image blobs are expected
        if (source.props.raw) {
            source.content = source.fileContent;
            source.replace = source.content.toString();
            source.format = 'text';
            return;
        }

        // TODO import svg icon?
        if (source.sourcepath === 'favicon.ico') {
            source.format = 'x-icon';
            return;
        }
    };
}

function modifyHtml(handlers) {
    return through.obj(function (source, _, callback) {
        const dom = new jsdom.JSDOM(source.contents, {includeNodeLocations: true});

        let changed = false;

        for (let handler of handlers) {
            if (handler(dom)) {
                changed = true;
            }
        }

        if (changed) {
            source.contents = Buffer.from(dom.serialize());
        }

        callback(null, source);
    });
}

// generally a good idea to mitigate "tab-napping" attacks
// per https://www.chromestatus.com/feature/6140064063029248
function externalBlank() {
    /**
     * @param {jsdom.JSDOM} dom
     * @return {boolean}
     */
    return function(dom) {
        let changed = false;

        for (let elem of dom.window.document.getElementsByTagName('a')) {
            if (elem.href.startsWith('http')) {
                elem.setAttribute('target', '_blank');
                elem.setAttribute('rel', 'noopener');
                elem.setAttribute('tabindex', '-1');
                changed = true;
            }
        }

        return changed;
    }
}

// with an explicit list of modules, strip anything not used by the bundle
function stripModules(modules) {
    /**
     * @param {jsdom.JSDOM} dom
     * @return {boolean}
     */
    return function(dom) {
        let changed = false;

        for (const [module, value] of Object.entries(modules)) {
            if (value) {
                continue;
            }

            const className = `module-${module}`;
            for (let elem of dom.window.document.getElementsByClassName(className)) {
                elem.classList.remove(className);

                let remove = true;
                for (let name of elem.classList) {
                    if (name.startsWith('module-')) {
                        remove = false;
                        break;
                    }
                }

                if (remove) {
                    elem.parentElement.removeChild(elem);
                    changed = true;
                }
            }
        }

        return changed;
    }
}

function inlineSource(srcdir, modules, compress) {
    return through.obj(async function (source, _, callback) {
        if (source.isNull()) {
            callback(null, source);
            return;
        }

        const result = await inline.inlineSource(
            source.contents.toString(),
            {
                'compress': compress,
                'handlers': [inlineHandler(srcdir, modules, compress)],
                'rootpath': srcdir,
            });

        source.contents = Buffer.from(result);

        callback(null, source);
    });
}

// TODO html/src/* is not directly usable, and neither are file:/// modules b/c of modern CORS requirements
// ref. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#other_differences_between_modules_and_standard_scripts
// make 2 'all' bundles with and without minification or spawn a webserver w/ sourcemaps included?
function buildHtml(name, modules, compress) {
    if (modules === undefined) {
        modules = Object.assign({}, DEFAULT_MODULES);
        modules[NAMED_BUILD[name]] = true;
    }

    if (modules === undefined) {
        throw `'modules' argument / NAMED_BUILD['${name}'] is missing`;
    }

    const out = gulp.src(path.join(SRC_DIR, 'index.html'))
        .pipe(inlineSource(SRC_DIR, modules, compress))
        .pipe(modifyHtml([
            stripModules(modules),
            externalBlank(),
        ]));

    if (compress) {
        return out.pipe(
            toMinifiedHtml({
                collapseWhitespace: true,
                removeComments: true,
                minifyCSS: true,
                minifyJS: false
            })).pipe(
                replace('pure-', 'p-'));
    }

    return out;
}

function buildOutputs(name, stream) {
    return stream
        .pipe(gzip({gzipOptions: {level: 9 }}))
        .pipe(adjustFileStat())
        .pipe(rename(`index.${name}.html.gz`))
        .pipe(logSource())
        .pipe(gulp.dest(DATA_DIR))
        .pipe(toHeader('webui_image'))
        .pipe(gulp.dest(STATIC_DIR));
}

function buildWebUI(name, modules, compress = true) {
    return buildOutputs(name, buildHtml(name, modules, compress));
}

function serveWebUI(name, modules) {
    const server = http.createServer();

    server.on('request', function(request, response) {
        buildHtml(name, modules, false).pipe(
            through.obj(function(source, _, callback) {
                const url = new URL(`http://localhost${request.url}`);

                // serve bundled html as-is, do not minify
                switch (url.pathname) {
                case '/':
                case '/index.htm':
                case '/index.html':
                    response.writeHead(200, {
                        'Content-Type': 'text/html',
                        'Content-Length': source.contents.length,
                    });

                    response.write(source.contents);
                    response.end();

                    callback(null, source);
                    return;
                }

                // when module files need browser repl. but, note the bundling scope
                // and unavailable external modules (i.e. node_modules/*)
                if (url.pathname.endsWith('.mjs')) {
                    const name = url.pathname.split('/').at(-1);

                    response.writeHead(200, {
                        'Content-Type': 'text/javascript',
                    });

                    fs.createReadStream(path.join(SRC_DIR, name))
                        .pipe(response);
                    callback(null, source);
                    return;
                }

                response.writeHead(500, {'content-type': 'text/plain'});
                response.end('500');

                callback(null, source);
            }));
    });

    server.listen(8080);
}

// -----------------------------------------------------------------------------
// Tasks
// -----------------------------------------------------------------------------

gulp.task('webui_serve',
    () => serveWebUI('all', MODULES_LOCAL));

gulp.task('webui_all',
    () => buildWebUI('all', MODULES_ALL));

gulp.task('webui_small',
    () => buildWebUI('small', DEFAULT_MODULES));

gulp.task('webui_curtain',
    () => buildWebUI('curtain'));

gulp.task('webui_garland',
    () => buildWebUI('garland'));

gulp.task('webui_light',
    () => buildWebUI('light'));

gulp.task('webui_lightfox',
    () => buildWebUI('lightfox'));

gulp.task('webui_rfbridge',
    () => buildWebUI('rfbridge'));

gulp.task('webui_rfm69',
    () => buildWebUI('rfm69'));

gulp.task('webui_sensor',
    () => buildWebUI('sensor'));

gulp.task('webui_thermostat',
    () => buildWebUI('thermostat'));

gulp.task('default',
    gulp.parallel(
        'webui_all',
        'webui_small',
        'webui_curtain',
        'webui_garland',
        'webui_light',
        'webui_lightfox',
        'webui_rfbridge',
        'webui_rfm69',
        'webui_sensor',
        'webui_thermostat'));
